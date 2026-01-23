import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generatePassword(length = 12): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
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
      return new Response(
        JSON.stringify({ error: "Chýba autorizácia" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the caller is an admin
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Neplatná autorizácia" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: roleData } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Prístup zamietnutý - vyžaduje sa admin rola" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client with service role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const { action, user_id, new_email, page = 1, per_page = 100 } = body;

    switch (action) {
      case "list_users": {
        // Get users from auth.users with pagination
        const { data: authUsers, error: authError } = await adminClient.auth.admin.listUsers({
          page,
          perPage: per_page,
        });

        if (authError) {
          console.error("Error fetching auth users:", authError);
          return new Response(
            JSON.stringify({ error: "Nepodarilo sa načítať užívateľov" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
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
        if (!user_id) {
          return new Response(
            JSON.stringify({ error: "Chýba user_id" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const newPassword = generatePassword(12);
        
        const { error: updateError } = await adminClient.auth.admin.updateUserById(user_id, {
          password: newPassword,
        });

        if (updateError) {
          console.error("Error resetting password:", updateError);
          return new Response(
            JSON.stringify({ error: "Nepodarilo sa resetovať heslo" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, new_password: newPassword }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "change_email": {
        if (!user_id || !new_email) {
          return new Response(
            JSON.stringify({ error: "Chýba user_id alebo new_email" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error: updateError } = await adminClient.auth.admin.updateUserById(user_id, {
          email: new_email,
          email_confirm: true,
        });

        if (updateError) {
          console.error("Error changing email:", updateError);
          return new Response(
            JSON.stringify({ error: updateError.message || "Nepodarilo sa zmeniť email" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: "Email bol úspešne zmenený" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Neznáma akcia" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Interná chyba servera" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
