import { createClient } from "npm:@supabase/supabase-js@2";
import { buildUnsubscribePageUrl, buildUnsubscribeUrl } from "../_shared/emailUnsubToken.ts";
import { logContact } from "../_shared/contactLog.ts";
import {
  MARKETING_KEYS,
  MARKETING_SLOT_HOUR,
  byChannelPreference,
  decideLifecycle,
  marketingVars,
  pragueDateKey,
  pragueHour,
  type LifecycleFacts,
  type LifecycleHistory,
  type MarketingKey,
  type SentEmailRow,
  M2A_CTA_URL,
  M2A_EPISODE,
  M2A_KEY,
  M2A_MAX_HOURS,
  M2A_MIN_HOURS,
  MAX_EMAILS_PER_RUN,
  decideM2A,
  episodeKeyFor,
  inSendWindow,
  isDryRun,
  normalizeLocale,
  pickApprovedTemplate,
  renderEmail,
  unsubscribeHeaders,
  type TemplateRow,
} from "./rules.ts";

// Lifecycle e-maily (F0, 18. 10. 2026 — M2-A servisní: dotazník nedokončen;
// F1, 19. 10. 2026 — M3–M8 obchodní, jen SCHVÁLENÉ šablony, slot 16:30, viz runMarketing).
// Spouští pg_cron každou hodinu v :30 (SQL v migraci 20261018_email_f0.sql, zakomentované).
//
// Pojistky:
//  - EMAIL_DRY_RUN je výchozí true → zapíše email_sends.status='dry_run', NIC neodešle.
//    Naostro jen při EMAIL_DRY_RUN=false.
//  - Bez SCHVÁLENÉ verze šablony M2A se nic neposílá (ani dry run).
//  - Strop MAX_EMAILS_PER_RUN (40) na běh.
//  - Dedup: unique (user_id, template_key, episode_key); řádek se zakládá PŘED
//    odesláním, takže pád uprostřed znamená spíš žádný e-mail než dva.
//  - body {"preview": true} vrátí vyrenderovaný e-mail pro schválení, nic nezapíše ani nepošle.

const RESEND_FROM = "Pumplo <zpravy@pumplo.com>";
const REPLY_TO = "info@pumplo.com";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

type EligibleRow = {
  user_id: string;
  email: string | null;
  signed_up_at: string | null;
  first_name: string | null;
  language: string | null;
  onboarding_completed: boolean;
  current_step: number | null;
};

async function sendViaResend(
  apiKey: string,
  to: string,
  mail: { subject: string; html: string; text: string },
  headers: Record<string, string>,
): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: RESEND_FROM,
      to,
      reply_to: REPLY_TO,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      headers,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, error: `resend ${res.status}: ${body.slice(0, 300)}` };
  }
  const data = await res.json().catch(() => ({}));
  return { ok: true, id: (data as { id?: string }).id ?? null };
}

