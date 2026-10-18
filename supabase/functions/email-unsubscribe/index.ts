import { createClient } from "npm:@supabase/supabase-js@2";
import { handleUnsubscribe } from "./handler.ts";

// Odhlášení z e-mailů Pumpla (F0, 18. 10. 2026). Logika je v handler.ts (testovaná vitestem).
//  GET  → jen textová nápověda, nic nemění (skenery odkazů v poště GET prefetchují).
//  POST ?u=<user_id>&t=<hmac> → odhlásí: RFC 8058 one-click z List-Unsubscribe-Post
//       nebo tlačítko na stránce https://app.pumplo.com/odhlasit.
// Veřejná funkce (verify_jwt = false) — autorizací je HMAC token (EMAIL_UNSUB_SECRET).
// Opakované odhlášení nic nepřepíše (zachová se první čas).

Deno.serve((req) =>
  handleUnsubscribe(req, {
    secret: Deno.env.get("EMAIL_UNSUB_SECRET") ?? "",
    unsubscribe: async (userId) => {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { error } = await supabase
        .from("user_profiles")
        .update({ email_unsubscribed_at: new Date().toISOString() })
        .eq("user_id", userId)
        .is("email_unsubscribed_at", null);
      if (error) console.error("unsubscribe update failed", error.message);
      return { error: error?.message ?? null };
    },
  })
);
