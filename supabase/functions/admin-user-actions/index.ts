import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Secure password generation using Web Crypto API
function generatePassword(length = 16): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  const randomValues = new Uint32Array(length);
  crypto.getRandomValues(randomValues);
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(randomValues[i] % chars.length);
  }
  return password;
}

// Input validation schemas
const listUsersSchema = z.object({
  action: z.literal("list_users"),
  page: z.number().int().positive().optional().default(1),
  per_page: z.number().int().positive().max(1000).optional().default(100),
});

const resetPasswordSchema = z.object({
  action: z.literal("reset_password"),
  user_id: z.string().uuid("Neplatné ID používateľa"),
});

const changeEmailSchema = z.object({
  action: z.literal("change_email"),
  user_id: z.string().uuid("Neplatné ID používateľa"),
  new_email: z.string().email("Neplatný formát emailu").max(255),
});

const deleteUserSchema = z.object({
  action: z.literal("delete_user"),
  user_id: z.string().uuid("Neplatné ID používateľa"),
});

const actionSchema = z.discriminatedUnion("action", [
  listUsersSchema,
  resetPasswordSchema,
  changeEmailSchema,
  deleteUserSchema,
]);

// Safe error response helper - logs details server-side only
function safeErrorResponse(
  message: string, 
  status: number, 
  internalError?: unknown
): Response {
  if (internalError) {
    console.error("Internal error details:", internalError);
  }
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
      return safeErrorResponse("Chýba autorizácia", 401);
    }

    // Verify the caller is an admin
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return safeErrorResponse("Neplatná autorizácia", 401, userError);
    }

    const { data: roleData } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return safeErrorResponse("Prístup zamietnutý - vyžaduje sa admin rola", 403);
    }

    // Parse and validate input
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return safeErrorResponse("Neplatný JSON vstup", 400);
    }

    const validationResult = actionSchema.safeParse(body);
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      return safeErrorResponse(
        firstError?.message || "Neplatné vstupné údaje",
        400
      );
    }

    const validatedData = validationResult.data;

    // Create admin client with service role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    switch (validatedData.action) {
      case "list_users": {
        const { page, per_page } = validatedData;
        
        // Get users from auth.users with pagination
        const { data: authUsers, error: authError } = await adminClient.auth.admin.listUsers({
          page,
          perPage: per_page,
        });

        if (authError) {
          return safeErrorResponse("Nepodarilo sa načítať užívateľov", 500, authError);
        }

        // Get profiles
        const { data: profiles, error: profilesError } = await userClient
          .from("user_profiles")
          .select("*");

        if (profilesError) {
          console.error("Error fetching profiles:", profilesError);
        }

        // Get roles
        const { data: roles, error: rolesError } = await userClient
          .from("user_roles")
          .select("user_id, role");

        if (rolesError) {
          console.error("Error fetching roles:", rolesError);
        }

        // Merge data
        const users = authUsers.users.map((authUser) => {
          const profile = profiles?.find((p) => p.user_id === authUser.id);
          const userRole = roles?.find((r) => r.user_id === authUser.id);

          return {
            id: profile?.id || authUser.id,
            user_id: authUser.id,
            email: authUser.email,
            first_name: profile?.first_name || authUser.user_metadata?.first_name || null,
            last_name: profile?.last_name || authUser.user_metadata?.last_name || null,
            age: profile?.age || null,
            gender: profile?.gender || null,
            onboarding_completed: profile?.onboarding_completed || false,
            created_at: authUser.created_at,
            role: userRole?.role || "user",
            gym_license_count: profile?.gym_license_count || 1,
          };
        });

        return new Response(
          JSON.stringify({ 
            users, 
            total: authUsers.users.length,
            page,
            per_page 
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "reset_password": {
        const { user_id } = validatedData;
        const newPassword = generatePassword(16);
        
        const { error: updateError } = await adminClient.auth.admin.updateUserById(user_id, {
          password: newPassword,
        });

        if (updateError) {
          return safeErrorResponse("Nepodarilo sa resetovať heslo", 500, updateError);
        }

        return new Response(
          JSON.stringify({ success: true, new_password: newPassword }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "change_email": {
        const { user_id, new_email } = validatedData;

        const { error: updateError } = await adminClient.auth.admin.updateUserById(user_id, {
          email: new_email,
          email_confirm: true,
        });

        if (updateError) {
          return safeErrorResponse("Nepodarilo sa zmeniť email", 500, updateError);
        }

        return new Response(
          JSON.stringify({ success: true, message: "Email bol úspešne zmenený" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "delete_user": {
        const { user_id } = validatedData;

        // Delete from auth.users (this will cascade to user_profiles and user_roles via triggers)
        const { error: deleteError } = await adminClient.auth.admin.deleteUser(user_id);

        if (deleteError) {
          return safeErrorResponse("Nepodarilo sa odstrániť používateľa", 500, deleteError);
        }

        return new Response(
          JSON.stringify({ success: true, message: "Používateľ bol úspešne odstránený" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return safeErrorResponse("Neznáma akcia", 400);
    }
  } catch (error) {
    return safeErrorResponse("Interná chyba servera", 500, error);
  }
});
