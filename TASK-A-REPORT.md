# Workstream A — backend report (Zakladatelská nabídka)

Branch: `feat/zakladatelska-nabidka`, worktree `~/pumplo/.worktrees/zakladatelska`.

## What changed

### A1 — Migration
File: `supabase/migrations/20260728_founder_offer_quarterly.sql`

- `subscription_plans.stripe_price_quarterly_id TEXT` — allowlist source for the new
  quarterly Stripe price, following the same pattern as `stripe_price_monthly_id` /
  `stripe_price_annual_id`. Left `NULL` for now (no fake ID inserted); `create-checkout`
  reads it directly, so the founder-offer price path stays inert until David sets the
  real value.
- `gym_subscriptions.billing_period` CHECK constraint widened to
  `('monthly', 'annual', 'quarterly')`.
- `gym_subscriptions.is_founder_offer BOOLEAN NOT NULL DEFAULT false` — audit flag and
  input to the eligibility check.
- Column comments added for both new columns explaining intent.

Applied directly via the Supabase Management API (PAT at `~/.supabase-pat`, project
`udqwjqgdsjobdufdxbpn`) and also committed as the migration file above so the repo
stays the source of truth.

**Schema read-back (post-apply):**
```
subscription_plans.stripe_price_quarterly_id → text  (exists)
gym_subscriptions_billing_period_check → CHECK ((billing_period = ANY (ARRAY['monthly'::text, 'annual'::text, 'quarterly'::text])))
gym_subscriptions.is_founder_offer → boolean, default false, NOT NULL  (exists)
```

### A2 — `supabase/functions/create-checkout/index.ts`
- New `FOUNDER_COUPON_ID` placeholder constant at the top of the file (clearly commented,
  needs the real Stripe coupon id).
- New `isEligibleForFounderOffer(adminClient, userId)`: returns `true` only when the
  owner has zero rows in `gym_subscriptions` (any status, including cancelled) across
  every gym they own. Fails closed (`false`) on any query error.
- Request body now accepts `founder_offer?: boolean`.
- Allowlist query extended to also read `stripe_price_quarterly_id`; kept in a separate
  `quarterlyPrices` set so a founder-offer request can be checked against exactly that
  price, not just "any allowed price."
- Eligibility gate (runs before any Stripe calls):
  1. `founder_offer: true` + (`activate_gym_ids` flow OR `additional_gym`) → 400
     `"Zakladatelská nabídka je jen pro první posilovnu."` — this specifically blocks the
     gaming vector described in the task (existing customers adding branches).
  2. `founder_offer: true` with a `price_id` that isn't in `quarterlyPrices` → 400 (defense
     in depth — the coupon must not attach to the wrong price).
  3. `founder_offer: true` and `isEligibleForFounderOffer` returns `false` → 400 same
     Czech message.
