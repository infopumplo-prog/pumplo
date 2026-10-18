import { createClient } from "npm:@supabase/supabase-js@2";
import {
  MAX_REQUESTS_PER_RUN,
  REQUEST_SPACING_MS,
  buildContact,
  computeEvents,
  eventBody,
  eventKey,
  idempotencyKey,
  isLoopsDryRun,
  loopsRequest,
  planContact,
  belongsInLoops,
  planDropout,
  planWelcome,
  isWithinWelcomeWindow,
  WELCOME_CONTACT_TYPE,
  WELCOME_EPISODE,
  WELCOME_TEMPLATE_KEY,
  WELCOME_TEMPLATE_VERSION,
  type DropoutReason,
  type FetchLike,
  type LoopsFactsRow,
  type SyncedState,
} from "./sync.ts";

// loops-sync (19. 10. 2026): Supabase → Loops. Logika v sync.ts (testovaná vitestem).
// Spouští pg_cron každou hodinu v :40 (SQL v migraci 20261019b_loops.sql, zakomentované).
//
//  1. Kontakty: JEN s marketingAllowed = true (minimalizace dat), upsert jen při změně
//     (loops_contacts.props_hash), z view loops_contact_facts (= email_eligible_users).
//  2. Události: computeEvents → loops_event_log (unique user_id+event+episode) → Loops.
//     Řádek se zakládá PŘED odesláním; když Loops odmítne, řádek se smaže a příště se zkusí znovu.
//  0. M0 Vítej: servisní transactional e-mail (Loops /transactional, addToAudience false)
//     každému novému účtu (≤ 72 h) jednou — bez marketingAllowed, s odhlášením a suppressions.
//     Bez LOOPS_WELCOME_TRANSACTIONAL_ID se přeskočí (log).
//  3. Vyřazení: kdo je v Loops a ztratil marketingAllowed / vypadl z eligible / smazal účet
//     → kontakt v Loops smazat, důvod do loops_contacts.removed_reason + log.
//
// Pojistky:
//  - LOOPS_DRY_RUN je výchozí true → jen vypíše, co by poslal; nevolá Loops a nic nezapisuje.
//  - Bez LOOPS_API_KEY se naostro nespustí.
//  - ~8 req/s a strop MAX_REQUESTS_PER_RUN; 429 → backoff, po opakovaném 429 běh skončí (zbytek příště).

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const FACT_COLUMNS =
  "user_id, email, first_name, language, signed_up_at, onboarding_completed, selected_gym_id, selected_gym_name, " +
  "marketing_consent_at, email_optout_offered_at, marketing_optout_at, email_unsubscribed_at, notification_comeback, completed_workouts, " +
  "first_completed_at, last_completed_at, workout_dates, training_days, plan_training_days, first_plan_at, " +
  "first_gym_plan_at, has_active_plan, recent_workouts";

