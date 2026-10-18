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
  planDropout,
  loopsMembership,
  contactForMembership,
  eventsForMembership,
  dropoutReasonFor,
  type LoopsMembership,
  type DropoutReason,
  type FetchLike,
  type LoopsFactsRow,
  type SyncedState,
} from "./sync.ts";

// loops-sync (19. 10. 2026): Supabase → Loops. Logika v sync.ts (testovaná vitestem).
// Spouští pg_cron každou hodinu v :40 (SQL v migraci 20261019b_loops.sql, zakomentované).
//
//  1. Kontakty: plná sada JEN s marketingAllowed = true; nový člen bez něj jen minimum kvůli J0 (bod 0).
//     Upsert jen při změně
//     (loops_contacts.props_hash), z view loops_contact_facts (= email_eligible_users).
//  2. Události: computeEvents → loops_event_log (unique user_id+event+episode) → Loops.
//     Řádek se zakládá PŘED odesláním; když Loops odmítne, řádek se smaže a příště se zkusí znovu.
//  0. J0 Vítej (workflow v Loops, trigger signed_up): KAŽDÝ nový člen (≤ 72 h od registrace)
//     jde do Loops — bez marketingAllowed jen s minimem vlastností a jen se signed_up;
//     7 dní po registraci se takový kontakt smaže (welcome_window_ended).
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
    .select("user_id, email, props_hash, removed_at, membership")
    .limit(20000);
  if (syncedErr) return json({ error: syncedErr.message }, 500);
  const synced = new Map<string, SyncedState & { email: string | null }>();
  for (const s of syncedRows ?? []) {
    synced.set(s.user_id, { propsHash: s.props_hash, removedAt: s.removed_at, membership: s.membership, email: s.email });
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
    dropouts: { marketing_not_allowed: 0, not_eligible: 0, account_deleted: 0, welcome_window_ended: 0, failed: 0 },
    welcome_contacts: 0,
    requests: 0,
    stopped: null as string | null,
    sample: [] as unknown[],
  };
  const sample = (x: unknown) => {
    if (summary.sample.length < 20) summary.sample.push(x);
  };

  // 1+2. Kontakty a události (kontakt vždy před událostmi téhož člověka).
  // Kdo patří do Loops a proč (marketing = plná sada, welcome = jen minimum kvůli J0 Vítej).
  const memberships = new Map<string, LoopsMembership>();
  for (const r of rows) memberships.set(r.user_id, loopsMembership(buildContact(r), r.signed_up_at, synced.get(r.user_id), now));

  for (const r of rows) {
    if (stoppedReason) break;
    const full = buildContact(r);
    const membership = memberships.get(r.user_id) ?? "none";
    if (!full || membership === "none") {
      // Bez právního základu a mimo okno uvítání do Loops nic; případný starý kontakt smaže krok 3.
      summary.skipped_not_allowed++;
      continue;
    }
    // welcome → jen minimální vlastnosti (marketingAllowed=false, retentionEmailsAllowed=false).
    const contact = contactForMembership(full, membership);
    if (membership === "welcome") summary.welcome_contacts++;
    const prev = synced.get(r.user_id);
    const action = planContact(contact, prev);
    const events = eventsForMembership(membership, computeEvents(r, {
      logged: logged.get(r.user_id) ?? new Set(),
      lastPlanSlowingAt: lastSlowing.get(r.user_id) ?? null,
      inactiveSentAt: inactiveSent.get(r.user_id) ?? [],
    }, now));

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
          membership,
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
  const inLoops = new Set([...memberships].filter(([, m]) => m !== "none").map(([id]) => id));
  const eligible = new Set(rows.map((r) => r.user_id));
  const dropouts = [...synced].filter(([id, s]) => !s.removedAt && !inLoops.has(id));
  for (const [userId, prevState] of dropouts) {
    if (stoppedReason) break;
    let accountExists = true;
    if (!eligible.has(userId)) {
      const { data: authUser } = await supabase.auth.admin.getUserById(userId);
      accountExists = !!authUser?.user;
    }
    const reason: DropoutReason = dropoutReasonFor(prevState, eligible.has(userId), accountExists);
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
