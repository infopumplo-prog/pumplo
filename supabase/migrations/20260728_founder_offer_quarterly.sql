-- Zakladatelská nabídka (founder offer): time-limited quarterly Neomezený
-- plan for first-time gym owners (registrations until 31.12.2026).
-- See docs/superpowers/plans/2026-07-28-zakladatelska-nabidka.md

-- Allowlist source for the new quarterly Stripe price (create-checkout reads
-- this column, same pattern as stripe_price_monthly_id / stripe_price_annual_id).
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS stripe_price_quarterly_id TEXT;

-- Allow 'quarterly' billing_period alongside the existing monthly/annual.
ALTER TABLE public.gym_subscriptions
  DROP CONSTRAINT IF EXISTS gym_subscriptions_billing_period_check;

ALTER TABLE public.gym_subscriptions
  ADD CONSTRAINT gym_subscriptions_billing_period_check
    CHECK (billing_period IN ('monthly', 'annual', 'quarterly'));

-- Audit flag + protection against a second use of the offer by the same owner.
ALTER TABLE public.gym_subscriptions
  ADD COLUMN IF NOT EXISTS is_founder_offer BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.gym_subscriptions.is_founder_offer IS
  'True when this row was created via the time-limited "zakladatelská nabídka" founder offer (quarterly-prepaid Neomezený for first-time owners). Used for audit and eligibility checks.';

COMMENT ON COLUMN public.subscription_plans.stripe_price_quarterly_id IS
  'Stripe price id for the founder-offer quarterly billing option (currently only used on the premium/Neomezený plan). NULL until the Stripe price is created.';