const chunk = <T,>(arr: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const auth = req.headers.get("Authorization") ?? "";
  const authorized =
    (cronSecret && auth === `Bearer ${cronSecret}`) ||
    (serviceKey && auth === `Bearer ${serviceKey}`);
  if (!authorized) return json({ error: "unauthorized" }, 401);

  const dryRun = isLoopsDryRun(Deno.env.get("LOOPS_DRY_RUN"));
  const apiKey = Deno.env.get("LOOPS_API_KEY") ?? "";
  if (!dryRun && !apiKey) return json({ error: "LOOPS_API_KEY not set" }, 500);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey!);
  const now = new Date();

  const { data: factRows, error: factErr } = await supabase.from("loops_contact_facts").select(FACT_COLUMNS).limit(10000);
  if (factErr) return json({ error: factErr.message }, 500);
  const rows = (factRows ?? []) as unknown as LoopsFactsRow[];

  const { data: syncedRows, error: syncedErr } = await supabase
    .from("loops_contacts")
    .select("user_id, email, props_hash, removed_at")
    .limit(20000);
  if (syncedErr) return json({ error: syncedErr.message }, 500);
  const synced = new Map<string, SyncedState & { email: string | null }>();
  for (const s of syncedRows ?? []) {
    synced.set(s.user_id, { propsHash: s.props_hash, removedAt: s.removed_at, email: s.email });
  }

  // Historie událostí (jen co je potřeba: logované páry + poslední plan_slowing).
  const logged = new Map<string, Set<string>>();
  const lastSlowing = new Map<string, string>();
  const inactiveSent = new Map<string, string[]>();
  for (const ids of chunk(rows.map((r) => r.user_id), 200)) {
    const { data, error } = await supabase
      .from("loops_event_log")
      .select("user_id, event, episode, sent_at")
      .in("user_id", ids);
    if (error) return json({ error: error.message }, 500);
    for (const e of data ?? []) {
      const set = logged.get(e.user_id) ?? new Set<string>();
      set.add(eventKey(e.event, e.episode));
      logged.set(e.user_id, set);
      if (e.event === "plan_slowing" && (!lastSlowing.has(e.user_id) || e.sent_at > lastSlowing.get(e.user_id)!)) {
        lastSlowing.set(e.user_id, e.sent_at);
      }
      if (e.event === "inactive_21d") inactiveSent.set(e.user_id, [...(inactiveSent.get(e.user_id) ?? []), e.sent_at]);
    }
  }

  const fetchLike: FetchLike = (url, init) => fetch(url, init);
  let requests = 0;
  let stoppedReason: string | null = null;
  const call = async (method: "PUT" | "POST", path: string, body: Record<string, unknown>, idem?: string) => {
    if (requests >= MAX_REQUESTS_PER_RUN) {
      stoppedReason = "request_cap";
      return null;
    }
    requests++;
    const r = await loopsRequest({ fetch: fetchLike, sleep, apiKey }, method, path, body, idem);
    await sleep(REQUEST_SPACING_MS);
    if (!r.ok && r.rateLimited) stoppedReason = "rate_limited";
    return r;
  };

  const summary = {
    dry_run: dryRun,
    candidates: rows.length,
    contacts: { upserted: 0, unchanged: 0, failed: 0 },
    events: {} as Record<string, number>,
    events_failed: 0,
    skipped_not_allowed: 0,
    dropouts: { marketing_not_allowed: 0, not_eligible: 0, account_deleted: 0, failed: 0 },
    welcome: { would_send: 0, sent: 0, failed: 0, skipped: {} as Record<string, number> },
    requests: 0,
    stopped: null as string | null,
    sample: [] as unknown[],
  };
  const sample = (x: unknown) => {
    if (summary.sample.length < 20) summary.sample.push(x);
  };

  // 0. M0 Vítej — servisní transactional e-mail KAŽDÉMU novému členovi jednou.
  //    NEPOTŘEBUJE marketingAllowed (rozhodnutí v planWelcome), ale respektuje odhlášení
  //    a suppressions (rows = email_eligible_users + pojistka v planWelcome).
  //    addToAudience: false → nikoho to nepřidá do audience obchodních e-mailů.
  //    Jednou za život: zámek = řádek email_sends (unique user+M0+life) PŘED odesláním.
  const welcomeId = (Deno.env.get("LOOPS_WELCOME_TRANSACTIONAL_ID") ?? "").trim();
  const welcomeRows = rows.filter((r) => isWithinWelcomeWindow(r.signed_up_at, now));
  const welcomeSent = new Set<string>();
  const suppressedEmails = new Set<string>();
  if (welcomeRows.length) {
    for (const ids of chunk(welcomeRows.map((r) => r.user_id), 200)) {
      const { data, error } = await supabase
        .from("email_sends")
        .select("user_id")
        .eq("template_key", WELCOME_TEMPLATE_KEY)
        .in("user_id", ids);
      if (error) return json({ error: error.message }, 500);
      for (const s of data ?? []) welcomeSent.add(s.user_id);
    }
    const { data: sup, error: supErr } = await supabase.from("email_suppressions").select("email").limit(20000);
    if (supErr) return json({ error: supErr.message }, 500);
    for (const s of sup ?? []) if (s.email) suppressedEmails.add(String(s.email).trim().toLowerCase());
  }
  if (!welcomeId && welcomeRows.length) {
    console.warn("LOOPS_WELCOME_TRANSACTIONAL_ID not set — M0 welcome skipped", welcomeRows.length);
  }
  for (const w of welcomeRows) {
    if (stoppedReason) break;
    const plan = planWelcome(w, { sentUserIds: welcomeSent, suppressedEmails }, now, welcomeId || "(LOOPS_WELCOME_TRANSACTIONAL_ID chybí)");
    if (plan.kind === "skip") {
      summary.welcome.skipped[plan.reason] = (summary.welcome.skipped[plan.reason] ?? 0) + 1;
      continue;
    }
    if (dryRun) {
      summary.welcome.would_send++;
      sample({ welcome: { userId: w.user_id, dataVariables: plan.body.dataVariables, transactionalIdSet: !!welcomeId } });
      continue;
    }
    if (!welcomeId) {
      summary.welcome.skipped.no_transactional_id = (summary.welcome.skipped.no_transactional_id ?? 0) + 1;
      continue;
    }
    const { data: claim, error: claimErr } = await supabase
      .from("email_sends")
      .insert({
        user_id: w.user_id,
        template_key: WELCOME_TEMPLATE_KEY,
        template_version: WELCOME_TEMPLATE_VERSION,
        locale: plan.locale,
        episode_key: WELCOME_EPISODE,
        status: "sent",
      })
      .select("id")
      .single();
    if (claimErr || !claim) {
      if (claimErr?.code !== "23505") console.error("email_sends M0 claim failed", w.user_id, claimErr?.message);
      summary.welcome.skipped.already_sent = (summary.welcome.skipped.already_sent ?? 0) + 1;
      continue;
    }
    welcomeSent.add(w.user_id);
    const res = await call("POST", "/transactional", { ...plan.body }, plan.idemKey);
    if (res?.ok) {
      summary.welcome.sent++;
      const { error } = await supabase.from("contact_log").insert({ user_id: w.user_id, channel: "email", type: WELCOME_CONTACT_TYPE });
      if (error) console.error("contact_log M0 insert failed", w.user_id, error.message);
    } else {
      summary.welcome.failed++;
      if (res) console.error("loops M0 failed", w.user_id, res.status, res.error);
      if (!res || res.status === 429 || res.status >= 500) {
        // Neodešlo (strop běhu / rate limit / chyba Loops) → uvolnit zámek, další běh to zkusí znovu.
        await supabase.from("email_sends").delete().eq("id", claim.id);
      } else {
        // 4xx (např. nepublikovaný e-mail) → neopakovat; řádek zůstane 'failed' s chybou.
        await supabase.from("email_sends").update({ status: "failed", error: res.error.slice(0, 300) }).eq("id", claim.id);
      }
    }
  }

  // 1+2. Kontakty a události (kontakt vždy před událostmi téhož člověka).
  for (const r of rows) {
    if (stoppedReason) break;
    const contact = buildContact(r);
    if (!belongsInLoops(contact)) {
      // Bez právního základu do Loops nic (ani kontakt, ani události); případný starý kontakt smaže krok 3.
      summary.skipped_not_allowed++;
      continue;
    }
    const prev = synced.get(r.user_id);
    const action = planContact(contact, prev);
    const events = computeEvents(r, {
      logged: logged.get(r.user_id) ?? new Set(),
      lastPlanSlowingAt: lastSlowing.get(r.user_id) ?? null,
      inactiveSentAt: inactiveSent.get(r.user_id) ?? [],
    }, now);

    if (dryRun) {
      if (action.kind === "upsert") {
        summary.contacts.upserted++;
        sample({ contact: action.body });
      } else summary.contacts.unchanged++;
      for (const e of events) {
        summary.events[e.event] = (summary.events[e.event] ?? 0) + 1;
        sample({ userId: r.user_id, event: e.event, episode: e.episode, eventProperties: e.eventProperties });
      }
      continue;
    }

    if (action.kind === "upsert") {
      const res = await call("PUT", "/contacts/update", action.body);
      if (!res) break;
      if (res.ok) {
        summary.contacts.upserted++;
        const { error } = await supabase.from("loops_contacts").upsert({
          user_id: r.user_id,
          email: contact.email,
          props_hash: action.hash,
          synced_at: now.toISOString(),
          removed_at: null,
          removed_reason: null,
        }, { onConflict: "user_id" });
        if (error) console.error("loops_contacts upsert failed", r.user_id, error.message);
      } else {
        summary.contacts.failed++;
        console.error("loops contact upsert failed", r.user_id, res.status, res.error);
        continue; // bez kontaktu neposílat události (filtr journey by neměl marketingAllowed)
      }
    } else {
      summary.contacts.unchanged++;
    }

    for (const e of events) {
      if (stoppedReason) break;
      // Zámek přes unique: kdo řádek nezaloží (souběžný běh), nic neposílá.
      const { data: claimed, error: claimErr } = await supabase
        .from("loops_event_log")
        .insert({ user_id: r.user_id, event: e.event, episode: e.episode, properties: e.eventProperties })
        .select("id")
        .single();
      if (claimErr || !claimed) {
        if (claimErr?.code !== "23505") console.error("loops_event_log insert failed", claimErr?.message);
        continue;
      }
      const res = await call("POST", "/events/send", eventBody(contact, e), idempotencyKey(r.user_id, e));
      if (res?.ok) {
        summary.events[e.event] = (summary.events[e.event] ?? 0) + 1;
      } else {
        summary.events_failed++;
        if (res) console.error("loops event failed", r.user_id, e.event, res.status, res.error);
        // Neodešlo → uvolnit zámek, další běh to zkusí znovu (Idempotency-Key brání dvojímu doručení do 24 h).
        await supabase.from("loops_event_log").delete().eq("id", claimed.id);
      }
    }
  }

  // 3. Vyřazení: v Loops, ale už tam nepatří → smazat kontakt.
  const inLoops = new Set(rows.filter((r) => belongsInLoops(buildContact(r))).map((r) => r.user_id));
  const eligible = new Set(rows.map((r) => r.user_id));
  const dropouts = [...synced].filter(([id, s]) => !s.removedAt && !inLoops.has(id));
  for (const [userId] of dropouts) {
    if (stoppedReason) break;
    let reason: DropoutReason = "marketing_not_allowed";
    if (!eligible.has(userId)) {
      const { data: authUser } = await supabase.auth.admin.getUserById(userId);
      reason = authUser?.user ? "not_eligible" : "account_deleted";
    }
    const plan = planDropout(userId, reason);
    if (dryRun) {
      summary.dropouts[reason]++;
      sample({ dropout: plan });
      continue;
    }
    const res = await call("POST", "/contacts/delete", plan.body);
    if (!res) break;
    if (res.ok || res.status === 404) {
      summary.dropouts[reason]++;
      console.log("loops contact deleted", userId, reason, res.status);
      await supabase.from("loops_contacts")
        .update({ removed_at: now.toISOString(), removed_reason: reason })
        .eq("user_id", userId);
    } else {
      summary.dropouts.failed++;
      console.error("loops dropout failed", userId, reason, res.status, res.error);
    }
  }

  summary.requests = requests;
  summary.stopped = stoppedReason;
  if (dryRun) console.log("loops-sync DRY RUN", JSON.stringify(summary));
  return json(summary);
});
