import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.6.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const IMPLEMENTATION_FEE_PRICE_ID = 'price_1TLJJrEvdp2FxnFOcOEOOcAI';

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // --- Require an authenticated caller; trust the JWT, not the body ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Chybí autorizace" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Neplatná autorizace" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { price_id, gym_name, address, phone, machine_ids, success_url, cancel_url } =
      await req.json();
    const user_id = user.id; // verified identity, never trust a body-supplied user_id

    if (!price_id || !gym_name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Only allow Stripe price IDs that belong to an active plan ---
    // (stops a client from passing an arbitrary/cheaper price_id).
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const { data: plans } = await adminClient
      .from("subscription_plans")
      .select("stripe_price_monthly_id, stripe_price_annual_id")
      .eq("is_active", true);
    const allowedPrices = new Set<string>();
    for (const p of plans ?? []) {
      if (p.stripe_price_monthly_id) allowedPrices.add(p.stripe_price_monthly_id);
      if (p.stripe_price_annual_id) allowedPrices.add(p.stripe_price_annual_id);
    }
    if (!allowedPrices.has(price_id)) {
      return new Response(JSON.stringify({ error: "Neplatný plán" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create Stripe customer first (required for Accounts V2 in test mode)
    const customer = await stripe.customers.create({
      metadata: { user_id, gym_name },
    });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customer.id,
      payment_method_types: ["card"],
      line_items: [
        { price: price_id, quantity: 1 },
        { price: IMPLEMENTATION_FEE_PRICE_ID, quantity: 1 },
      ],
      success_url: success_url || "https://pumplo-admin.vercel.app/login?checkout=success",
      cancel_url: cancel_url || "https://pumplo-admin.vercel.app/register?checkout=cancelled",
      metadata: {
        user_id,
        gym_name,
        address: address || "",
        phone: phone || "",
        machine_ids: machine_ids ? JSON.stringify(machine_ids) : "[]",
      },
      subscription_data: {
        metadata: {
          user_id,
          gym_name,
        },
      },
    });

    return new Response(
      JSON.stringify({ url: session.url, session_id: session.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Checkout error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
