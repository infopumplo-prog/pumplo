import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const createUserSchema = z.object({
  email: z.string().email("Neplatný formát emailu").max(255),
  password: z.string().min(6, "Heslo musí mať aspoň 6 znakov").max(72),
  first_name: z.string().max(100).optional().nullable(),
  last_name: z.string().max(100).optional().nullable(),
  role: z.enum(["user", "business", "admin"]).optional().default("user"),
  gym_license_count: z.number().int().positive().max(100).optional().default(1),
});

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
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return safeErrorResponse('Chýba autorizácia', 401);
    }

    // Create Supabase client with user's token to verify admin status
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify the calling user is an admin
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user: callingUser }, error: userError } = await userClient.auth.getUser();
    if (userError || !callingUser) {
      return safeErrorResponse('Neplatná autorizácia', 401, userError);
    }

    // Check if calling user is admin
    const { data: roleData, error: roleError } = await userClient
      .from('user_roles')
      .select('role')
      .eq('user_id', callingUser.id)
      .single();

    if (roleError || roleData?.role !== 'admin') {
      return safeErrorResponse('Nemáte oprávnenie vytvárať používateľov', 403, roleError);
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return safeErrorResponse('Neplatný JSON vstup', 400);
    }

    const validationResult = createUserSchema.safeParse(body);
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      return safeErrorResponse(
        firstError?.message || 'Neplatné vstupné údaje',
        400
      );
    }

    const { email, password, first_name, last_name, role, gym_license_count } = validationResult.data;

    // Create admin client with service role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Create the user
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        first_name: first_name || null,
        last_name: last_name || null,
      }
    });

    if (createError) {
      // Map common errors to safe messages
      if (createError.message?.includes('already registered')) {
        return safeErrorResponse('Používateľ s týmto emailom už existuje', 400, createError);
      }
      return safeErrorResponse('Nepodarilo sa vytvoriť používateľa', 500, createError);
    }

    if (!newUser.user) {
      return safeErrorResponse('Nepodarilo sa vytvoriť používateľa', 500);
    }

    // Update user_profiles with first_name, last_name, and gym_license_count
    const profileUpdate: Record<string, unknown> = {
      first_name: first_name || null,
      last_name: last_name || null,
    };

    if (role === 'business') {
      profileUpdate.gym_license_count = gym_license_count;
    }

    const { error: profileError } = await adminClient
      .from('user_profiles')
      .update(profileUpdate)
      .eq('user_id', newUser.user.id);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      // Don't fail the request, user is already created
    }

    // Update user role if not 'user' (default)
    if (role && role !== 'user') {
      const { error: roleUpdateError } = await adminClient
        .from('user_roles')
        .update({ role })
        .eq('user_id', newUser.user.id);

      if (roleUpdateError) {
        console.error('Error updating role:', roleUpdateError);
        // Don't fail the request, user is already created
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: {
          id: newUser.user.id,
          email: newUser.user.email,
          first_name,
          last_name,
          role
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return safeErrorResponse('Interná chyba servera', 500, error);
  }
});
