import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.6.0?target=deno";

const IMPLEMENTATION_FEE_PRICE_ID = 'price_1TLJJrEvdp2FxnFOcOEO0cAI';

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
    const { price_id, user_id, gym_name, address, phone, machine_ids, success_url, cancel_url } =
      await req.json();

    if (!price_id || !user_id || !gym_name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
