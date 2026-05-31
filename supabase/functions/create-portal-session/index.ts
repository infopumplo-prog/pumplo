import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@13.6.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let step = "init";
  try {
    step = "check-env";
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!supabaseUrl || !serviceKey || !stripeKey) {
      return jsonResponse(500, {
        step,
        error: "Missing env vars",
        has_url: !!supabaseUrl,
        has_service: !!serviceKey,
        has_stripe: !!stripeKey,
      });
    }

    step = "read-auth-header";
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(401, { step, error: "Missing Authorization header" });
    }

    step = "verify-jwt";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return jsonResponse(401, {
        step,
        error: "Unauthorized",
        detail: userError?.message || "no user in token",
      });
    }
    const user = userData.user;

    step = "parse-body";
    const body = await req.json().catch(() => ({}));
    const return_url = body?.return_url as string | undefined;

    step = "find-gym";
    const { data: gyms, error: gymError } = await supabaseAdmin
      .from("gyms")
      .select("id, name")
      .eq("owner_id", user.id);
    if (gymError) {
      return jsonResponse(500, { step, error: "Gym query failed", detail: gymError.message });
    }
    if (!gyms || gyms.length === 0) {
      return jsonResponse(404, {
        step,
        error: "Žádná posilovna nenalezena pro tento účet.",
        user_id: user.id,
      });
    }
    const gym = gyms[0];

    step = "find-subscription";
    const { data: subs, error: subError } = await supabaseAdmin
      .from("gym_subscriptions")
      .select("stripe_customer_id, is_grandfathered, status")
      .eq("gym_id", gym.id);
    if (subError) {
      return jsonResponse(500, { step, error: "Subscription query failed", detail: subError.message });
    }
    if (!subs || subs.length === 0) {
      return jsonResponse(404, {
        step,
        error: "Žádné aktivní předplatné.",
        gym_id: gym.id,
      });
    }
    const subscription = subs[0];

    if (subscription.is_grandfathered) {
      return jsonResponse(403, {
        step: "grandfathered-check",
        error: "Vaše předplatné je spravováno ručně. Pro změny kontaktujte podporu.",
        grandfathered: true,
      });
    }

    if (!subscription.stripe_customer_id) {
      return jsonResponse(404, {
        step: "stripe-customer-check",
        error: "Stripe zákazník neexistuje pro toto předplatné.",
        gym_id: gym.id,
      });
    }

    step = "stripe-portal-create";
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: return_url || "https://pumplo-admin.vercel.app/",
    });

    return jsonResponse(200, { url: session.url });
  } catch (err) {
    console.error(`Portal session error at step [${step}]:`, err);
    return jsonResponse(500, {
      step,
      error: err instanceof Error ? err.message : "Unknown error",
      stack: err instanceof Error ? err.stack?.split("\n").slice(0, 3).join(" | ") : undefined,
    });
  }
});
