-- Zakladatelská nabídka: atomic reservation to close a TOCTOU race.
-- isEligibleForFounderOffer() reads gym_subscriptions, which is empty for a
-- brand-new user (the gym doesn't exist until the webhook fires) — so two
-- concurrent create-checkout calls for the same new user would both read
-- "eligible". The PRIMARY KEY on user_id is what makes the reservation
-- atomic: only the first of two concurrent inserts can succeed.
CREATE TABLE IF NOT EXISTS public.founder_offer_claims (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  checkout_session_id TEXT,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.founder_offer_claims IS
  'One row per user who has reserved the zakladatelská nabídka (founder offer) in create-checkout, inserted BEFORE the Stripe session is created so the PK conflict enforces "only one active claim per user". Stale claims (older than the TTL create-checkout enforces in code) are reclaimable to avoid permanently blocking a user whose checkout was abandoned.';

ALTER TABLE public.founder_offer_claims ENABLE ROW LEVEL SECURITY;
-- No policies: only the service-role key (which bypasses RLS) touches this
-- table from create-checkout; anon/authenticated clients get no access.
