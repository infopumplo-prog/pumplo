import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@13.6.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const cryptoProvider = Stripe.createSubtleCryptoProvider();

// Map Stripe price IDs to plan IDs — LIVE mode (switched 2026-04-11)
const PRICE_TO_PLAN: Record<string, { plan_id: string; period: string }> = {
  // 2026-07 two-tier pricing: Start 1500 / Neomezený (premium) 3000
  "price_1TshbKEvdp2FxnFOGJ5FHAsC": { plan_id: "start", period: "monthly" },
  "price_1TshbLEvdp2FxnFOaSD3uBaD": { plan_id: "start", period: "annual" },
  "price_1TshbLEvdp2FxnFO4UUBStkz": { plan_id: "premium", period: "monthly" },
  "price_1TshbLEvdp2FxnFOXQJlLdqb": { plan_id: "premium", period: "annual" },
  // NextGen deal: discounted Start (-500 Kč, 2 branches on one subscription)
  "price_1TshckEvdp2FxnFO5QO5zDFB": { plan_id: "start", period: "monthly" },
  // legacy prices (pre-2026-07 tiers) — keep mapping for existing subscriptions
  "price_1TKxyrEvdp2FxnFO3TTdE9mS": { plan_id: "start", period: "monthly" },
  "price_1TKxysEvdp2FxnFOCXjuXt8g": { plan_id: "start", period: "annual" },
  "price_1TKxysEvdp2FxnFO4ImRp2gn": { plan_id: "profi", period: "monthly" },
  "price_1TKxysEvdp2FxnFOWAg03uG7": { plan_id: "profi", period: "annual" },
  "price_1TKxytEvdp2FxnFOpx9DiIw3": { plan_id: "premium", period: "monthly" },
  "price_1TKxytEvdp2FxnFOqbt8PhRo": { plan_id: "premium", period: "annual" },
};