- When eligible: `metadata.founder_offer = "true"` is added (new-gym flow only — the
  activate flow can never reach this because of gate #1).
- Checkout session build now branches: founder offer → `discounts: [{ coupon:
  FOUNDER_COUPON_ID }]` and `allow_promotion_codes` is **omitted entirely** (not just
  `false` — Stripe rejects the request if both keys are present at all). Non-founder path
  is unchanged (`allow_promotion_codes: true`).
- The 500 CZK `IMPLEMENTATION_FEE_PRICE_ID` line item is untouched by any of this — same
  full-price line item in both branches.

### A3 — `supabase/functions/stripe-webhook/index.ts`
- `PRICE_TO_PLAN` gets a new entry: `"price_TODO_QUARTERLY": { plan_id: "premium",
  period: "quarterly" }` — placeholder, clearly commented, needs the real quarterly
  price id (must match what's set in `subscription_plans.stripe_price_quarterly_id`).
- `gym_subscriptions` insert (new-gym path) now sets `is_founder_offer` from
  `session.metadata?.founder_offer === "true"`.
- New `applyFounderOfferSchedule(subscription)`, called right after that insert when
  `isFounderOffer` is true:
  - **Idempotency**: checks `subscription.schedule` (Stripe's own state) before doing
    anything. If already set, logs and returns — a redelivered
    `checkout.session.completed` cannot create a second schedule, because Stripe itself
    remembers the subscription was already converted.
  - Reads the premium plan's `stripe_price_monthly_id` from the DB (this ID already
    exists in production — `price_1TshbLEvdp2FxnFO4UUBStkz` — no placeholder needed
    here) for phase 2.
  - `stripe.subscriptionSchedules.create({ from_subscription })` snapshots phase 1
    (the quarter already paid, items/dates copied as-is from Stripe's own schedule
    conversion).
  - `stripe.subscriptionSchedules.update(...)` appends phase 2: monthly Neomezený price,
    no `iterations`/`end_date` — an open final phase runs indefinitely per Stripe's
    schedule semantics, matching "iterations neomezeně" in the plan. `end_behavior:
    "release"` set for safety if the phase is ever bounded later.
  - Wrapped in try/catch; failures are logged, not thrown, so a Stripe-side schedule
    error doesn't fail the whole webhook response (consistent with this file's existing
    non-blocking error style, e.g. the Telegram notification block).

## Verification

```
$ npx tsc --noEmit          # from worktree root
(0 output, exit 0)

$ deno check supabase/functions/create-checkout/index.ts
Check supabase/functions/create-checkout/index.ts   (clean)

$ deno check supabase/functions/stripe-webhook/index.ts
Check supabase/functions/stripe-webhook/index.ts    (clean)
```

Migration verified applied by reading the live schema back through the Supabase
Management API (see above) — not just assumed from a 200 response.

## Placeholders that still need real Stripe IDs

1. `FOUNDER_COUPON_ID` in `supabase/functions/create-checkout/index.ts` (top of file) —
   currently `'TODO_COUPON_ZAKLADATELSKA'`.
2. `"price_TODO_QUARTERLY"` key in `PRICE_TO_PLAN` in
   `supabase/functions/stripe-webhook/index.ts` — replace with the real quarterly price id.
3. `subscription_plans.stripe_price_quarterly_id` (DB column, `premium` row) — must be
   set to the same real quarterly price id as #2, via SQL/Management API. Until this is
   set, `create-checkout`'s quarterly-price allowlist is empty and every founder-offer
   request 400s with the "platí jen pro čtvrtletní cenu" message — a safe default, not a
   bug.

All three need to be filled in together once David creates the quarterly Price and the
50%-off coupon in Stripe.

## Concerns / things worth knowing before deploy

- **Pre-existing gap, not introduced by this change**: `handleCheckoutComplete`'s
  new-gym path does a plain `INSERT` for both `gyms` and `gym_subscriptions` — it has no
  general protection against a redelivered `checkout.session.completed` creating a
  second gym (this predates the founder offer and applies to every new-gym checkout,
  not just founder-offer ones). The founder-offer-specific idempotency asked for in A3
  (no duplicate *schedule*) is handled correctly via `subscription.schedule`, and that
  check is unaffected by whether the gym row itself gets duplicated. Flagging this
  because "idempotent webhook" language in the brief could be read more broadly — happy
  to fix separately if wanted, but treated it as out of scope for this task since it's a
  systemic, pre-existing pattern across all checkout flows, not a founder-offer bug.
- The quarterly price and coupon cannot be exercised end-to-end until David creates them
  in Stripe and the three placeholders above are filled in — nothing was tested against
  live Stripe (both CLI keys were expired, as noted in the brief).
- `isEligibleForFounderOffer` treats "owns zero gyms yet" as eligible (matches the task's
  literal spec: check is on `gym_subscriptions` rows only, not gym ownership) — a user
  who owns a gym with zero subscription rows (shouldn't normally exist given how gyms are
  only created alongside a subscription in this same webhook) would still read as
  eligible. Matches the literal A2 spec; flagging in case business intent was stricter.

## Files touched
- `supabase/migrations/20260728_founder_offer_quarterly.sql` (new)
- `supabase/functions/create-checkout/index.ts`
- `supabase/functions/stripe-webhook/index.ts`
