import { createClient } from "npm:@supabase/supabase-js@2";

// Renewal reminder emails for gym subscriptions. A daily cron calls this; for
// each active subscription whose current_period_end is 7 / 3 / 1 / 0 days away
// it e-mails the gym owner once per threshold (deduped in
// subscription_renewal_reminders). Grandfathered gyms (Eurogym) have no card on
// file — the reminder tells them to arrange payment before the period ends.

const RESEND_FROM = "Pumplo <zpravy@pumplo.com>";
const THRESHOLDS = [7, 3, 1, 0];
const ACCOUNT_URL = "https://admin.pumplo.com/account";
const SUPPORT_EMAIL = "info@pumplo.com";
const SUPPORT_PHONE = "+420 731 188 352";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const fmtDate = (d: Date) =>
  `${d.getUTCDate()}. ${d.getUTCMonth() + 1}. ${d.getUTCFullYear()}`;

// Days from today (UTC date) to the period end (UTC date), at day granularity.
const daysUntil = (periodEnd: Date, now: Date): number => {
  const end = Date.UTC(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth(), periodEnd.getUTCDate());
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((end - today) / 86_400_000);
};

const reminderCopy = (days: number, gymName: string, endDate: string) => {
  const safe = escapeHtml(gymName);
  const when =
    days >= 7 ? "za týden" :
    days === 3 ? "za 3 dny" :
    days === 1 ? "zítra" :
    "dnes";
  const subject =
    days <= 0
      ? `Pumplo – dnes se obnovuje předplatné pro ${gymName}`
      : `Pumplo – předplatné pro ${gymName} se obnovuje ${when}`;
  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
      <h2 style="margin:0 0 16px">Obnovení předplatného Pumplo</h2>
      <p style="margin:0 0 16px;line-height:1.5">
        Předplatné pro posilovnu <strong>${safe}</strong> se obnovuje <strong>${when}</strong> (${endDate}).
      </p>
      <p style="margin:0 0 16px;line-height:1.5">
        Ve vašem účtu nemáme uloženou platební kartu, takže se platba nestrhne automaticky.
        Aby vám služba běžela dál bez přerušení, přihlaste se prosím do účtu a nastavte platbu,
        nebo nás kontaktujte a domluvíme se na faktuře.
      </p>
      <p style="margin:0 0 24px">
        <a href="${ACCOUNT_URL}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">
          Nastavit platbu
        </a>
      </p>
      <p style="margin:0;font-size:13px;color:#555;line-height:1.6">
        Potřebujete poradit? Napište na <a href="mailto:${SUPPORT_EMAIL}" style="color:#2563eb">${SUPPORT_EMAIL}</a>
        nebo volejte ${SUPPORT_PHONE}.
      </p>
    </div>`;
  return { subject, html };
};

async function sendEmail(apiKey: string, to: string, subject: string, html: string): Promise<boolean> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: RESEND_FROM, to, subject, html }),
  });
  if (!res.ok) { console.error("Resend error", res.status, await res.text().catch(() => "")); return false; }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Cron authenticates with CRON_SECRET; admin/manual runs may use the service
  // role key (already all-powerful) — both are accepted.
  const cronSecret = Deno.env.get("CRON_SECRET");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const auth = req.headers.get("Authorization") ?? "";
  const authorized =
    (cronSecret && auth === `Bearer ${cronSecret}`) ||
    (serviceKey && auth === `Bearer ${serviceKey}`);
  if (!authorized) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not set" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const body = await req.json().catch(() => ({}));

  // Test mode: send one sample email to the given address, no DB writes.
  if (body?.test_to) {
    const { subject, html } = reminderCopy(7, "Eurogym Olomouc (TEST)", fmtDate(new Date(Date.UTC(2027, 6, 20))));
    const ok = await sendEmail(apiKey, body.test_to, subject, html);
    return new Response(JSON.stringify({ test: true, to: body.test_to, sent: ok }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const now = new Date();
  const horizon = new Date(now.getTime() + 8 * 86_400_000).toISOString();

  // Active subscriptions renewing within the next ~8 days that will NOT be
  // auto-charged: no active Stripe subscription (grandfathered / manual /
  // invoice). Gyms with a card (stripe_subscription_id set) renew via Stripe,
  // which sends its own receipts and dunning — they must NOT get this nudge.
  const { data: subs, error } = await supabase
    .from("gym_subscriptions")
    .select("id, gym_id, plan_id, current_period_end, status")
    .eq("status", "active")
    .is("stripe_subscription_id", null)
    .not("current_period_end", "is", null)
    .lte("current_period_end", horizon);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: { gym_id: string; days: number; sent: boolean }[] = [];

  for (const sub of subs ?? []) {
    const pe = new Date(sub.current_period_end as string);
    const d = daysUntil(pe, now);
    // Pick the matching threshold (0 also fires when already slightly past).
    const threshold = THRESHOLDS.find((t) => (t === 0 ? d <= 0 : d === t));
    if (threshold === undefined) continue;

    // Dedup: already sent this threshold for this period end?
    const { data: existing } = await supabase
      .from("subscription_renewal_reminders")
      .select("id")
      .eq("subscription_id", sub.id)
      .eq("period_end", sub.current_period_end)
      .eq("days_before", threshold)
      .maybeSingle();
    if (existing) continue;

    // Owner email.
    const { data: gym } = await supabase
      .from("gyms").select("name, owner_id, contact_email").eq("id", sub.gym_id).maybeSingle();
    let email = gym?.contact_email as string | null;
    if (!email && gym?.owner_id) {
      const { data: u } = await supabase.auth.admin.getUserById(gym.owner_id as string);
      email = u?.user?.email ?? null;
    }
    if (!email) { results.push({ gym_id: sub.gym_id, days: threshold, sent: false }); continue; }

    const { subject, html } = reminderCopy(threshold, gym?.name ?? "vaši posilovnu", fmtDate(pe));
    const ok = await sendEmail(apiKey, email, subject, html);
    if (ok) {
      await supabase.from("subscription_renewal_reminders").insert({
        subscription_id: sub.id, gym_id: sub.gym_id, period_end: sub.current_period_end,
        days_before: threshold, email,
      });
    }
    results.push({ gym_id: sub.gym_id, days: threshold, sent: ok });
  }

  return new Response(JSON.stringify({ checked: (subs ?? []).length, sent: results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