serve(async (req) => {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      sig,
      WEBHOOK_SECRET,
      undefined,
      cryptoProvider
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("Webhook Error", { status: 400 });
  }

  console.log(`Processing event: ${event.type}`);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutComplete(session);
      break;
    }
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      await handleInvoicePaid(invoice);
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      await handlePaymentFailed(invoice);
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionCancelled(subscription);
      break;
    }
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionUpdated(subscription);
      break;
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
});

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  // --- Activate path: gyms already exist (owner has them, no subscription
  // yet). Quantity model: the subscription has ONE item per price with
  // quantity = gym count (Stripe forbids duplicate recurring prices), so all
  // activated gyms share the same subscription item id.
  const activateGymIds = session.metadata?.activate_gym_ids;
  if (activateGymIds) {
    const ids = activateGymIds.split(",").map((g: string) => g.trim()).filter(Boolean);
    const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
    const item = subscription.items.data[0];
    const periodStart = new Date(subscription.current_period_start * 1000).toISOString();
    const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();
    if (!item) {
      console.error("Activate: subscription has no items", subscription.id);
      return;
    }
    if ((item.quantity ?? 1) !== ids.length) {
      console.error(
        `Activate: item quantity (${item.quantity}) != gym count (${ids.length}) on`, subscription.id,
      );
    }
    for (const gymId of ids) {
      const planInfo = PRICE_TO_PLAN[item.price.id];
      if (!planInfo) console.error("Unknown price ID on activate:", item.price.id);
      const { error } = await supabase
        .from("gym_subscriptions")
        .upsert({
          gym_id: gymId,
          plan_id: planInfo?.plan_id || "start",
          status: "active",
          billing_period: planInfo?.period || "monthly",
          stripe_subscription_id: subscription.id,
          stripe_subscription_item_id: item.id,
          stripe_customer_id: session.customer as string,
          current_period_start: periodStart,
          current_period_end: periodEnd,
          is_grandfathered: false,
        }, { onConflict: "gym_id" });
      if (error) console.error("activate_gym_ids upsert failed for", gymId, error);
      else console.log("Activated subscription item on gym", gymId);
    }
    return;
  }

  // --- Custom deal path: gyms already exist (created by admin), the payment
  // link carries their ids — just attach the Stripe subscription to them.
  // This is how per-customer pricing works (e.g. NextGen: 2 gyms, 1000 CZK).
  const customGymIds = session.metadata?.custom_gym_ids;
  if (customGymIds) {
    const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
    const periodStart = new Date(subscription.current_period_start * 1000).toISOString();
    const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();
    for (const gymId of customGymIds.split(",").map((g: string) => g.trim()).filter(Boolean)) {
      const { error } = await supabase
        .from("gym_subscriptions")
        .upsert({
          gym_id: gymId,
          plan_id: session.metadata?.plan_id || "nextgen_custom",
          status: "active",
          billing_period: "monthly",
          stripe_subscription_id: subscription.id,
          stripe_customer_id: session.customer as string,
          current_period_start: periodStart,
          current_period_end: periodEnd,
          is_grandfathered: false,
        }, { onConflict: "gym_id" });
      if (error) console.error("custom_gym_ids upsert failed for", gymId, error);
      else console.log("Attached custom subscription to gym", gymId);
    }
    return;
  }

  // Get metadata from session (gym_name, user_id, address, machines, etc.)
  const userId = session.metadata?.user_id;
  const gymName = session.metadata?.gym_name;
  const address = session.metadata?.address;
  const latitude = session.metadata?.latitude ? parseFloat(session.metadata.latitude) : null;
  const longitude = session.metadata?.longitude ? parseFloat(session.metadata.longitude) : null;

  if (!userId || !gymName) {
    console.error("Missing user_id or gym_name in session metadata");
    return;
  }

  // Get subscription details from Stripe
  const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
  const priceId = subscription.items.data[0].price.id;
  const planInfo = PRICE_TO_PLAN[priceId];

  if (!planInfo) {
    console.error("Unknown price ID:", priceId);
    return;
  }

  // 1. Create the gym
  const { data: gym, error: gymError } = await supabase
    .from("gyms")
    .insert({
      name: gymName,
      owner_id: userId,
      address: address || null,
      latitude: latitude,
      longitude: longitude,
      is_published: false, // Owner publishes when ready
    })
    .select("id")
    .single();

  if (gymError) {
    console.error("Failed to create gym:", gymError);
    return;
  }

  // 2. Ensure user has the business role (user_roles is multi-role; a user may
  // already have the default "user" role — we add "business" alongside it).
  // Requires UNIQUE (user_id, role) constraint on public.user_roles.
  const { error: roleError } = await supabase.from("user_roles").upsert({
    user_id: userId,
    role: "business",
  }, { onConflict: "user_id,role", ignoreDuplicates: true });
  if (roleError) {
    console.error("Failed to set business role:", roleError);
  }

  // 2b. Additional gym bought from the admin dashboard: bump the owner's
  // gym licence so the count stays consistent with what they pay for.
  if (session.metadata?.additional_gym === "true") {
    const { data: prof } = await supabase
      .from("user_profiles")
      .select("gym_license_count")
      .eq("user_id", userId)
      .maybeSingle();
    const { error: licError } = await supabase
      .from("user_profiles")
      .update({ gym_license_count: (prof?.gym_license_count ?? 1) + 1 })
      .eq("user_id", userId);
    if (licError) console.error("Failed to bump gym_license_count:", licError);
  }

  // 3. Create gym subscription
  const { error: subError } = await supabase.from("gym_subscriptions").insert({
    gym_id: gym.id,
    plan_id: planInfo.plan_id,
    status: "active",
    billing_period: planInfo.period,
    stripe_subscription_id: subscription.id,
    stripe_subscription_item_id: subscription.items.data[0].id,
    stripe_customer_id: session.customer as string,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
  });

  if (subError) {
    console.error("Failed to create subscription:", subError);
    return;
  }

  // 4. Log event
  await supabase.from("subscription_events").insert({
    gym_id: gym.id,
    event_type: "activated",
    to_plan_id: planInfo.plan_id,
    metadata: {
      stripe_subscription_id: subscription.id,
      billing_period: planInfo.period,
    },
  });

  // 5. Add selected machines if provided
  const machineIds = session.metadata?.machine_ids;
  if (machineIds) {
    const ids = JSON.parse(machineIds) as string[];
    const machineRows = ids.map((machineId) => ({
      gym_id: gym.id,
      machine_id: machineId,
      quantity: 1,
    }));
    if (machineRows.length > 0) {
      await supabase.from("gym_machines").insert(machineRows);
    }
  }

  // 6. Create fulfillment order for welcome kit
  let totalStickerCount = 0;
  try {
    const { data: machineData } = await supabase
      .from("gym_machines")
      .select("quantity")
      .eq("gym_id", gym.id);
    if (machineData) {
      totalStickerCount = machineData.reduce(
        (sum: number, m: { quantity: number | null }) => sum + (m.quantity || 1),
        0
      );
    }
  } catch (e) {
    console.error("Error counting machines for fulfillment:", e);
  }

  const { error: fulfillmentError } = await supabase
    .from("fulfillment_orders")
    .insert({
      gym_id: gym.id,
      type: "welcome_kit",
      status: "pending",
      shipping_address: {
        address: session.metadata?.address || "",
        phone: session.metadata?.phone || "",
        gym_name: session.metadata?.gym_name || "",
      },
      sticker_count: totalStickerCount || 1,
      stand_count: 2,
      metadata: {
        stripe_session_id: session.id,
        plan_id: planInfo.plan_id,
      },
    });

  if (fulfillmentError) {
    console.error("Error creating fulfillment order:", fulfillmentError);
  } else {
    console.log(
      `Fulfillment order created for gym ${gym.id}: ${totalStickerCount} stickers, 2 stands`
    );

    // === Send Telegram notification about new fulfillment order ===
    try {
      const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
      const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID');

      if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
        const message = `📦 *Nová fulfillment objednávka!*\n\n` +
          `🏋️ *${session.metadata?.gym_name || 'Neznámá posilovna'}*\n` +
          `📍 ${session.metadata?.address || 'Adresa neuvedena'}\n` +
          `📞 ${session.metadata?.phone || 'Telefon neuveden'}\n\n` +
          `🏷️ Samolepek: *${totalStickerCount}*\n` +
          `🪧 Stojánků: *2*\n` +
          `📋 Plán: *${planInfo.plan_id}*\n\n` +
          `➡️ [Otevřít fulfillment](https://pumplo-admin.vercel.app/fulfillment)`;

        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
          }),
        });
        console.log('Telegram fulfillment notification sent');
      }
    } catch (telegramError) {
      console.error('Telegram notification error (non-blocking):', telegramError);
    }
  }

  console.log(`Gym "${gymName}" created with ${planInfo.plan_id} plan for user ${userId}`);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // One subscription may cover several gyms (multi-item) — update every row.
  const { data: gymSubs } = await supabase
    .from("gym_subscriptions")
    .select("id, gym_id, plan_id, status")
    .eq("stripe_subscription_id", subscriptionId);

  if (!gymSubs || gymSubs.length === 0) return;

  const periodStart = new Date(subscription.current_period_start * 1000).toISOString();
  const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();

  for (const gymSub of gymSubs) {
    // Don't revive a row that was individually cancelled/cancelling — the
    // per-gym cancel actions rely on status surviving a renewal invoice.
    const nextStatus = gymSub.status === "cancelled" || gymSub.status === "cancelling"
      ? gymSub.status
      : "active";
    await supabase
      .from("gym_subscriptions")
      .update({
        status: nextStatus,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        updated_at: new Date().toISOString(),
      })
      .eq("id", gymSub.id);

    await supabase.from("subscription_events").insert({
      gym_id: gymSub.gym_id,
      event_type: "renewed",
      to_plan_id: gymSub.plan_id,
      metadata: { invoice_id: invoice.id },
    });
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) return;

  const { data: gymSub } = await supabase
    .from("gym_subscriptions")
    .select("id, gym_id, plan_id")
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  if (!gymSub) return;

  await supabase
    .from("gym_subscriptions")
    .update({ status: "past_due", updated_at: new Date().toISOString() })
    .eq("id", gymSub.id);

  await supabase.from("subscription_events").insert({
    gym_id: gymSub.gym_id,
    event_type: "payment_failed",
    to_plan_id: gymSub.plan_id,
    metadata: { invoice_id: invoice.id },
  });
}

