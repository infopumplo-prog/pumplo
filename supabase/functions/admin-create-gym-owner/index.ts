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

    // --- Find or create the owner auth user ------------------------------
    let ownerId: string | null = null;
    let invited = false;

    // Send an invite (creates the user if it doesn't exist yet) with a link
    // that lands on the admin app where the owner sets their password.
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin
      .inviteUserByEmail(normalizedEmail, redirect_to ? { redirectTo: redirect_to } : undefined);

    if (inviteError) {
      // User probably already exists — look them up and (re)send a recovery link
      // so an existing account can still be promoted to gym owner.
      const { data: list } = await adminClient.auth.admin.listUsers();
      const existing = list?.users?.find(
        (u) => u.email?.toLowerCase() === normalizedEmail,
      );
      if (!existing) {
        return safeErrorResponse("Nepodařilo se odeslat pozvánku", 500, inviteError);
      }
      ownerId = existing.id;

      // Generate a recovery link so the existing user can (re)set a password.
      const { error: linkError } = await adminClient.auth.admin.generateLink({
        type: "recovery",
        email: normalizedEmail,
        options: redirect_to ? { redirectTo: redirect_to } : undefined,
      });
      if (linkError) {
        console.error("generateLink error:", linkError);
      }
    } else {
      ownerId = inviteData.user?.id ?? null;
      invited = true;
    }

    if (!ownerId) {
      return safeErrorResponse("Nepodařilo se získat ID majitele", 500);
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
