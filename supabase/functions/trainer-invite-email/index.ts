// Trenérská platforma: e-mail s pozvánkou klientovi (volá trenérská PWA po trainer_invite_client).
// POST { link_id } s JWT trenéra → ověří, že je to jeho pozvánka (status invited, vyplněný e-mail),
// a pošle přes Resend odkaz https://app.pumplo.com/trener/<invite_token>.
// NENASAZENO — deploy až po migraci 20261026_trainer_platform.
import { createClient } from "npm:@supabase/supabase-js@2";

const APP_INVITE_BASE = "https://app.pumplo.com/trener/";
const RESEND_FROM = "Pumplo <zpravy@pumplo.com>";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Admin / trenérská PWA. Další originy přes env TRAINER_ALLOWED_ORIGINS (čárkami).
const DEFAULT_ORIGINS = [
  "https://admin.pumplo.com",
  "https://pumplo-admin.vercel.app",
  "http://localhost:5173",
  "http://localhost:8080",
];
const allowedOrigins = (): string[] => {
  const extra = (Deno.env.get("TRAINER_ALLOWED_ORIGINS") ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  return [...DEFAULT_ORIGINS, ...extra];
};

const corsHeadersFor = (req: Request): Record<string, string> => {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = allowedOrigins();
  return {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
};

const json = (req: Request, body: unknown, status = 200, internalError?: unknown): Response => {
  if (internalError) console.error("trainer-invite-email:", internalError);
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersFor(req), "Content-Type": "application/json" },
  });
};

function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

async function sendInviteEmail(to: string, trainerName: string, link: string): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.error("RESEND_API_KEY not set — cannot send trainer invite email");
    return false;
  }
  const safeName = escapeHtml(trainerName);
  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
      <h2 style="margin:0 0 16px">Trenér ${safeName} tě zve do Pumpla</h2>
      <p style="margin:0 0 16px;line-height:1.5">
        <strong>${safeName}</strong> tě přidává mezi své klienty. V aplikaci Pumplo ti bude posílat
        tréninkové plány a uvidí, jak ti jde trénink. Trénovat můžeš dál, co si sám vybereš.
      </p>
      <p style="margin:0 0 24px">
        <a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">
          Přijmout pozvánku
        </a>
      </p>
      <p style="margin:0 0 8px;font-size:13px;color:#555;line-height:1.5">
        Pokud tlačítko nefunguje, otevři v telefonu tento odkaz:
      </p>
      <p style="margin:0 0 24px;font-size:12px;color:#2563eb;word-break:break-all">${link}</p>
      <p style="margin:0;font-size:12px;color:#888">
        Pokud trenéra neznáš, tento e-mail ignoruj — bez přijetí pozvánky se nic nestane.
      </p>
    </div>`;
  const text = `${trainerName} tě přidává mezi své klienty v aplikaci Pumplo.\n\nPřijmout pozvánku: ${link}\n\nPokud trenéra neznáš, tento e-mail ignoruj.`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: RESEND_FROM,
      to,
      subject: `${trainerName} tě zve do Pumpla`,
      html,
      text,
    }),
  });
  if (!res.ok) {
    console.error("Resend error", res.status, await res.text().catch(() => ""));
    return false;
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeadersFor(req) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(req, { error: "missing_authorization" }, 401);

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json(req, { error: "invalid_authorization" }, 401, userError);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json(req, { error: "invalid_json" }, 400);
    }
    const linkId = (body as { link_id?: unknown } | null)?.link_id;
    if (typeof linkId !== "string" || !UUID_RE.test(linkId)) {
      return json(req, { error: "invalid_link_id" }, 400);
    }

    // Service role: čteme bez RLS a vlastnictví ověřujeme ručně (trainer_user_id = volající).
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: link, error: linkError } = await adminClient
      .from("trainer_clients")
      .select("id, trainer_user_id, invite_email, invite_token, status")
      .eq("id", linkId)
      .maybeSingle();
    if (linkError) return json(req, { error: "lookup_failed" }, 500, linkError);
    // Cizí i neexistující pozvánka = 404 (neprozrazovat, že existuje).
    if (!link || link.trainer_user_id !== user.id) return json(req, { error: "not_found" }, 404);
    if (link.status !== "invited") return json(req, { error: "not_invited" }, 409);
    const email = typeof link.invite_email === "string" ? link.invite_email.trim() : "";
    if (!email) return json(req, { error: "no_email" }, 422);

    const { data: nameData, error: nameError } = await adminClient.rpc("trainer_display_name", { p_user: user.id });
    if (nameError) console.error("trainer_display_name failed:", nameError);
    const trainerName = (typeof nameData === "string" && nameData.trim()) ? nameData.trim() : "Tvůj trenér";

    const link_url = `${APP_INVITE_BASE}${link.invite_token}`;
    const sent = await sendInviteEmail(email, trainerName, link_url);
    if (!sent) return json(req, { error: "email_failed" }, 502);

    return json(req, { ok: true });
  } catch (error) {
    return json(req, { error: "internal_error" }, 500, error);
  }
});
