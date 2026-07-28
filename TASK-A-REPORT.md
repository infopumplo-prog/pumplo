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

---

# Fix round 1 (code review findings)

Four findings from the review, all fixed in this round, same worktree/branch.

## 1. `billing_period` went stale after the schedule flips to monthly

`handleSubscriptionUpdated` in `stripe-webhook/index.ts` guarded on `plan_id` alone
(`if (oldPlan === planInfo.plan_id) continue;`). The founder offer's schedule keeps
`plan_id: "premium"` across both phases — only `billing_period` changes
(`'quarterly'` → `'monthly'`) — so that guard always skipped the write for this
transition, leaving the row permanently wrong.

Fix: added `billing_period` to the `gymSubs` select, and now compare the
`(plan_id, billing_period)` pair:
```ts
const planChanged = oldPlan !== planInfo.plan_id;
const periodChanged = oldPeriod !== planInfo.period;
if (!planChanged && !periodChanged) continue;
```
The row update (`plan_id`, `billing_period`, `updated_at`) always runs when either
changed. `subscription_events` insert and the downgrade plan-limit re-check now only
run `if (planChanged)` — a period-only change is not an upgrade/downgrade (there's no
`event_type` for that in the `subscription_events` CHECK constraint, and re-checking
plan limits makes no sense when the plan itself didn't change). A period-only change
is logged via `console.log` instead.

Checked for spurious writes on ordinary monthly/annual subscriptions: `PRICE_TO_PLAN`
maps a fixed `period` per price id, so for a ordinary subscription whose price doesn't
change, `planInfo.period` matches what's already stored — no accidental rewrite.

## 2. TOCTOU race — one owner could claim the founder discount on more than one "first" gym

`isEligibleForFounderOffer` reads `gyms.owner_id = userId`, which is empty for a
brand-new user (the gym isn't created until the webhook fires later). Two concurrent
`create-checkout` calls for two new-gym registrations would both read "eligible".

Fix: added an atomic reservation, per the reviewer's guidance.
- New migration `supabase/migrations/20260728120000_founder_offer_claims.sql`:
  `founder_offer_claims(user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE
  CASCADE, checkout_session_id TEXT, claimed_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
  RLS enabled with no policies (service-role-only access, matching how `create-checkout`
  reaches it). Applied via the Management API and read back (see Verification).
- New `reserveFounderOfferClaim(adminClient, userId)` in `create-checkout/index.ts`:
  inserts a row **before** creating the Stripe session; the PK is what makes this
  atomic — only the first of two concurrent inserts can succeed. Called right after
  `isEligibleForFounderOffer` passes; on failure, same 400 Czech message as the
  eligibility rejection (doesn't leak which specific check failed).
- **Reservation-expiry behaviour chosen**: stale-claim reclaim by TTL, not a
  session-expiry webhook listener. `FOUNDER_CLAIM_TTL_MS = 24h`, matching Stripe
  Checkout's own default subscription-mode session expiry — so a claim never outlives
  a genuinely live checkout, only an abandoned one. The reclaim path
  (`UPDATE ... WHERE user_id = ? AND claimed_at < staleThreshold`) is itself race-safe:
  Postgres re-evaluates the `WHERE` against the committed row, so only one of two
  concurrent reclaim attempts can actually update it (verified this is the standard
  read-committed UPDATE semantics, not just an assumption).
- Bonus hardening beyond what was strictly asked: if `stripe.checkout.sessions.create`
  throws *after* the claim was reserved, the claim is deleted before rethrowing — so a
  transient Stripe error doesn't lock a legitimate customer out for up to 24h. On
  success, the claim row is updated with the real `checkout_session_id` (best-effort,
  non-blocking) purely for observability/audit.

## 3. Redelivered `checkout.session.completed` could double-write gym + subscription

Added a guard right before "1. Create the gym" in the new-gym path of
`handleCheckoutComplete` in `stripe-webhook/index.ts`:
```ts
const { data: existingSub } = await supabase
  .from("gym_subscriptions")
  .select("id, gym_id")
  .eq("stripe_subscription_id", subscription.id)
  .maybeSingle();
if (existingSub) { console.log(...); return; }
```
`subscription.id` is stable across redeliveries of the same event (it's `session.subscription`,
retrieved fresh each time but referring to the same Stripe object), so a prior successful
run leaves a matching row behind and this makes redelivery a no-op instead of a duplicate
gym/subscription. Kept tight and additive — did not restructure the handler, and the
`activate_gym_ids`/`custom_gym_ids` paths above it were already idempotent via `upsert(...,
{ onConflict: "gym_id" })` so weren't touched.

## 4. No server-side enforcement of the 31.12.2026 deadline

Added `FOUNDER_OFFER_DEADLINE = new Date('2026-12-31T22:59:59.999Z')` in
`create-checkout/index.ts` (top of file, next to the other founder-offer constants) —
this is 23:59:59.999 Europe/Prague on 31.12.2026 expressed in UTC (Prague is CET/UTC+1
that late in the year, no DST). Checked first in the founder-offer gate:
`if (Date.now() > FOUNDER_OFFER_DEADLINE.getTime())` → 400 `"Zakladatelská nabídka
skončila 31. 12. 2026."`. This is enforced independent of whether the Stripe price/coupon
get unpublished.

## Verification (re-run after all four fixes)

```
$ npx tsc --noEmit                                            # 0 output, exit 0
$ deno check supabase/functions/create-checkout/index.ts     # Check ... (clean)
$ deno check supabase/functions/stripe-webhook/index.ts      # Check ... (clean)
```

Migration schema read-back for `founder_offer_claims` (via Supabase Management API,
project `udqwjqgdsjobdufdxbpn`):
```
columns: user_id uuid NOT NULL, checkout_session_id text NULL, claimed_at timestamptz NOT NULL default now()
constraints: founder_offer_claims_pkey PRIMARY KEY (user_id)
             founder_offer_claims_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
relrowsecurity: true
```

## Files touched this round
- `supabase/migrations/20260728120000_founder_offer_claims.sql` (new)
- `supabase/functions/create-checkout/index.ts`
- `supabase/functions/stripe-webhook/index.ts`

## Still open / unchanged from round 1
- Same three Stripe-ID placeholders (`FOUNDER_COUPON_ID`, `price_TODO_QUARTERLY`,
  `subscription_plans.stripe_price_quarterly_id`) — untouched, still need real values.
- Reviewer's coupon note (`applies_to.products` restricted to Neomezený) is a Stripe
  dashboard configuration step when the coupon is created, not a code change — already
  captured in the plan doc's David-facing warning.

---

# Fix round 2 (re-review: finding 3 not actually addressed for true concurrency)

## What the re-review found

Round 1's fix for finding 3 was a SELECT-then-INSERT check on `gym_subscriptions.stripe_subscription_id`.
Correct point raised: that closes the *sequential redelivery* case (Stripe retries after a
timeout) but not genuine concurrency — two truly simultaneous deliveries can both run the
SELECT before either commits the INSERT, both see `null`, and both create a fresh `gyms` row
(distinct UUIDs), so `gym_subscriptions.gym_id`'s existing `UNIQUE` constraint can't catch it
either. Needed a real DB-level guarantee, not a better read.

## Duplicate check (done before touching schema, as instructed)

Queried the live `gym_subscriptions` table via the Management API before adding anything:

```
Duplicate non-null stripe_subscription_id values: none (empty result)
Total rows: 3 | non-null stripe_subscription_id: 0 | null: 3
```

All three existing rows (Eurogym Olomouc, NextGen Gym – Camilla Sitteho, NextGen Gym – U
Solných mlýnů) currently have `stripe_subscription_id: null` — these were set up directly,
not through a Stripe checkout that populated this column. No duplicates, so a unique index
would apply cleanly against current data. NULLs are fine either way (Postgres treats each NULL
as distinct in a UNIQUE constraint).

## Why the suggested "UNIQUE + upsert(onConflict)" fix was NOT used as proposed

Before writing the migration I re-read `handleCheckoutComplete` and confirmed (lines ~100-165)
that the `activate_gym_ids` and `custom_gym_ids` paths **intentionally** write multiple
`gym_subscriptions` rows that all share the same `stripe_subscription_id` — this is the "N
gyms on one subscription, one line item, quantity = N" model used for real deals (NextGen is
exactly this: 2 gyms, 1 subscription). Both loops do
`.upsert({..., stripe_subscription_id: subscription.id, ...}, { onConflict: "gym_id" })` per
gym id. A table-wide `UNIQUE` constraint on `gym_subscriptions.stripe_subscription_id` would
make the *second* iteration of either loop fail outright for any real multi-gym deal —
this is live, currently-used functionality, not a hypothetical.

## Fix actually implemented

Added a dedicated claims table, mirroring the `founder_offer_claims` pattern that the re-review
already validated as genuinely race-safe, but scoped to a table that only the new-gym-registration
path touches (never `activate_gym_ids`/`custom_gym_ids`), so it can't conflict with the legitimate
multi-gym-per-subscription model:

- New migration `supabase/migrations/20260728130000_webhook_new_gym_claims.sql`:
  `webhook_new_gym_claims(stripe_subscription_id TEXT PRIMARY KEY, claimed_at TIMESTAMPTZ NOT
  NULL DEFAULT now())`, RLS enabled with no policies (service-role-only, same as
  `founder_offer_claims`). Applied via the Management API and read back (see Verification).
- `stripe-webhook/index.ts`: replaced the round-1 SELECT-then-INSERT guard with an atomic
  `INSERT` into `webhook_new_gym_claims` **before** the gym is created. Only the first of two
  concurrent/duplicate deliveries for the same subscription can insert (PK conflict → Postgres
  error code `23505`, handled as an expected no-op with a `console.log`); any other insert error
  is logged as an actual error (distinct code path) so a real DB problem isn't silently swallowed
  the same way as an expected conflict.
- **No orphan-gym risk by construction**: because the claim is taken *before* `gyms` is ever
  inserted, a losing concurrent request never creates a gym in the first place — there's nothing
  to clean up and no ordering/error-handling gap to worry about (the reviewer's "half-written
  record" concern doesn't apply to this design, since gym creation is now gated behind the claim
  rather than happening unconditionally first).

## Minor point (claim leak between reservation and Stripe call) — also fixed

Widened the try/catch in `create-checkout/index.ts` so it now wraps `stripe.customers.create()`
*and* `stripe.checkout.sessions.create()`, not just the latter. Previously, if customer creation
threw after a founder-offer claim was reserved, the claim would leak for up to
`FOUNDER_CLAIM_TTL_MS` (24h) with nothing to release it. Now any failure in that whole region
triggers the same claim-release-then-rethrow path.

## Verification (re-run after round 2)

```
$ npx tsc --noEmit                                            # 0 output, exit 0
$ deno check supabase/functions/create-checkout/index.ts     # Check ... (clean)
$ deno check supabase/functions/stripe-webhook/index.ts      # Check ... (clean)
```

Migration schema read-back for `webhook_new_gym_claims` (Management API, project
`udqwjqgdsjobdufdxbpn`):
```
columns: stripe_subscription_id text NOT NULL, claimed_at timestamptz NOT NULL default now()
constraints: webhook_new_gym_claims_pkey PRIMARY KEY (stripe_subscription_id)
relrowsecurity: true
```

## Files touched this round
- `supabase/migrations/20260728130000_webhook_new_gym_claims.sql` (new)
- `supabase/functions/stripe-webhook/index.ts`
- `supabase/functions/create-checkout/index.ts`

## Still open / unchanged
- Same three Stripe-ID placeholders (`FOUNDER_COUPON_ID`, `price_TODO_QUARTERLY`,
  `subscription_plans.stripe_price_quarterly_id`) — still need real values once David creates
  the Stripe objects.

---

# Fix round 3 (re-review: round-2 fix had no release/reclaim path at all)

## What the re-review found

Round 2's `webhook_new_gym_claims` genuinely closed the concurrency race (confirmed correct),
but the table had no release path whatsoever — unlike `founder_offer_claims`. If the claim
insert succeeded and then either the `gyms` insert or the `gym_subscriptions` insert failed
(both a plain `return` on error, and both realistic transient-Supabase-blip targets), the claim
became permanent. Worse: `handleCheckoutComplete` never throws on those paths, so `serve()`
still returns HTTP 200 and Stripe considers the event delivered — no retry. A paying customer
would be left with an active Stripe subscription and no gym, forever, with the only visible
trace being a `console.log` that reads identically to a normal duplicate-delivery skip.

## Fix implemented

**Chose explicit release on the two known failure branches over a try/finally guard.** Walked
the whole path from the claim insert to the last successful write to confirm there's no other
early exit in between: the claim insert itself (206-243), the `gyms` insert (245-265), the
non-fatal role/license steps (267-291, neither returns early — `roleError`/`licError` are
logged but don't abort), and the `gym_subscriptions` insert (293-...). Only the `gymError` and
`subError` branches are unaccounted-for exits, matching what the reviewer identified.

Rejected try/finally: a plain `finally` around this region would delete the claim on EVERY
exit, including the success path — and the whole point of `webhook_new_gym_claims` is that a
completed claim stays forever (that's what makes a later legitimate redelivery a no-op instead
of recreating the gym). Making that safe would need a `completed` flag gating the `finally`
body anyway, which is no simpler than just patching the two known branches, and patching them
directly is what the reviewer's instructions asked for as sufficient. No TTL reclaim added —
also per instructions, unneeded machinery for this case (unlike `founder_offer_claims`, which
genuinely needs a self-service reclaim path for abandoned browser checkouts; a webhook failure
here should surface to a human, not silently expire).

Implemented:
- New `releaseWebhookNewGymClaim(subscriptionId)` helper, right above `handleCheckoutComplete`.
  Deletes the `webhook_new_gym_claims` row for that subscription id; logs loudly if the delete
  itself fails (that scenario really would need a TTL or manual fix, but is now at least visible
  in logs rather than silent).
- `gymError` branch: calls the release helper before returning. Nothing was created yet, so
  releasing is safe and unconditionally correct.
- `subError` branch: **also deletes the just-created `gyms` row before releasing the claim** —
  this goes one step beyond what was strictly asked, but closes a residual orphan-gym risk the
  literal instruction would otherwise reintroduce: releasing the claim without cleaning up the
  gym means a legitimate retry (which only re-checks the claim, not "does a gym already exist
  for this owner") would create a brand-new second gym, leaving the first as a genuine orphan.
  Deleting the gym first means retrying after a subscription-insert failure lands on a clean
  slate — no orphan gym, no leaked claim.
- Claim-insert PK-conflict branch: now distinguishes a benign duplicate delivery (a matching
  `gym_subscriptions` row exists — logs at `console.log`, unchanged behavior) from a **stuck
  claim** (no matching row — logs at `console.error` with the subscription id and an explicit
  "needs manual investigation, delete the claim row to unblock" instruction), so a stuck claim
  is now loud instead of blending into the benign-duplicate log line.

## Verification (re-run after round 3)

```
$ npx tsc --noEmit                                            # 0 output, exit 0 (from worktree root)
$ deno check supabase/functions/stripe-webhook/index.ts      # Check ... (clean)
$ deno check supabase/functions/create-checkout/index.ts     # Check ... (clean, unchanged this round)
```

No schema change this round — `webhook_new_gym_claims` itself is unchanged from round 2; only
`stripe-webhook/index.ts` logic changed.

## Files touched this round
- `supabase/functions/stripe-webhook/index.ts` only.

## Still open / unchanged
- Same three Stripe-ID placeholders (`FOUNDER_COUPON_ID`, `price_TODO_QUARTERLY`,
  `subscription_plans.stripe_price_quarterly_id`) — still need real values once David creates
  the Stripe objects.

---

# Fix round 4 (final): double-failure gap + unchecked lookup

Two small findings, both in `stripe-webhook/index.ts`.

## 1. (blocking) `subError` + `gymCleanupError` double-failure reintroduced the bug

Previously, when the gym-cleanup DELETE (added in round 3, on the `subError` path) itself
failed, the code logged the cleanup error but then called `releaseWebhookNewGymClaim`
**unconditionally** anyway. That left the orphan gym in place while also re-opening the
claim: the next delivery's insert would succeed with no PK conflict, silently creating a
*second* gym for the same owner — and since the release was "successful" by design, nothing
would ever flag it. Confirmed via the reviewer's note that `gyms.owner_id` lost its UNIQUE
constraint in migration `20260110205809_*` (multiple gyms per owner is intentional), so
there's no other DB-level backstop.

Fix: only release the claim when the gym cleanup actually succeeded. If `gymCleanupError` is
set, return early **without** releasing — the orphan gym plus the still-held claim means the
next delivery hits the PK conflict, finds no matching `gym_subscriptions` row, and lands on
the round-3 STUCK CLAIM `console.error`, which is exactly the right way to surface a partial
state that now needs a human to clean up the leftover gym by hand.

## 2. Unchecked SELECT in the PK-conflict branch

The `gym_subscriptions` lookup used to diagnose a claim conflict (added in round 3) didn't
check its own `error`. Added an explicit `lookupError` check: on a failed lookup, it's now
reported as a lookup failure (`console.error`) instead of falling through to `completedSub`
being `undefined` and firing a false STUCK CLAIM alarm on what could be a perfectly benign
duplicate delivery.

## Verification

```
$ npx tsc --noEmit                                            # 0 output, exit 0 (from worktree root)
$ deno check supabase/functions/stripe-webhook/index.ts      # Check ... (clean)
$ deno check supabase/functions/create-checkout/index.ts     # Check ... (clean, unchanged this round)
```

## Files touched this round
- `supabase/functions/stripe-webhook/index.ts` only (two small, localized edits).

## Still open / unchanged
- Same three Stripe-ID placeholders (`FOUNDER_COUPON_ID`, `price_TODO_QUARTERLY`,
  `subscription_plans.stripe_price_quarterly_id`) — still need real values once David creates
  the Stripe objects. Everything else in this backend workstream has now been through four
  review rounds with no outstanding findings.
