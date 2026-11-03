import { createClient } from "npm:@supabase/supabase-js@2";
import { buildUnsubscribePageUrl, buildUnsubscribeUrl } from "../_shared/emailUnsubToken.ts";
import { logContact } from "../_shared/contactLog.ts";
import {
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

// Lifecycle e-maily (F0, 18. 10. 2026 — M2-A servisní: dotazník nedokončen).
// Obchodní M3–M8 tahle funkce NEPOSÍLÁ: od 19. 10. 2026 je řídí Loops
// (supabase/functions/loops-sync + docs/email/loops-journeys.md).
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
  const body = await req.json().catch(() => ({})) as { preview?: boolean; locale?: string };
  const now = new Date();

  const { data: tplRows, error: tplErr } = await supabase
    .from("email_templates")
    .select("key, version, locale, status, kind, subject, preheader, html, text")
    .eq("key", M2A_KEY);
  if (tplErr) return json({ error: tplErr.message }, 500);
  const templates = (tplRows ?? []) as TemplateRow[];

  // Náhled pro schválení: vezme nejnovější verzi M2A v daném jazyce (i draft), nic neposílá.
  if (body?.preview) {
    const locale = normalizeLocale(body.locale);
    const latest = templates
      .filter((t) => t.locale === locale)
      .sort((a, b) => b.version - a.version)[0];
    if (!latest) return json({ preview: true, error: "no template" }, 404);
    const mail = renderEmail({
      template: latest, locale, firstName: "Jana", currentStep: 0,
      ctaUrl: M2A_CTA_URL, unsubscribeUrl: "https://app.pumplo.com/odhlasit?u=…&t=…",
    });
    return json({ preview: true, key: M2A_KEY, version: latest.version, status: latest.status, ...mail });
  }

  const m2a = await runM2A({ supabase, templates, now, dryRun, unsubSecret, supabaseUrl, apiKey });
  if ("error" in m2a) return json({ error: m2a.error }, 500);
  return json(m2a);
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
