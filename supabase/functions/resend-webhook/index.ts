import { createClient } from "npm:@supabase/supabase-js@2";
import { handleResendWebhook } from "./handler.ts";

// Resend webhook (F1 e-maily, 19. 10. 2026). Logika v handler.ts (testovaná vitestem).
// Veřejná funkce (verify_jwt = false) — autorizací je Svix podpis (RESEND_WEBHOOK_SECRET,
// „Signing secret“ webhooku v Resend dashboardu). Ukládá email_events; bounce a stížnost
// zapíše do email_suppressions, takže adresa už nedostane žádný e-mail z lifecycle-emails.

Deno.serve((req) => {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  return handleResendWebhook(req, {
    secret: Deno.env.get("RESEND_WEBHOOK_SECRET") ?? "",
    storeEvent: async (e) => {
      const { error } = await supabase.from("email_events").insert({
        svix_id: e.svixId,
        resend_id: e.resendId,
        type: e.type,
        email: e.email,
        payload: e.payload,
      });
      if (error?.code === "23505") return { error: null, duplicate: true };
      if (error) console.error("email_events insert failed", error.message);
      return { error: error?.message ?? null };
    },
    suppress: async (email, reason, note) => {
      const { error } = await supabase.from("email_suppressions").insert({ email, reason, note });
      if (error?.code === "23505") return { error: null }; // adresa už blokovaná
      if (error) console.error("email_suppressions insert failed", error.message);
      return { error: error?.message ?? null };
    },
  });
});
