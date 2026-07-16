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

    const {
      price_id,
      gym_name,
      address,
      phone,
      machine_ids,
      success_url,
      cancel_url,
      additional_gym,
      activate_gym_ids,
    }: {
      price_id?: string;
      gym_name?: string;
      address?: string;
      phone?: string;
      machine_ids?: string[];
      success_url?: string;
      cancel_url?: string;
      additional_gym?: boolean;
      activate_gym_ids?: string[];
    } = await req.json();
    const user_id = user.id; // verified identity, never trust a body-supplied user_id

    // Two mutually exclusive flows:
    //  - activate flow: attach a subscription (one item per gym) to gyms that
    //    already exist but have no subscription yet (e.g. NextGen / Pavel).
    //  - gym_name flow (original): buy a subscription for a brand-new gym.
    const isActivateFlow = Array.isArray(activate_gym_ids) && activate_gym_ids.length > 0;

    if (!price_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!isActivateFlow && !gym_name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // --- Only allow Stripe price IDs that belong to an active plan ---
    // (stops a client from passing an arbitrary/cheaper price_id).
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

    // Existing paying customer (any active subscription on one of their gyms):
    // reuse their Stripe customer so all their gyms bill on one customer.
    // Server-side check — the client's `additional_gym` flag alone is not trusted.
    let existingCustomerId: string | null = null;
    const { data: ownedGyms } = await adminClient
      .from("gyms").select("id").eq("owner_id", user_id);
    const ownedGymIds = new Set((ownedGyms ?? []).map((g: { id: string }) => g.id));
    if (ownedGyms && ownedGyms.length > 0) {
      const { data: activeSub } = await adminClient
        .from("gym_subscriptions")
        .select("stripe_customer_id")
        .in("gym_id", ownedGyms.map((g: { id: string }) => g.id))
        .eq("status", "active")
        .not("stripe_customer_id", "is", null)
        .limit(1)
        .maybeSingle();
      existingCustomerId = activeSub?.stripe_customer_id ?? null;
    }

    let lineItems: { price: string; quantity: number }[];
    let metadata: Record<string, string>;

    if (isActivateFlow) {
      // Verify every gym id belongs to the authenticated owner.
      const ids = activate_gym_ids!;
      const allOwned = ids.every((id) => ownedGymIds.has(id));
      if (!allOwned) {
        return new Response(JSON.stringify({ error: "Posilovna nepatří tomuto účtu." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Stripe forbids duplicate recurring prices — one line item, quantity = gym count.
      // One-time implementation fee per gym being activated.
      lineItems = [
        { price: price_id, quantity: ids.length },
        { price: IMPLEMENTATION_FEE_PRICE_ID, quantity: ids.length },
      ];
      metadata = {
        user_id,
        activate_gym_ids: ids.join(","),
      };
    } else {
      // Every new gym pays the one-time implementation fee (500 CZK).
      lineItems = [
        { price: price_id, quantity: 1 },
        { price: IMPLEMENTATION_FEE_PRICE_ID, quantity: 1 },
      ];
      metadata = {
        user_id,
        gym_name: gym_name!,
        address: address || "",
        phone: phone || "",
        machine_ids: machine_ids ? JSON.stringify(machine_ids) : "[]",
        additional_gym: additional_gym ? "true" : "",
      };
    }

    const customerId = existingCustomerId ??
      (await stripe.customers.create({
        metadata: { user_id, ...(gym_name ? { gym_name } : {}) },
      })).id;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      payment_method_types: ["card"],
      line_items: lineItems,
      // Discounts are entered by the customer as promo codes in checkout
      // (e.g. NEXTGEN500). Its coupon is restricted to plan products, so it
      // never touches the implementation fee.
      allow_promotion_codes: true,
      success_url: success_url || "https://pumplo-admin.vercel.app/login?checkout=success",
      cancel_url: cancel_url || "https://pumplo-admin.vercel.app/register?checkout=cancelled",
      metadata,
      subscription_data: {
        metadata: {
          user_id,
          ...(gym_name ? { gym_name } : {}),
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