Deno.serve(async (req) => {
  // Cron se ověřuje CRON_SECRET, ruční běh service role klíčem (stejně jako subscription-renewal-reminders).
  const cronSecret = Deno.env.get("CRON_SECRET");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const auth = req.headers.get("Authorization") ?? "";
  const authorized =
    (cronSecret && auth === `Bearer ${cronSecret}`) ||
    (serviceKey && auth === `Bearer ${serviceKey}`);
  if (!authorized) return json({ error: "unauthorized" }, 401);

  const dryRun = isDryRun(Deno.env.get("EMAIL_DRY_RUN"));
  const unsubSecret = Deno.env.get("EMAIL_UNSUB_SECRET") ?? "";
  if (unsubSecret.length < 16) return json({ error: "EMAIL_UNSUB_SECRET not set" }, 500);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const apiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  if (!dryRun && !apiKey) return json({ error: "RESEND_API_KEY not set" }, 500);

  const supabase = createClient(supabaseUrl, serviceKey!);
  const body = await req.json().catch(() => ({})) as { preview?: boolean; locale?: string; key?: string };
  const now = new Date();

  const { data: tplRows, error: tplErr } = await supabase
    .from("email_templates")
    .select("key, version, locale, status, kind, subject, preheader, html, text");
  if (tplErr) return json({ error: tplErr.message }, 500);
  const allTemplates = (tplRows ?? []) as TemplateRow[];
  const templates = allTemplates.filter((t) => t.key === M2A_KEY);

  // Náhled pro schválení: vezme nejnovější verzi v daném jazyce (i draft), nic neposílá.
  // body.key = M2A (výchozí) nebo M3A…M8.
  if (body?.preview) {
    const locale = normalizeLocale(body.locale);
    const key = typeof body.key === "string" ? body.key : M2A_KEY;
    const latest = allTemplates
      .filter((t) => t.key === key && t.locale === locale)
      .sort((a, b) => b.version - a.version)[0];
    if (!latest) return json({ preview: true, error: "no template" }, 404);
    const sample = {
      workoutDates: ["2026-09-20", "2026-09-24", "2026-09-28"],
      planTrainingDays: ["monday", "wednesday", "friday"],
      trainingDays: null,
      selectedGymName: "Eurogym Olomouc",
    };
    const mail = renderEmail({
      template: latest, locale, firstName: "Jana", currentStep: 0,
      ctaUrl: M2A_CTA_URL, unsubscribeUrl: "https://app.pumplo.com/odhlasit?u=…&t=…",
      extraVars: key === M2A_KEY ? undefined : marketingVars(key as MarketingKey, locale, sample, now),
    });
    return json({ preview: true, key, version: latest.version, status: latest.status, ...mail });
  }

  const m2a = await runM2A({ supabase, templates, now, dryRun, unsubSecret, supabaseUrl, apiKey });
  if ("error" in m2a) return json({ error: m2a.error }, 500);
  const marketing = await runMarketing({
    supabase, templates: allTemplates, now, dryRun, unsubSecret, supabaseUrl, apiKey,
    budget: MAX_EMAILS_PER_RUN - (m2a.processed ?? 0),
  });
  return json({ ...m2a, marketing });
});

type RunCtx = {
  // deno-lint-ignore no-explicit-any
  supabase: any;
  templates: TemplateRow[];
  now: Date;
  dryRun: boolean;
  unsubSecret: string;
  supabaseUrl: string;
  apiKey: string;
};

