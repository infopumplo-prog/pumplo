-- Zakladatelská nabídka fix round 2 (finding 3, re-review): a real DB-level
-- guarantee against duplicate gym+subscription creation on truly concurrent
-- redeliveries of checkout.session.completed (Stripe can deliver near-
-- simultaneous retries on a slow endpoint response, or on manual event
-- replay) — the previous SELECT-then-INSERT guard was not atomic.
--
-- A plain UNIQUE constraint on gym_subscriptions.stripe_subscription_id was
-- considered and rejected: verified in stripe-webhook/index.ts that the
-- activate_gym_ids / custom_gym_ids flows intentionally write MULTIPLE
-- gym_subscriptions rows sharing one stripe_subscription_id (the "N gyms on
-- one subscription, one line item, quantity = N" model used by NextGen and
-- other custom deals, upserted in a loop with onConflict: "gym_id") — a
-- table-wide unique constraint on that column would break on the second
-- iteration of that loop for any real multi-gym deal.
--
-- Instead this dedicated claims table (same atomic-insert-with-PK pattern as
-- founder_offer_claims) is used ONLY by the new-gym-registration path in
-- handleCheckoutComplete — the one code path where a race can create a
-- duplicate gym. The claim is inserted BEFORE the gym row is created, so a
-- losing concurrent/duplicate delivery never creates a gym at all: no orphan
-- gym is possible by construction.
CREATE TABLE IF NOT EXISTS public.webhook_new_gym_claims (
  stripe_subscription_id TEXT PRIMARY KEY,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.webhook_new_gym_claims IS
  'One row per Stripe subscription that has started new-gym creation in the stripe-webhook checkout.session.completed handler (new-gym-registration path only — never used by activate_gym_ids/custom_gym_ids, which legitimately share one subscription id across several gym_subscriptions rows). The PRIMARY KEY makes claiming atomic: only the first of two concurrent/duplicate deliveries for the same subscription can insert, so only one ever creates the gym + gym_subscriptions row.';

ALTER TABLE public.webhook_new_gym_claims ENABLE ROW LEVEL SECURITY;
-- No policies: only the service-role key (stripe-webhook) touches this table.
