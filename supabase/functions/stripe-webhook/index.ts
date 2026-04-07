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

// Map Stripe price IDs to plan IDs
const PRICE_TO_PLAN: Record<string, { plan_id: string; period: string }> = {
  "price_1TIa4zEvdp2FxnFO3favQISR": { plan_id: "start", period: "monthly" },
  "price_1TIa50Evdp2FxnFObj0umzSN": { plan_id: "start", period: "annual" },
  "price_1TIa51Evdp2FxnFOjxDA7qFq": { plan_id: "profi", period: "monthly" },
  "price_1TIa51Evdp2FxnFOyG8IDLhJ": { plan_id: "profi", period: "annual" },
  "price_1TIa52Evdp2FxnFOoJIEJKlF": { plan_id: "premium", period: "monthly" },
  "price_1TIa52Evdp2FxnFOYJVPYkFM": { plan_id: "premium", period: "annual" },
};

serve(async (req) => {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET);
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

  // 2. Set user role to business
  await supabase.from("user_roles").upsert({
    user_id: userId,
    role: "business",
  }, { onConflict: "user_id" });

  // 3. Create gym subscription
  const { error: subError } = await supabase.from("gym_subscriptions").insert({
    gym_id: gym.id,
    plan_id: planInfo.plan_id,
    status: "active",
    billing_period: planInfo.period,
    stripe_subscription_id: subscription.id,
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

  console.log(`Gym "${gymName}" created with ${planInfo.plan_id} plan for user ${userId}`);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Update subscription period
  const { data: gymSub } = await supabase
    .from("gym_subscriptions")
    .select("id, gym_id, plan_id")
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  if (!gymSub) return;

  await supabase
    .from("gym_subscriptions")
    .update({
      status: "active",
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
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
  const { data: gymSub } = await supabase
    .from("gym_subscriptions")
    .select("id, gym_id, plan_id")
    .eq("stripe_subscription_id", subscription.id)
    .single();

  if (!gymSub) return;

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

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const priceId = subscription.items.data[0].price.id;
  const planInfo = PRICE_TO_PLAN[priceId];
  if (!planInfo) return;

  const { data: gymSub } = await supabase
    .from("gym_subscriptions")
    .select("id, gym_id, plan_id")
    .eq("stripe_subscription_id", subscription.id)
    .single();

  if (!gymSub) return;

  const oldPlan = gymSub.plan_id;
  if (oldPlan === planInfo.plan_id) return; // No plan change

  const planOrder = { start: 1, profi: 2, premium: 3 };
  const eventType = (planOrder[planInfo.plan_id as keyof typeof planOrder] || 0) >
    (planOrder[oldPlan as keyof typeof planOrder] || 0)
    ? "upgraded"
    : "downgraded";

  await supabase
    .from("gym_subscriptions")
    .update({
      plan_id: planInfo.plan_id,
      billing_period: planInfo.period,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
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