// ─── M2A (F0) — chování beze změny, jen navíc zápis do contact_log po odeslání ───
async function runM2A(ctx: RunCtx): Promise<Record<string, unknown> & { processed?: number } | { error: string }> {
  const { supabase, templates, now, dryRun, unsubSecret, supabaseUrl, apiKey } = ctx;
  if (!templates.some((t) => t.status === "approved")) {
    return { dry_run: dryRun, sent: 0, reason: "no_approved_template", processed: 0 };
  }
  if (!inSendWindow(now)) {
    return { dry_run: dryRun, sent: 0, reason: "outside_send_window", processed: 0 };
  }

  const from = new Date(now.getTime() - M2A_MAX_HOURS * 3_600_000).toISOString();
  const to = new Date(now.getTime() - M2A_MIN_HOURS * 3_600_000).toISOString();
  const { data: rows, error: eligErr } = await supabase
    .from("email_eligible_users")
    .select("user_id, email, signed_up_at, first_name, language, onboarding_completed, current_step")
    .eq("onboarding_completed", false)
    .gte("signed_up_at", from)
    .lte("signed_up_at", to)
    .order("signed_up_at", { ascending: true })
    .limit(500);
  if (eligErr) return { error: eligErr.message };
  const candidates = (rows ?? []) as EligibleRow[];

  const episode = episodeKeyFor(M2A_EPISODE, dryRun);
  const ids = candidates.map((c) => c.user_id);
  const already = new Set<string>();
  if (ids.length) {
    const { data: sentRows, error: sentErr } = await supabase
      .from("email_sends")
      .select("user_id")
      .eq("template_key", M2A_KEY)
      .eq("episode_key", episode)
      .in("user_id", ids);
    if (sentErr) return { error: sentErr.message };
    for (const r of sentRows ?? []) already.add((r as { user_id: string }).user_id);
  }

  const results: { user_id: string; status: string; reason?: string }[] = [];
  let processed = 0;

  for (const c of candidates) {
    if (processed >= MAX_EMAILS_PER_RUN) break;
    const decision = decideM2A({
      userId: c.user_id,
      email: c.email,
      signedUpAt: c.signed_up_at,
      onboardingCompleted: c.onboarding_completed,
      alreadySent: already.has(c.user_id),
    }, now);
    if (!decision.send) continue;

    const locale = normalizeLocale(c.language);
    const template = pickApprovedTemplate(templates, M2A_KEY, locale);
    if (!template) continue;
    const mailLocale = normalizeLocale(template.locale);
    // Patička → potvrzovací stránka v appce (GET nic nemění); hlavička → funkce (one-click POST).
    const unsubscribePageUrl = await buildUnsubscribePageUrl(c.user_id, unsubSecret);
    const oneClickUrl = await buildUnsubscribeUrl(supabaseUrl, c.user_id, unsubSecret);
    const mail = renderEmail({
      template, locale: mailLocale, firstName: c.first_name, currentStep: c.current_step,
      ctaUrl: M2A_CTA_URL, unsubscribeUrl: unsubscribePageUrl,
    });

    // Zámek přes unique: kdo řádek nezaloží (souběžný běh), nic neposílá.
    const { data: claimed, error: claimErr } = await supabase
      .from("email_sends")
      .insert({
        user_id: c.user_id,
        template_key: M2A_KEY,
        template_version: template.version,
        locale: mailLocale,
        episode_key: episode,
        status: dryRun ? "dry_run" : "failed",
        error: dryRun ? null : "claimed, sending",
      })
      .select("id")
      .single();
    if (claimErr || !claimed) {
      results.push({ user_id: c.user_id, status: "skipped", reason: claimErr?.code === "23505" ? "duplicate" : claimErr?.message });
      continue;
    }
    processed++;

    if (dryRun) {
      results.push({ user_id: c.user_id, status: "dry_run" });
      continue;
    }

    const sent = await sendViaResend(apiKey, c.email!, mail, unsubscribeHeaders(oneClickUrl));
    if (sent.ok) {
      await supabase.from("email_sends").update({ status: "sent", resend_id: sent.id, error: null }).eq("id", claimed.id);
      await logContact(supabase, c.user_id, "email", M2A_KEY);
      results.push({ user_id: c.user_id, status: "sent" });
    } else {
      console.error("M2A send failed", c.user_id, sent.error);
      await supabase.from("email_sends").update({ status: "failed", error: sent.error }).eq("id", claimed.id);
      results.push({ user_id: c.user_id, status: "failed" });
    }
  }

  return {
    dry_run: dryRun,
    template: M2A_KEY,
    candidates: candidates.length,
    processed,
    cap: MAX_EMAILS_PER_RUN,
    results,
  };
}

// ─── M3–M8 (F1) — obchodní sdělení ─────────────────────────────────────────────
// Pojistky navíc k M2A:
//  - běží jen v pražském slotu 16:30 (MARKETING_SLOT_HOUR) a jen pro klíče se SCHVÁLENOU
//    šablonou; bez schválené šablony se ani nečtou data uživatelů,
//  - právní brána, stropy a priority rozhoduje decideLifecycle (rules.ts, testované),
//  - dry run nepíše do contact_log (nesmí blokovat pushe), zapisuje email_sends 'dry_run'.

type FactsRow = {
  user_id: string;
  email: string | null;
  signed_up_at: string | null;
  first_name: string | null;
  language: string | null;
  onboarding_completed: boolean;
  selected_gym_id: string | null;
  selected_gym_name: string | null;
  marketing_optout_at: string | null;
  marketing_consent_at: string | null;
  email_optout_offered_at: string | null;
  email_unsubscribed_at: string | null;
  notification_comeback: boolean | null;
  training_days: string[] | null;
  plan_training_days: string[] | null;
  first_gym_plan_at: string | null;
  workout_dates: string[] | null;
  has_device_token: boolean;
};

