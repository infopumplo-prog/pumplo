import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.6.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const IMPLEMENTATION_FEE_PRICE_ID = 'price_1TLJJrEvdp2FxnFOcOEOOcAI';

// Zakladatelská nabídka (founder offer): 50% off coupon, duration "once",
// restricted at the Stripe dashboard level to the Neomezený (premium) product.
// TODO: replace with the real coupon id once David creates it in Stripe
// (see docs/superpowers/plans/2026-07-28-zakladatelska-nabidka.md).
// Zakladatelská nabídka: 50 % once, omezený na produkt Neomezeného
// (prod_UJbAeLUTiTMxYH / "Pumplo Premium") — to omezení je zásadní, jinak by
// sleva sáhla i na jednorázový poplatek za Pumplo kit. Ověřitelné jen
// v dashboardu; restricted klíče pole applies_to v odpovědi nevracejí.
const FOUNDER_COUPON_ID = 'xzEIf1AW';

// Zakladatelská nabídka registration deadline: end of day 31.12.2026,
// Europe/Prague (CET, UTC+1 — no DST that late in the year). Enforced here
// server-side so the offer can't outlive its dates even if someone forgets
// to unpublish/disable the Stripe price or coupon.
const FOUNDER_OFFER_DEADLINE = new Date('2026-12-31T22:59:59.999Z');