async function handleSubscriptionCancelled(subscription: Stripe.Subscription) {
  // One Stripe subscription can cover several gyms (custom multi-gym deals).
  const { data: gymSubs } = await supabase
    .from("gym_subscriptions")
    .select("id, gym_id, plan_id")
    .eq("stripe_subscription_id", subscription.id);

  for (const gymSub of gymSubs ?? []) {
    await supabase
      .from("gym_subscriptions")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", gymSub.id);

    // Unpublish gym when subscription cancelled
    await supabase
      .from("gyms")
      .update({ is_published: false })
      .eq("id", gymSub.gym_id);

    await supabase.from("subscription_events").insert({
      gym_id: gymSub.gym_id,
      event_type: "cancelled",
      from_plan_id: gymSub.plan_id,
    });
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  // A subscription may carry several items (one gym each). Load every row that
  // belongs to it and reconcile each against its matching Stripe item.
  const { data: gymSubs } = await supabase
    .from("gym_subscriptions")
    .select("id, gym_id, plan_id, status, stripe_subscription_item_id")
    .eq("stripe_subscription_id", subscription.id);
  if (!gymSubs || gymSubs.length === 0) return;

  const periodStart = new Date(subscription.current_period_start * 1000).toISOString();
  const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();

  // Keep the subscription-level period in sync on all rows regardless of plan
  // changes (renewals arrive as updates too).
  await supabase
    .from("gym_subscriptions")
    .update({
      current_period_start: periodStart,
      current_period_end: periodEnd,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id);

  const planOrder = { start: 1, profi: 2, premium: 3 };

  // Plan changes are per-item — reconcile each Stripe item against its row.
  for (const item of subscription.items.data) {
    const planInfo = PRICE_TO_PLAN[item.price.id];
    if (!planInfo) continue;

    // Quantity model: several rows can share one item — reconcile them ALL.
    // Fall back to the sole row for legacy single-item subs whose row predates
    // item-id storage.
    const matchedSubs = gymSubs.filter((r) => r.stripe_subscription_item_id === item.id);
    if (matchedSubs.length === 0 && gymSubs.length === 1) matchedSubs.push(gymSubs[0]);
    for (const gymSub of matchedSubs) {
    const oldPlan = gymSub.plan_id;
    if (oldPlan === planInfo.plan_id) continue; // No plan change for this gym

    const eventType = (planOrder[planInfo.plan_id as keyof typeof planOrder] || 0) >
      (planOrder[oldPlan as keyof typeof planOrder] || 0)
      ? "upgraded"
      : "downgraded";

    await supabase
      .from("gym_subscriptions")
      .update({
        plan_id: planInfo.plan_id,
        billing_period: planInfo.period,
        updated_at: new Date().toISOString(),
      })
      .eq("id", gymSub.id);

    await supabase.from("subscription_events").insert({
      gym_id: gymSub.gym_id,
      event_type: eventType,
      from_plan_id: oldPlan,
      to_plan_id: planInfo.plan_id,
    });

    // On downgrade: unpublish gym if it exceeds new plan limits
    if (eventType === "downgraded") {
      const { data: newPlan } = await supabase
        .from("subscription_plans")
        .select("limits")
        .eq("id", planInfo.plan_id)
        .single();

      if (newPlan?.limits) {
        const limits = newPlan.limits as Record<string, number | boolean | string>;
        const maxMachines = typeof limits.max_machines === "number" ? limits.max_machines : -1;
        const maxPhotos = typeof limits.max_photos === "number" ? limits.max_photos : -1;
        const maxTrainers = typeof limits.max_trainers === "number" ? limits.max_trainers : -1;

        const [machines, photos, trainers] = await Promise.all([
          maxMachines !== -1 ? supabase.from("gym_machines").select("id", { count: "exact", head: true }).eq("gym_id", gymSub.gym_id) : null,
          maxPhotos !== -1 ? supabase.from("gym_photos").select("id", { count: "exact", head: true }).eq("gym_id", gymSub.gym_id) : null,
          maxTrainers !== -1 ? supabase.from("gym_trainers").select("id", { count: "exact", head: true }).eq("gym_id", gymSub.gym_id).eq("is_active", true) : null,
        ]);

        const overLimit =
          (maxMachines !== -1 && (machines?.count ?? 0) > maxMachines) ||
          (maxPhotos !== -1 && (photos?.count ?? 0) > maxPhotos) ||
          (maxTrainers !== -1 && (trainers?.count ?? 0) > maxTrainers);

        if (overLimit) {
          await supabase.from("gyms").update({ is_published: false }).eq("id", gymSub.gym_id);
          console.log(`Gym ${gymSub.gym_id} unpublished after downgrade — exceeds ${planInfo.plan_id} limits`);
        }
      }
    }
    }
  }
}