const chunk = <T,>(arr: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

const ELIGIBLE_REASONS = new Set(["outside_slot", "comeback_push_day", "contact_today", "email_48h", "email_7d_cap"]);

async function runMarketing(ctx: RunCtx & { budget: number }): Promise<Record<string, unknown>> {
  const { supabase, templates, now, dryRun, unsubSecret, supabaseUrl, apiKey } = ctx;
  const approvedKeys = new Set(
    templates.filter((t) => t.status === "approved" && (MARKETING_KEYS as readonly string[]).includes(t.key)).map((t) => t.key),
  );
  if (approvedKeys.size === 0) return { sent: 0, reason: "no_approved_template" };
  if (pragueHour(now) !== MARKETING_SLOT_HOUR) return { sent: 0, reason: "outside_slot" };
  if (ctx.budget <= 0) return { sent: 0, reason: "run_cap_reached" };

  const { data: factRows, error: factErr } = await supabase
    .from("email_lifecycle_facts")
    .select("user_id, email, signed_up_at, first_name, language, onboarding_completed, selected_gym_id, selected_gym_name, marketing_optout_at, marketing_consent_at, email_optout_offered_at, email_unsubscribed_at, notification_comeback, training_days, plan_training_days, first_gym_plan_at, workout_dates, has_device_token")
    // Aktivace jen po dotazníku (M2A řeší zbytek); udržení každý, kdo trénoval.
    .or("onboarding_completed.eq.true,completed_workouts.gt.0")
    .limit(5000);
  if (factErr) return { error: factErr.message };
  const rows = (factRows ?? []) as FactsRow[];
  if (!rows.length) return { sent: 0, candidates: 0 };

  // Historie: e-maily (všechny šablony), contact_log 90 dní, dnešní pushe z notification_logs.
  const todayKey = pragueDateKey(now);
  const since90 = new Date(now.getTime() - 90 * 86_400_000).toISOString();
  const emailsBy = new Map<string, SentEmailRow[]>();
  const contactsBy = new Map<string, LifecycleHistory["contacts"]>();
  const pushBy = new Map<string, string[]>();
  for (const ids of chunk(rows.map((r) => r.user_id), 200)) {
    const [es, cl, nl] = await Promise.all([
      supabase.from("email_sends").select("user_id, template_key, episode_key, status, created_at").in("user_id", ids),
      supabase.from("contact_log").select("user_id, channel, sent_at").in("user_id", ids).gte("sent_at", since90),
      supabase.from("notification_logs").select("user_id, date_key").in("user_id", ids).eq("date_key", todayKey),
    ]);
    if (es.error) return { error: es.error.message };
    if (cl.error) return { error: cl.error.message };
    if (nl.error) return { error: nl.error.message };
    for (const r of es.data ?? []) {
      const ep = String(r.episode_key);
      const isDry = ep.startsWith("dry_run:");
      if (isDry !== dryRun) continue; // jen řádky aktuálního režimu (stejně jako M2A)
      const list = emailsBy.get(r.user_id) ?? [];
      list.push({ templateKey: r.template_key, episodeKey: isDry ? ep.slice("dry_run:".length) : ep, sentAt: r.created_at, status: r.status });
      emailsBy.set(r.user_id, list);
    }
    for (const r of cl.data ?? []) {
      const list = contactsBy.get(r.user_id) ?? [];
      list.push({ channel: r.channel, sentAt: r.sent_at });
      contactsBy.set(r.user_id, list);
    }
    for (const r of nl.data ?? []) {
      const list = pushBy.get(r.user_id) ?? [];
      list.push(r.date_key);
      pushBy.set(r.user_id, list);
    }
  }

  const toFacts = (r: FactsRow): LifecycleFacts => ({
    userId: r.user_id,
    email: r.email,
    signedUpAt: r.signed_up_at,
    onboardingCompleted: r.onboarding_completed,
    selectedGymId: r.selected_gym_id,
    marketingConsentAt: r.marketing_consent_at,
    emailOptoutOfferedAt: r.email_optout_offered_at,
    marketingOptoutAt: r.marketing_optout_at,
    emailUnsubscribedAt: r.email_unsubscribed_at,
    notificationComeback: r.notification_comeback !== false,
    trainingDays: r.training_days,
    planTrainingDays: r.plan_training_days,
    firstGymPlanAt: r.first_gym_plan_at,
    workoutDates: [...(r.workout_dates ?? [])].sort(),
    hasDeviceToken: r.has_device_token,
  });

  const decided = rows
    .map((r) => {
      const facts = toFacts(r);
      const history: LifecycleHistory = {
        emails: emailsBy.get(r.user_id) ?? [],
        contacts: contactsBy.get(r.user_id) ?? [],
        pushDateKeys: pushBy.get(r.user_id) ?? [],
      };
      return { row: r, facts, decision: decideLifecycle(facts, history, now, approvedKeys) };
    })
    .sort((a, b) => byChannelPreference(a.facts, b.facts));

  // Oslovitelní dnes (spouštěč + schválená šablona + právo + comeback), před stropy → KPI eligible.
  const eligibleByKey = new Map<string, number>();
  for (const d of decided) {
    const ok = d.decision.send || (d.decision.key && ELIGIBLE_REASONS.has(d.decision.reason));
    const key = d.decision.send ? d.decision.key : d.decision.key;
    if (ok && key) eligibleByKey.set(key, (eligibleByKey.get(key) ?? 0) + 1);
  }
  if (!dryRun && eligibleByKey.size) {
    const { data: prev } = await supabase.from("email_eligible_daily").select("template_key, eligible").eq("day", todayKey);
    const prevBy = new Map((prev ?? []).map((p: { template_key: string; eligible: number }) => [p.template_key, p.eligible]));
    const upserts = [...eligibleByKey].map(([template_key, n]) => ({
      day: todayKey, template_key, eligible: Math.max(n, Number(prevBy.get(template_key) ?? 0)), updated_at: now.toISOString(),
    }));
    const { error } = await supabase.from("email_eligible_daily").upsert(upserts, { onConflict: "day,template_key" });
    if (error) console.error("email_eligible_daily upsert failed", error.message);
  }

  const results: { user_id: string; key: string; status: string; reason?: string }[] = [];
  const skippedByReason: Record<string, number> = {};
  let processed = 0;
  for (const { row, facts, decision } of decided) {
    if (!decision.send) {
      if (decision.key) skippedByReason[decision.reason] = (skippedByReason[decision.reason] ?? 0) + 1;
      continue;
    }
    if (processed >= ctx.budget) break;
    const key = decision.key;
    const locale = normalizeLocale(row.language);
    const template = pickApprovedTemplate(templates, key, locale);
    if (!template || template.kind !== "marketing") continue;
    const mailLocale = normalizeLocale(template.locale);
    const unsubscribePageUrl = await buildUnsubscribePageUrl(row.user_id, unsubSecret);
    const oneClickUrl = await buildUnsubscribeUrl(supabaseUrl, row.user_id, unsubSecret);
    const mail = renderEmail({
      template, locale: mailLocale, firstName: row.first_name, currentStep: null,
      ctaUrl: M2A_CTA_URL, unsubscribeUrl: unsubscribePageUrl,
      extraVars: marketingVars(key, mailLocale, { ...facts, selectedGymName: row.selected_gym_name }, now),
    });

    const { data: claimed, error: claimErr } = await supabase
      .from("email_sends")
      .insert({
        user_id: row.user_id,
        template_key: key,
        template_version: template.version,
        locale: mailLocale,
        episode_key: episodeKeyFor(decision.episode, dryRun),
        status: dryRun ? "dry_run" : "failed",
        error: dryRun ? null : "claimed, sending",
      })
      .select("id")
      .single();
    if (claimErr || !claimed) {
      results.push({ user_id: row.user_id, key, status: "skipped", reason: claimErr?.code === "23505" ? "duplicate" : claimErr?.message });
      continue;
    }
    processed++;

    if (dryRun) {
      results.push({ user_id: row.user_id, key, status: "dry_run" });
      continue;
    }

    const sent = await sendViaResend(apiKey, row.email!, mail, unsubscribeHeaders(oneClickUrl));
    if (sent.ok) {
      await supabase.from("email_sends").update({ status: "sent", resend_id: sent.id, error: null }).eq("id", claimed.id);
      await logContact(supabase, row.user_id, "email", key);
      results.push({ user_id: row.user_id, key, status: "sent" });
    } else {
      console.error(`${key} send failed`, row.user_id, sent.error);
      await supabase.from("email_sends").update({ status: "failed", error: sent.error }).eq("id", claimed.id);
      results.push({ user_id: row.user_id, key, status: "failed" });
    }
  }

  return {
    approved: [...approvedKeys],
    candidates: rows.length,
    eligible: Object.fromEntries(eligibleByKey),
    skipped: skippedByReason,
    processed,
    results,
  };
}
