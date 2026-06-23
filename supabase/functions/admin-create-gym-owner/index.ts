import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const schema = z.object({
  gym_id: z.string().uuid("Neplatné ID posilovny"),
  email: z.string().email("Neplatný formát emailu").max(255),
  // Where the invite "set password" link should land (admin app /reset-password)
  redirect_to: z.string().url().max(500).optional(),
});

// Safe error response helper - logs details server-side only
function safeErrorResponse(message: string, status: number, internalError?: unknown): Response {
  if (internalError) {
    console.error("Internal error details:", internalError);
  }
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

const RESEND_FROM = "Pumplo <zpravy@pumplo.com>";

function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Sends the gym owner their "set password" link via Resend. Returns true on success.
async function sendOwnerInviteEmail(to: string, gymName: string, actionLink: string): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.error("RESEND_API_KEY not set — cannot send invite email");
    return false;
  }
  const safeGym = escapeHtml(gymName);
  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
      <h2 style="margin:0 0 16px">Vítejte v Pumplu</h2>
      <p style="margin:0 0 16px;line-height:1.5">
        Byl vám vytvořen účet majitele pro posilovnu <strong>${safeGym}</strong>.
        Klikněte na tlačítko níže, nastavte si heslo a přihlaste se do svého administrátorského rozhraní.
      </p>
      <p style="margin:0 0 24px">
        <a href="${actionLink}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">
          Nastavit heslo
        </a>
      </p>
      <p style="margin:0 0 8px;font-size:13px;color:#555;line-height:1.5">
        Pokud tlačítko nefunguje, zkopírujte do prohlížeče tento odkaz:
      </p>
      <p style="margin:0 0 24px;font-size:12px;color:#2563eb;word-break:break-all">${actionLink}</p>
      <p style="margin:0;font-size:12px;color:#888">
        Pokud jste o tento účet nežádali, tento e-mail ignorujte.
      </p>
    </div>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: RESEND_FROM,
      to,
      subject: "Pumplo – nastavte si heslo k účtu majitele",
      html,
    }),
  });
  if (!res.ok) {
    console.error("Resend error", res.status, await res.text().catch(() => ""));
    return false;
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return safeErrorResponse("Chybí autorizace", 401);
    }

    // Verify the caller is an admin (super_admin = 'admin' role in user_roles)
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callingUser }, error: userError } = await userClient.auth.getUser();
    if (userError || !callingUser) {
      return safeErrorResponse("Neplatná autorizace", 401, userError);
    }

    const { data: roleData } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callingUser.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return safeErrorResponse("Přístup zamítnut – vyžaduje se admin role", 403);
    }

    // Parse and validate input
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return safeErrorResponse("Neplatný JSON vstup", 400);
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return safeErrorResponse(firstError?.message || "Neplatné vstupní údaje", 400);
    }

    const { gym_id, email, redirect_to } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();
    // Fallback redirect if the caller didn't pass one.
    const redirectTo = redirect_to ?? "https://admin.pumplo.com/reset-password";

    // Admin client with service role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify the gym exists
    const { data: gym, error: gymError } = await adminClient
      .from("gyms")
      .select("id, name")
      .eq("id", gym_id)
      .single();

    if (gymError || !gym) {
      return safeErrorResponse("Posilovna nenalezena", 404, gymError);
    }

    // --- Generate the set-password link ----------------------------------
    // We DON'T rely on Supabase's built-in auth mailer (rate-limited, dev-only).
    // Instead we generate the action link ourselves and deliver it via Resend
    // (verified pumplo.com domain), so delivery is reliable for both brand-new
    // and already-existing accounts.
    let ownerId: string | null = null;
    let invited = false;
    let actionLink: string | null = null;

    // Try an invite link first (creates the user if it doesn't exist yet).
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin
      .generateLink({
        type: "invite",
        email: normalizedEmail,
        options: { redirectTo },
      });

    if (inviteError) {
      // User already exists — generate a recovery link instead so the existing
      // account can (re)set a password and be promoted to gym owner.
      const { data: recoveryData, error: recoveryError } = await adminClient.auth.admin
        .generateLink({
          type: "recovery",
          email: normalizedEmail,
          options: { redirectTo },
        });
      if (recoveryError || !recoveryData) {
        return safeErrorResponse("Nepodařilo se vytvořit odkaz pro nastavení hesla", 500, recoveryError ?? inviteError);
      }
      ownerId = recoveryData.user?.id ?? null;
      actionLink = recoveryData.properties?.action_link ?? null;
    } else {
      ownerId = inviteData.user?.id ?? null;
      actionLink = inviteData.properties?.action_link ?? null;
      invited = true;
    }

    if (!ownerId || !actionLink) {
      return safeErrorResponse("Nepodařilo se získat ID majitele", 500);
    }

    // --- Deliver the link via Resend -------------------------------------
    const emailSent = await sendOwnerInviteEmail(normalizedEmail, gym.name, actionLink);
    if (!emailSent) {
      return safeErrorResponse("Účet byl vytvořen, ale e-mail s odkazem se nepodařilo odeslat", 502);
    }

    // --- Set the 'business' (gym owner) role -----------------------------
    // user_roles row is normally seeded by a trigger on auth user creation.
    // Upsert to be safe whether the row exists or not.
    const { error: roleUpsertError } = await adminClient
      .from("user_roles")
      .upsert({ user_id: ownerId, role: "business" }, { onConflict: "user_id" });

    if (roleUpsertError) {
      console.error("Error setting business role:", roleUpsertError);
      // Fall back to update in case onConflict target differs
      await adminClient
        .from("user_roles")
        .update({ role: "business" })
        .eq("user_id", ownerId);
    }

    // --- Link the gym to the owner ---------------------------------------
    const { error: gymUpdateError } = await adminClient
      .from("gyms")
      .update({ owner_id: ownerId })
      .eq("id", gym_id);

    if (gymUpdateError) {
      return safeErrorResponse("Nepodařilo se přiřadit posilovnu majiteli", 500, gymUpdateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        owner_id: ownerId,
        gym_id,
        email: normalizedEmail,
        invited, // true = new invite email, false = recovery link for existing user
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return safeErrorResponse("Interní chyba serveru", 500, error);
  }
});
