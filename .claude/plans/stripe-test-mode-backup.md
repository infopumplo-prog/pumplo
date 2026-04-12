# Stripe Test Mode Backup — před live migrací

> Pro případ rollbacku z live mode.
> Tyto hodnoty se dají okamžitě restore-nout pokud live migrace selže.

## Account

- ID: `acct_1TIZn8Evdp2FxnFO`
- Country: CZ
- Currency: CZK

## Test API Keys (ne citlivé, test mode)

- Publishable: `pk_test_51TIZn8Evdp2FxnFOmf0JtUtGCVuBayJARwTvWulpIbXNifzeOL0MAhqEO1bDxg2st81lQlgbtTTIOj68cB45XSxa0043avEj9F_PLACEHOLDER`
  - (Skutečný klíč je v `.env` lokálně, mimo repo)
- Secret: uložený v Supabase secrets jako `STRIPE_SECRET_KEY` (aktuálně test mode)
- Webhook secret: uložený v Supabase secrets jako `STRIPE_WEBHOOK_SECRET` (aktuálně test mode)

## Test Products

| Plan | Product ID | Metadata |
|---|---|---|
| Start | `prod_UH8L8EGJhmR65X` | `plan_id: start` |
| Profi | `prod_UH8LJkrcL4P2yl` | `plan_id: profi` |
| Premium | `prod_UH8L4OR2X3wFpS` | `plan_id: premium` |

## Test Prices (6)

| Plan | Period | Price ID | Amount (halíře) | Amount (CZK) |
|---|---|---|---|---|
| Start | monthly | `price_1TIa4zEvdp2FxnFO3favQISR` | 199000 | 1 990 |
| Start | annual | `price_1TIa50Evdp2FxnFObj0umzSN` | 1990000 | 19 900 |
| Profi | monthly | `price_1TIa51Evdp2FxnFOjxDA7qFq` | 399000 | 3 990 |
| Profi | annual | `price_1TIa51Evdp2FxnFOyG8IDLhJ` | 3990000 | 39 900 |
| Premium | monthly | `price_1TIa52Evdp2FxnFOoJIEJKlF` | 699000 | 6 990 |
| Premium | annual | `price_1TIa52Evdp2FxnFOYJVPYkFM` | 6990000 | 69 900 |

## Test Webhook Endpoint

- ID: `we_1TIa71Evdp2FxnFO2BR5aTJu`
- URL: `https://udqwjqgdsjobdufdxbpn.supabase.co/functions/v1/stripe-webhook`
- Enabled events: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`, `customer.subscription.updated`
- Secret: v Supabase secrets jako `STRIPE_WEBHOOK_SECRET`

## Test Customer Portal Config

- ID: `bpc_1TKaJPEvdp2FxnFOVLCCk4SK`
- `is_default=true`
- Features: cancel at_period_end, subscription update (3 products × 2 prices), invoice history, payment method update, customer update
- Return URL: `https://pumplo-admin.vercel.app/`
- Headline: "Pumplo — Správa předplatného"

## DB `subscription_plans` test Stripe IDs

```sql
SELECT id, stripe_product_id, stripe_price_monthly_id, stripe_price_annual_id
FROM subscription_plans
ORDER BY sort_order;
```

(Hodnoty odpovídají test mode IDs výše.)

## Hardcoded mappings v kódu (test mode)

**`pumplo/supabase/functions/stripe-webhook/index.ts`** — řádek ~19-26, `PRICE_TO_PLAN` const:

```ts
const PRICE_TO_PLAN = {
  "price_1TIa4zEvdp2FxnFO3favQISR": { plan_id: "start", period: "monthly" },
  "price_1TIa50Evdp2FxnFObj0umzSN": { plan_id: "start", period: "annual" },
  "price_1TIa51Evdp2FxnFOjxDA7qFq": { plan_id: "profi", period: "monthly" },
  "price_1TIa51Evdp2FxnFOyG8IDLhJ": { plan_id: "profi", period: "annual" },
  "price_1TIa52Evdp2FxnFOoJIEJKlF": { plan_id: "premium", period: "monthly" },
  "price_1TIa52Evdp2FxnFOYJVPYkFM": { plan_id: "premium", period: "annual" },
};
```

**`pumplo-admin/src/pages/Register.tsx`** — řádek ~7-20, `STRIPE_PRICES` const:

```ts
const STRIPE_PRICES = {
  start: {
    monthly: 'price_1TIa4zEvdp2FxnFO3favQISR',
    annual: 'price_1TIa50Evdp2FxnFObj0umzSN',
  },
  profi: {
    monthly: 'price_1TIa51Evdp2FxnFOjxDA7qFq',
    annual: 'price_1TIa51Evdp2FxnFOyG8IDLhJ',
  },
  premium: {
    monthly: 'price_1TIa52Evdp2FxnFOoJIEJKlF',
    annual: 'price_1TIa52Evdp2FxnFOYJVPYkFM',
  },
}
```

## Rollback trigger

Pokud live migrace v `stripe-live-migration-runbook.md` selže v kterémkoliv kroku 6-8, restore proceduru najdeš na konci toho runbooku. Všechny hodnoty výše stačí vrátit zpátky do secrets, code, a DB.
