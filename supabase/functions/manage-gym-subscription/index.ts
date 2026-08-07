import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.6.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const IMPLEMENTATION_FEE_PRICE_ID = "price_1TLJJrEvdp2FxnFOcOEOOcAI";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map Stripe price IDs to plan IDs — kept in sync with stripe-webhook's map.
const PRICE_TO_PLAN: Record<string, { plan_id: string; period: string }> = {
  "price_1TshbKEvdp2FxnFOGJ5FHAsC": { plan_id: "start", period: "monthly" },
  "price_1TshbLEvdp2FxnFOaSD3uBaD": { plan_id: "start", period: "annual" },
  "price_1TshbLEvdp2FxnFO4UUBStkz": { plan_id: "premium", period: "monthly" },
  "price_1TshbLEvdp2FxnFOXQJlLdqb": { plan_id: "premium", period: "annual" },
  "price_1TshckEvdp2FxnFO5QO5zDFB": { plan_id: "start", period: "monthly" },
  "price_1TKxyrEvdp2FxnFO3TTdE9mS": { plan_id: "start", period: "monthly" },
  "price_1TKxysEvdp2FxnFOCXjuXt8g": { plan_id: "start", period: "annual" },
  "price_1TKxysEvdp2FxnFO4ImRp2gn": { plan_id: "profi", period: "monthly" },
  "price_1TKxysEvdp2FxnFOWAg03uG7": { plan_id: "profi", period: "annual" },
  "price_1TKxytEvdp2FxnFOpx9DiIw3": { plan_id: "premium", period: "monthly" },
  "price_1TKxytEvdp2FxnFOqbt8PhRo": { plan_id: "premium", period: "annual" },
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // --- Require an authenticated caller; trust the JWT, not the body ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(401, { error: "Chybí autorizace" });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return jsonResponse(401, { error: "Neplatná autorizace" });
    }
    const user_id = user.id;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const body: {
      action?: string;
      gym_name?: string;
      address?: string;
      phone?: string;
      price_id?: string;
      gym_id?: string;
      promo_code?: string;
    } = await req.json().catch(() => ({}));
    const action = body.action;

    // Prices allowed for add_gym / change_plan (only active plan prices).
    async function assertAllowedPrice(priceId: string): Promise<boolean> {
      const { data: plans } = await admin
        .from("subscription_plans")
        .select("stripe_price_monthly_id, stripe_price_annual_id")
        .eq("is_active", true);
      const allowed = new Set<string>();
      for (const p of plans ?? []) {
        if (p.stripe_price_monthly_id) allowed.add(p.stripe_price_monthly_id);
        if (p.stripe_price_annual_id) allowed.add(p.stripe_price_annual_id);
      }
      return allowed.has(priceId);
    }

    // --- add_gym: attach a new subscription item (one more gym) to the owner's
    // existing subscription, invoicing the prorated remainder immediately. ---
    if (action === "add_gym") {
      const { gym_name, address, phone, price_id, promo_code } = body;
      if (!gym_name || !price_id) {
        return jsonResponse(400, { error: "Chybí gym_name nebo price_id" });
      }
      if (!(await assertAllowedPrice(price_id))) {
        return jsonResponse(400, { error: "Neplatný plán" });
      }
      const planInfo = PRICE_TO_PLAN[price_id];
      if (!planInfo) {
        return jsonResponse(400, { error: "Neznámý plán" });
      }

      // Find the caller's active subscription (a real Stripe subscription, not
      // a manually-managed grandfathered row).
      const { data: ownedGyms } = await admin
        .from("gyms").select("id").eq("owner_id", user_id);
      if (!ownedGyms || ownedGyms.length === 0) {
        return jsonResponse(409, { error: "Žádné aktivní předplatné." });
      }
      const { data: activeSub } = await admin
        .from("gym_subscriptions")
        .select("stripe_subscription_id, stripe_customer_id")
        .in("gym_id", ownedGyms.map((g: { id: string }) => g.id))
        .eq("status", "active")
        .eq("is_grandfathered", false)
        .not("stripe_subscription_id", "is", null)
        .limit(1)
        .maybeSingle();
      if (!activeSub?.stripe_subscription_id) {
        return jsonResponse(409, { error: "Žádné aktivní předplatné." });
      }
      const subscriptionId: string = activeSub.stripe_subscription_id;
      const customerId: string | null = activeSub.stripe_customer_id;

      // Resolve an optional promo code up front so we can reject an invalid one
      // before we create anything. The coupon is restricted (applies_to) to the
      // plan products, so it never discounts the implementation fee below.
      let promoCoupon: Stripe.Coupon | null = null;
      if (promo_code) {
        const codes = await stripe.promotionCodes.list({
          code: promo_code,
          active: true,
          limit: 1,
        });
        const promo = codes.data[0];
        if (!promo || !promo.coupon?.valid) {
          return jsonResponse(400, { error: "Neplatný slevový kód" });
        }
        promoCoupon = promo.coupon;
      }

      // Create the gym first (unpublished) so we have an id to bind the row to.
      const { data: gym, error: gymError } = await admin
        .from("gyms")
        .insert({
          name: gym_name,
          owner_id: user_id,
          address: address || null,
          contact_phone: phone || null,
          is_published: false,
        })
        .select("id")
        .single();
      if (gymError || !gym) {
        return jsonResponse(500, { error: "Nepodařilo se vytvořit posilovnu", detail: gymError?.message });
      }

      // One-time implementation fee (500 CZK) for the new gym. Created as a
      // pending invoice item on the subscription BEFORE the quantity change, so
      // the always_invoice proration invoice below sweeps it into the same
      // immediate charge (fee + proration billed once).
      await stripe.invoiceItems.create({
        customer: customerId ?? undefined,
        subscription: subscriptionId,
        price: IMPLEMENTATION_FEE_PRICE_ID,
      });

      // Quantity model: one subscription item per price, quantity = gym count
      // (Stripe forbids duplicate recurring prices on one subscription).
      // always_invoice charges the prorated remainder + pending fee immediately.
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const existingItem = subscription.items.data.find(
        (it: Stripe.SubscriptionItem) => it.price.id === price_id,
      );
      const item = existingItem
        ? await stripe.subscriptionItems.update(existingItem.id, {
            quantity: (existingItem.quantity ?? 1) + 1,
            proration_behavior: "always_invoice",
          })
        : await stripe.subscriptionItems.create({
            subscription: subscriptionId,
            price: price_id,
            quantity: 1,
            proration_behavior: "always_invoice",
          });

      // Stack the discount for this gym: append the promo's coupon to the
      // subscription's existing discounts (each gym adds one coupon → 2 gyms
      // = 2× -500). Preserve any discounts already applied. Restricted coupon,
      // so the fee above stays full price.
      if (promoCoupon) {
        const currentDiscounts =
          (subscription as unknown as { discounts?: Array<string | { id: string }> })
            .discounts ?? [];
        const discountsPayload: Array<{ discount?: string; coupon?: string }> = [
          ...currentDiscounts.map((d) => ({
            discount: typeof d === "string" ? d : d.id,
          })),
          { coupon: promoCoupon.id },
        ];
        await stripe.subscriptions.update(subscriptionId, {
          discounts: discountsPayload,
          proration_behavior: "none",
        } as unknown as Stripe.SubscriptionUpdateParams);
      }

      const { error: subError } = await admin.from("gym_subscriptions").insert({
        gym_id: gym.id,
        plan_id: planInfo.plan_id,
        status: "active",
        billing_period: planInfo.period,
        stripe_subscription_id: activeSub.stripe_subscription_id,
        stripe_subscription_item_id: item.id,
        stripe_customer_id: activeSub.stripe_customer_id,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        is_grandfathered: false,
      });
      if (subError) {
        return jsonResponse(500, { error: "Nepodařilo se vytvořit předplatné", detail: subError.message });
      }

      // Bump the owner's gym licence count.
      const { data: prof } = await admin
        .from("user_profiles")
        .select("gym_license_count")
        .eq("user_id", user_id)
        .maybeSingle();
      await admin
        .from("user_profiles")
        .update({ gym_license_count: (prof?.gym_license_count ?? 1) + 1 })
        .eq("user_id", user_id);

      await admin.from("subscription_events").insert({
        gym_id: gym.id,
        event_type: "activated",
        to_plan_id: planInfo.plan_id,
        metadata: {
          stripe_subscription_id: activeSub.stripe_subscription_id,
          stripe_subscription_item_id: item.id,
          billing_period: planInfo.period,
          via: "add_gym",
        },
      });

      return jsonResponse(200, { ok: true, gym_id: gym.id });
    }

    // --- change_plan: switch the plan/price of one gym's subscription item. ---
    if (action === "change_plan") {
      const { gym_id, price_id } = body;
      if (!gym_id || !price_id) {
        return jsonResponse(400, { error: "Chybí gym_id nebo price_id" });
      }
      if (!(await assertAllowedPrice(price_id))) {
        return jsonResponse(400, { error: "Neplatný plán" });
      }
      const planInfo = PRICE_TO_PLAN[price_id];
      if (!planInfo) {
        return jsonResponse(400, { error: "Neznámý plán" });
      }

      const { data: gym } = await admin
        .from("gyms").select("id").eq("id", gym_id).eq("owner_id", user_id).maybeSingle();
      if (!gym) {
        return jsonResponse(403, { error: "Posilovna nepatří tomuto účtu." });
      }

      const { data: row } = await admin
        .from("gym_subscriptions")
        .select("id, stripe_subscription_id, stripe_subscription_item_id")
        .eq("gym_id", gym_id)
        .maybeSingle();
      if (!row?.stripe_subscription_id || !row?.stripe_subscription_item_id) {
        return jsonResponse(409, { error: "Předplatné nemá položku ke změně." });
      }

      // Quantity model: an item can back several gyms. Moving one gym to a
      // different price = decrement/remove on the old item + increment/create
      // on the new one, atomically in a single subscription update.
      const subscription = await stripe.subscriptions.retrieve(row.stripe_subscription_id);
      const oldItem = subscription.items.data.find(
        (it: Stripe.SubscriptionItem) => it.id === row.stripe_subscription_item_id,
      );
      if (!oldItem) {
        return jsonResponse(409, { error: "Stripe položka předplatného nenalezena." });
      }
      if (oldItem.price.id === price_id) {
        return jsonResponse(200, { ok: true }); // already on this plan
      }
      const newItem = subscription.items.data.find(
        (it: Stripe.SubscriptionItem) => it.price.id === price_id,
      );
      // How many OTHER active gyms stay on the old item? (derive from DB, not
      // from possibly-stale item.quantity)
      const { count: othersOnOld } = await admin
        .from("gym_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("stripe_subscription_item_id", oldItem.id)
        .eq("status", "active")
        .neq("id", row.id);
      const itemsPayload: Stripe.SubscriptionUpdateParams.Item[] = [];
      if ((othersOnOld ?? 0) > 0) {
        itemsPayload.push({ id: oldItem.id, quantity: othersOnOld! });
      } else {
        itemsPayload.push({ id: oldItem.id, deleted: true });
      }
      if (newItem) {
        itemsPayload.push({ id: newItem.id, quantity: (newItem.quantity ?? 1) + 1 });
      } else {
        itemsPayload.push({ price: price_id, quantity: 1 });
      }
      const updated = await stripe.subscriptions.update(row.stripe_subscription_id, {
        items: itemsPayload,
        proration_behavior: "always_invoice",
      });
      const targetItem = updated.items.data.find(
        (it: Stripe.SubscriptionItem) => it.price.id === price_id,
      );

      await admin
        .from("gym_subscriptions")
        .update({
          plan_id: planInfo.plan_id,
          billing_period: planInfo.period,
          stripe_subscription_item_id: targetItem?.id ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      await admin.from("subscription_events").insert({
        gym_id,
        event_type: "plan_changed",
        to_plan_id: planInfo.plan_id,
        metadata: { via: "change_plan", price_id },
      });

      return jsonResponse(200, { ok: true });
    }

    // --- cancel_gym: drop one gym's item (or cancel the whole subscription if
    // it is the last item on it). ---
    if (action === "cancel_gym") {
      const { gym_id } = body;
      if (!gym_id) {
        return jsonResponse(400, { error: "Chybí gym_id" });
      }

      const { data: gym } = await admin
        .from("gyms").select("id").eq("id", gym_id).eq("owner_id", user_id).maybeSingle();
      if (!gym) {
        return jsonResponse(403, { error: "Posilovna nepatří tomuto účtu." });
      }

      const { data: row } = await admin
        .from("gym_subscriptions")
        .select("id, stripe_subscription_id, stripe_subscription_item_id, current_period_end")
        .eq("gym_id", gym_id)
        .maybeSingle();
      if (!row?.stripe_subscription_id || !row?.stripe_subscription_item_id) {
        return jsonResponse(409, { error: "Předplatné nelze zrušit (chybí Stripe položka)." });
      }

      // Quantity model: how many OTHER active gyms remain on this whole
      // subscription, and on this gym's item specifically? (derived from DB)
      const { count: othersOnSub } = await admin
        .from("gym_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("stripe_subscription_id", row.stripe_subscription_id)
        .eq("status", "active")
        .neq("id", row.id);
      const { count: othersOnItem } = await admin
        .from("gym_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("stripe_subscription_item_id", row.stripe_subscription_item_id)
        .eq("status", "active")
        .neq("id", row.id);

      const lastOnSubscription = (othersOnSub ?? 0) === 0;
      if (lastOnSubscription) {
        // Last gym on the subscription — cancel the whole thing at period end.
        await stripe.subscriptions.update(row.stripe_subscription_id, {
          cancel_at_period_end: true,
        });
        await admin
          .from("gym_subscriptions")
          .update({
            status: "cancelling",
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
      } else {
        // Other gyms stay: decrement this gym's item quantity, or remove the
        // item entirely when this gym was its only user. Paid period stays.
        if ((othersOnItem ?? 0) > 0) {
          await stripe.subscriptionItems.update(row.stripe_subscription_item_id, {
            quantity: othersOnItem!,
            proration_behavior: "none",
          });
        } else {
          await stripe.subscriptionItems.del(row.stripe_subscription_item_id, {
            proration_behavior: "none",
          });
        }
        await admin
          .from("gym_subscriptions")
          .update({
            status: "cancelled",
            cancelled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
      }

      await admin.from("subscription_events").insert({
        gym_id,
        event_type: "cancelled",
        metadata: {
          via: "cancel_gym",
          last_item: lastOnSubscription,
          effective_at: row.current_period_end,
        },
      });

      return jsonResponse(200, { ok: true, effective_at: row.current_period_end });
    }

    return jsonResponse(400, { error: "Neznámá akce" });
  } catch (err) {
    console.error("manage-gym-subscription error:", err);
    return jsonResponse(500, { error: err instanceof Error ? err.message : "Unknown error" });
  }
});