// Reservation TTL for founder_offer_claims: matches Stripe Checkout's own
// default session expiry (24h) for subscription-mode sessions, so a claim
// only outlives a genuinely abandoned checkout, never a live one.
const FOUNDER_CLAIM_TTL_MS = 24 * 60 * 60 * 1000;

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Server-side-only eligibility check for the zakladatelská nabídka (founder
// offer): true only when the owner has NO row at all in gym_subscriptions
// (any status, including cancelled) for any gym they own. A client passing
// founder_offer: true never proves entitlement — this is the sole source of
// truth. Fails closed (false) on any query error.
// deno-lint-ignore no-explicit-any
async function isEligibleForFounderOffer(
  adminClient: any,
  userId: string,
): Promise<boolean> {
  const { data: ownedGyms, error: gymsError } = await adminClient
    .from("gyms")
    .select("id")
    .eq("owner_id", userId);
  if (gymsError) {
    console.error("isEligibleForFounderOffer: gyms query failed:", gymsError);
    return false;
  }
  const gymIds = (ownedGyms ?? []).map((g: { id: string }) => g.id);
  if (gymIds.length === 0) return true;

  const { data: subs, error: subsError } = await adminClient
    .from("gym_subscriptions")
    .select("id")
    .in("gym_id", gymIds)
    .limit(1);
  if (subsError) {
    console.error("isEligibleForFounderOffer: gym_subscriptions query failed:", subsError);
    return false;
  }
  return (subs ?? []).length === 0;
}

// Atomic reservation for the founder offer. isEligibleForFounderOffer() alone
// is a TOCTOU race: for a brand-new user, gym_subscriptions is empty (the gym
// doesn't exist until the webhook fires), so two concurrent create-checkout
// calls for the same new registration would both read "eligible". The
// founder_offer_claims.user_id PRIMARY KEY is what actually makes this safe —
// only the first of two concurrent inserts can succeed.
//
// A stale claim (older than FOUNDER_CLAIM_TTL_MS, matching Stripe Checkout's
// own 24h session default) is reclaimable so an abandoned checkout doesn't
// permanently lock a user out of an offer they never completed. The reclaim
// UPDATE is itself race-safe: its WHERE clause re-checks staleness against
// the committed row, so only one of two concurrent reclaim attempts can win.
// deno-lint-ignore no-explicit-any
async function reserveFounderOfferClaim(
  adminClient: any,
  userId: string,
): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const { error: insertError } = await adminClient
    .from("founder_offer_claims")
    .insert({ user_id: userId, claimed_at: nowIso });
  if (!insertError) return true;

  // Insert failed — most likely a PK conflict (an existing claim). Only
  // reclaim it if it's stale; otherwise this is a genuine second attempt.
  const staleThresholdIso = new Date(Date.now() - FOUNDER_CLAIM_TTL_MS).toISOString();
  const { data: reclaimed, error: reclaimError } = await adminClient
    .from("founder_offer_claims")
    .update({ claimed_at: nowIso, checkout_session_id: null })
    .eq("user_id", userId)
    .lt("claimed_at", staleThresholdIso)
    .select("user_id");
  if (reclaimError) {
    console.error("reserveFounderOfferClaim: reclaim query failed:", reclaimError);
    return false;
  }
  return (reclaimed ?? []).length > 0;
}

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
      founder_offer,
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
      founder_offer?: boolean;
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
      .select("stripe_price_monthly_id, stripe_price_annual_id, stripe_price_quarterly_id")
      .eq("is_active", true);
    const allowedPrices = new Set<string>();
    const quarterlyPrices = new Set<string>();
    for (const p of plans ?? []) {
      if (p.stripe_price_monthly_id) allowedPrices.add(p.stripe_price_monthly_id);
      if (p.stripe_price_annual_id) allowedPrices.add(p.stripe_price_annual_id);
      if (p.stripe_price_quarterly_id) {
        allowedPrices.add(p.stripe_price_quarterly_id);
        quarterlyPrices.add(p.stripe_price_quarterly_id);
      }
    }
    // V aktivačním toku povol i cenu SKRYTÉHO plánu, který mají aktivované
    // posilovny přiřazený (custom deal, např. NextGen 1000 Kč / is_active=false).
    // Ochrana proti podstrčení cizí/levnější ceny zůstává — bereme jen plány
    // reálně přiřazené právě těmto pobočkám daného vlastníka.
    if (isActivateFlow) {
      const { data: assigned } = await adminClient
        .from("gym_subscriptions")
        .select("subscription_plans(stripe_price_monthly_id, stripe_price_annual_id, stripe_price_quarterly_id)")
        .in("gym_id", activate_gym_ids!);
      for (const row of assigned ?? []) {
        const p = (row as { subscription_plans?: { stripe_price_monthly_id?: string; stripe_price_annual_id?: string; stripe_price_quarterly_id?: string } }).subscription_plans;
        if (!p) continue;
        if (p.stripe_price_monthly_id) allowedPrices.add(p.stripe_price_monthly_id);
        if (p.stripe_price_annual_id) allowedPrices.add(p.stripe_price_annual_id);
        if (p.stripe_price_quarterly_id) allowedPrices.add(p.stripe_price_quarterly_id);
      }
    }
    if (!allowedPrices.has(price_id)) {
      return new Response(JSON.stringify({ error: "Neplatný plán" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- Zakladatelská nabídka (founder offer) eligibility gate ---
    // Nárok se ověřuje VÝHRADNĚ serverově — klient smí jen požádat o nabídku,
    // nikdy si ji sám nevynutí. Nabídka je vyloučená z activate/additional_gym
    // flow (to je právě ten gaming vektor, který toto pravidlo blokuje) a
    // platí jen na čtvrtletní cenu Neomezeného.
    const founderOfferRequested = founder_offer === true;
    // Tracks whether this request holds a founder_offer_claims reservation —
    // used later to release it if session creation fails, and to attach the
    // real session id once we have one.
    let founderClaimReserved = false;
    if (founderOfferRequested) {
      if (Date.now() > FOUNDER_OFFER_DEADLINE.getTime()) {
        return new Response(JSON.stringify({ error: "Zakladatelská nabídka skončila 31. 12. 2026." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (isActivateFlow || additional_gym) {
        return new Response(JSON.stringify({ error: "Zakladatelská nabídka je jen pro první posilovnu." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!quarterlyPrices.has(price_id)) {
        return new Response(JSON.stringify({ error: "Zakladatelská nabídka platí jen pro čtvrtletní cenu Neomezeného plánu." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const eligible = await isEligibleForFounderOffer(adminClient, user_id);
      if (!eligible) {
        return new Response(JSON.stringify({ error: "Zakladatelská nabídka je jen pro první posilovnu." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Atomic reservation — closes the TOCTOU race above (isEligibleForFounderOffer
      // reads an empty gym_subscriptions for a brand-new user, so two concurrent
      // requests could otherwise both pass it).
      const reserved = await reserveFounderOfferClaim(adminClient, user_id);
      if (!reserved) {
        return new Response(JSON.stringify({ error: "Zakladatelská nabídka je jen pro první posilovnu." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      founderClaimReserved = true;
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
        ...(founderOfferRequested ? { founder_offer: "true" } : {}),
      };
    }

    // Everything from here through session creation is wrapped so that ANY
    // failure (customer creation, not just session creation) releases a held
    // founder_offer_claims reservation — otherwise a transient Stripe error
    // between reservation and checkout would leak the claim for up to
    // FOUNDER_CLAIM_TTL_MS.
    let session: Stripe.Checkout.Session;
    try {
      const customerId = existingCustomerId ??
        (await stripe.customers.create({
          metadata: { user_id, ...(gym_name ? { gym_name } : {}) },
        })).id;

      // Stripe forbids passing both `discounts` and `allow_promotion_codes` on
      // the same Checkout Session, so the two paths are mutually exclusive.
      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        mode: "subscription",
        customer: customerId,
        payment_method_types: ["card"],
        line_items: lineItems,
        success_url: success_url || "https://pumplo-admin.vercel.app/login?checkout=success",
        cancel_url: cancel_url || "https://pumplo-admin.vercel.app/register?checkout=cancelled",
        metadata,
        subscription_data: {
          metadata: {
            user_id,
            ...(gym_name ? { gym_name } : {}),
          },
        },
      };

      if (founderOfferRequested) {
        // Founder coupon applies automatically — the implementation fee line
        // item above is a separate, non-discountable price so it stays full price.
        sessionParams.discounts = [{ coupon: FOUNDER_COUPON_ID }];
      } else {
        // Discounts are entered by the customer as promo codes in checkout
        // (e.g. NEXTGEN500). Its coupon is restricted to plan products, so it
        // never touches the implementation fee.
        sessionParams.allow_promotion_codes = true;
      }

      session = await stripe.checkout.sessions.create(sessionParams);
    } catch (err) {
      // Failed after we reserved the claim — release it so a transient
      // Stripe error doesn't permanently lock this user out of the offer
      // (the reclaim-on-staleness path would otherwise be the only way back
      // in, up to FOUNDER_CLAIM_TTL_MS later).
      if (founderClaimReserved) {
        const { error: releaseError } = await adminClient
          .from("founder_offer_claims")
          .delete()
          .eq("user_id", user_id);
        if (releaseError) {
          console.error("Failed to release founder_offer_claims after Stripe error:", releaseError);
        }
      }
      throw err;
    }

    if (founderClaimReserved) {
      // Best-effort — the claim already did its job (blocking concurrent
      // reservations); recording the session id here is only for observability.
      const { error: attachError } = await adminClient
        .from("founder_offer_claims")
        .update({ checkout_session_id: session.id })
        .eq("user_id", user_id);
      if (attachError) {
        console.error("Failed to attach session id to founder_offer_claims:", attachError);
      }
    }

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
