import { createClient } from "npm:@supabase/supabase-js@2";
import { isUuid, verifyUnsubToken } from "../_shared/emailUnsubToken.ts";

// Odhlášení z e-mailů Pumpla (F0, 18. 10. 2026).
//  GET  ?u=<user_id>&t=<hmac>  → nastaví user_profiles.email_unsubscribed_at a ukáže
//                                krátké potvrzení (odkaz z patičky e-mailu).
//  POST ?u=<user_id>&t=<hmac>  → RFC 8058 one-click (hlavička List-Unsubscribe-Post:
//                                List-Unsubscribe=One-Click), odpověď 200 bez obsahu.
// Veřejná funkce (verify_jwt = false) — autorizací je HMAC token (EMAIL_UNSUB_SECRET).
//
// Potvrzení je text/plain: Supabase na doméně *.supabase.co servíruje HTML z edge
// funkcí jako text/plain, takže HTML stránka by se ukázala jako zdroják.
// Opakované odhlášení nic nepřepíše (zachová se první čas).

const TEXT_OK =
  "Hotovo, e-maily od Pumpla ti už chodit nebudou.\n\n" +
  "E-maily k přihlášení a obnově hesla dál fungují. Zpátky je zapneš v aplikaci: Nastavení → Oznámení → E-maily s tipy.\n\n" +
  "Done, you will no longer receive e-mails from Pumplo. Login and password e-mails still work.\n\n" +
  "GynTools CZ s.r.o., IČ 27804461 · info@pumplo.com\n";

const TEXT_BAD =
  "Odkaz pro odhlášení je neplatný nebo neúplný. Napiš nám na info@pumplo.com a odhlásíme tě ručně.\n\n" +
  "This unsubscribe link is invalid. Write to info@pumplo.com and we will unsubscribe you.\n";

const TEXT_ERR =
  "Odhlášení se teď nepovedlo. Zkus to prosím za chvíli, nebo napiš na info@pumplo.com.\n";

const textResponse = (body: string, status = 200) =>
  new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });

async function readParams(req: Request): Promise<{ u: string | null; t: string | null }> {
  const url = new URL(req.url);
  let u = url.searchParams.get("u");
  let t = url.searchParams.get("t");
  // One-click POST nese parametry v URL; formulář je může poslat i v těle.
  if (req.method === "POST" && (!u || !t)) {
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
      const form = await req.formData().catch(() => null);
      u = u ?? (form?.get("u")?.toString() ?? null);
      t = t ?? (form?.get("t")?.toString() ?? null);
    }
  }
  return { u, t };
}

Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(null, { status: 405, headers: { Allow: "GET, POST" } });
  }

  const secret = Deno.env.get("EMAIL_UNSUB_SECRET") ?? "";
  if (secret.length < 16) {
    console.error("EMAIL_UNSUB_SECRET missing or too short");
    return textResponse(TEXT_ERR, 500);
  }

  const { u, t } = await readParams(req);
  if (!isUuid(u) || !(await verifyUnsubToken(u, t, secret))) {
    return textResponse(TEXT_BAD, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Jen když ještě odhlášený není — první čas odhlášení zůstává.
  const { error } = await supabase
    .from("user_profiles")
    .update({ email_unsubscribed_at: new Date().toISOString() })
    .eq("user_id", u)
    .is("email_unsubscribed_at", null);

  if (error) {
    console.error("unsubscribe update failed", error.message);
    return textResponse(TEXT_ERR, 500);
  }

  if (req.method === "POST") return new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } });
  return textResponse(TEXT_OK);
});
