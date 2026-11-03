import { createClient } from "npm:@supabase/supabase-js@2";
import { logContact } from "../_shared/contactLog.ts";
import { handleLoopsWebhook } from "./handler.ts";

// Loops webhook (19. 10. 2026). Logika v handler.ts (testovaná vitestem).
// Veřejná funkce (verify_jwt = false) — autorizací je podpis (LOOPS_WEBHOOK_SECRET,
// „Signing secret“ endpointu v Loops → Settings → Webhooks).

Deno.serve((req) => {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  return handleLoopsWebhook(req, {
    secret: Deno.env.get("LOOPS_WEBHOOK_SECRET") ?? "",
    storeEvent: async (e) => {
      const { error } = await supabase.from("email_events").insert({
        provider: "loops",
        svix_id: `loops:${e.webhookId}`,
        type: e.type,
        event_name: e.eventName,
        email: e.email,
        user_id: e.userId,
        message_id: e.messageId,
        payload: e.payload,
      });
      if (error?.code === "23505") return { error: null, duplicate: true };
      if (error) console.error("email_events insert failed", error.message);
      return { error: error?.message ?? null };
    },
    resolveUserId: async (userId, email) => {
      if (userId) {
        const { data } = await supabase.from("user_profiles").select("user_id").eq("user_id", userId).maybeSingle();
        if (data?.user_id) return data.user_id as string;
      }
      if (!email) return null;
      // Kontakt založil loops-sync → známe ho z loops_contacts (i když už není oslovitelný).
      const { data } = await supabase.from("loops_contacts").select("user_id").eq("email", email).limit(1).maybeSingle();
      return (data?.user_id as string | undefined) ?? null;
    },
    markUnsubscribed: async (userId, atIso) => {
      const { error } = await supabase
        .from("user_profiles")
        .update({ email_unsubscribed_at: atIso })
        .eq("user_id", userId)
        .is("email_unsubscribed_at", null);
      if (error) console.error("unsubscribe update failed", error.message);
      return { error: error?.message ?? null };
    },
    logEmailContact: (userId, type) => logContact(supabase, userId, "email", type),
    suppress: async (email, reason, note) => {
      const { error } = await supabase.from("email_suppressions").insert({ email, reason, note });
      if (error?.code === "23505") return { error: null };
      if (error) console.error("email_suppressions insert failed", error.message);
      return { error: error?.message ?? null };
    },
  });
});
