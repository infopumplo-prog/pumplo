# Stripe Live Mode Migration — Runbook

> Status: Připravený k provedení
> Test mode stav: Plně funkční a otestovaný end-to-end (2026-04-10)
> Cílový stav: Live mode, schopný přijímat reálné platby od skutečných zákazníků

## Preflight — David's actions (PŘED spuštěním runbooku)

**1. Business details v Stripe Dashboard (live mode)**

Přepni v Stripe Dashboardu doleva nahoře na "Live mode" a vyplň v `Settings → Business settings`:

- **Business details**
  - Legal business name: `GynTools CZ s.r.o.`
  - Business structure: Limited liability company
  - Tax ID (DIČ): vyplň CZ + IČ 27804461
  - Industry: Fitness / Wellness
  - Website: `https://pumplo.com`
  - Support email: `info@pumplo.com` (nebo tvůj)
  - Support phone: (volitelné)
  - Business address: sídlo GynTools CZ

- **Branding** (objeví se na Checkout, faktura, portalu)
  - Icon: Pumplo logo (čtverec 512×512)
  - Logo: Pumplo logo wide
  - Brand color: `#4CC9FF` (Pumplo modrá)
  - Accent color: `#0f172a` nebo tmavší

- **Public business details**
  - Public business name: `Pumplo`
  - Statement descriptor: `PUMPLO` (max 22 znaků, objevuje se na bance)
  - Shortened statement descriptor: `PUMPLO`

**2. Get live API keys**

Settings → API keys → zkopíruj:
- Publishable key (pk_live_...) — lze poslat přes Telegram, není citlivý
- Secret key (sk_live_...) — **NIKDY přes Telegram nebo cloud**. Dej ho Claudemu přes terminál session.

**3. Oznam Claudeovi že preflight hotový** — pošli na Telegram "Stripe live preflight hotovo"

---

## Runbook — Claude spouští (s tvými API keys)

### Step 1: Save live secret to environment (local only)

```bash
export STRIPE_LIVE_KEY='sk_live_...'
```

(Klauzule: nikdy neukládat do souboru, jen do běžící session.)

### Step 2: Create 3 live Products with metadata

```bash
# Start
curl -s -X POST "https://api.stripe.com/v1/products" -u "$STRIPE_LIVE_KEY:" \
  --data-urlencode "name=Pumplo Start" \
  --data-urlencode "description=Základní retenční platforma pro malé fitko" \
  --data-urlencode "metadata[plan_id]=start"

# Profi
curl -s -X POST "https://api.stripe.com/v1/products" -u "$STRIPE_LIVE_KEY:" \
  --data-urlencode "name=Pumplo Profi" \
  --data-urlencode "description=Kompletní retenční platforma s analytikou pro rostoucí fitka" \
  --data-urlencode "metadata[plan_id]=profi"

# Premium
curl -s -X POST "https://api.stripe.com/v1/products" -u "$STRIPE_LIVE_KEY:" \
  --data-urlencode "name=Pumplo Premium" \
  --data-urlencode "description=Bez limitů, featured na mapě, prioritní podpora" \
  --data-urlencode "metadata[plan_id]=premium"
```

Uložit si vrácené `prod_...` IDs.

### Step 3: Create 6 Prices (monthly + annual per plan)

Ceny v halířích (1990 CZK = 199000 halířů).

```bash
# Start monthly 1990 CZK
curl -s -X POST "https://api.stripe.com/v1/prices" -u "$STRIPE_LIVE_KEY:" \
  --data-urlencode "product=prod_START_LIVE_ID" \
  --data-urlencode "unit_amount=199000" \
  --data-urlencode "currency=czk" \
  --data-urlencode "recurring[interval]=month" \
  --data-urlencode "metadata[plan_id]=start" \
  --data-urlencode "metadata[period]=monthly"

# Start annual 19900 CZK
curl -s -X POST "https://api.stripe.com/v1/prices" -u "$STRIPE_LIVE_KEY:" \
  --data-urlencode "product=prod_START_LIVE_ID" \
  --data-urlencode "unit_amount=1990000" \
  --data-urlencode "currency=czk" \
  --data-urlencode "recurring[interval]=year" \
  --data-urlencode "metadata[plan_id]=start" \
  --data-urlencode "metadata[period]=annual"

# (same pattern for Profi 3990/39900 and Premium 6990/69900)
```

Uložit si 6 `price_...` IDs.

### Step 4: Create Customer Portal configuration

Stejná konfigurace jako test mode (`bpc_1TKaJPEvdp2FxnFOVLCCk4SK`), jen pro live:

- `default_return_url`: `https://admin.pumplo.com/` nebo `https://pumplo-admin.vercel.app/`
- Cancel at_period_end enabled
- Subscription update s prorations, povolené 3 produkty a jejich prices
- Payment method update, invoice history, customer update (email/phone/tax_id)

Skript je stejný jako byl použit v test módu, jen pod live keys. Vytvoří `bpc_...` ID.

### Step 5: Register live webhook endpoint

Nejdřív deploy nebo potvrď že `stripe-webhook` Edge Function existuje v live URL:
`https://udqwjqgdsjobdufdxbpn.supabase.co/functions/v1/stripe-webhook`

Pak v Stripe Dashboardu (nebo přes API):

```bash
curl -s -X POST "https://api.stripe.com/v1/webhook_endpoints" -u "$STRIPE_LIVE_KEY:" \
  --data-urlencode "url=https://udqwjqgdsjobdufdxbpn.supabase.co/functions/v1/stripe-webhook" \
  --data-urlencode "enabled_events[]=checkout.session.completed" \
  --data-urlencode "enabled_events[]=invoice.paid" \
  --data-urlencode "enabled_events[]=invoice.payment_failed" \
  --data-urlencode "enabled_events[]=customer.subscription.deleted" \
  --data-urlencode "enabled_events[]=customer.subscription.updated"
```

Z odpovědi si uložit `secret: whsec_...` — to je nový webhook secret.

### Step 6: Update Supabase secrets (LIVE keys)

```bash
# Via Supabase Management API (not CLI — CLI may require Docker)
curl -X POST "https://api.supabase.com/v1/projects/udqwjqgdsjobdufdxbpn/secrets" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '[
    {"name":"STRIPE_SECRET_KEY","value":"sk_live_..."},
    {"name":"STRIPE_WEBHOOK_SECRET","value":"whsec_..."}
  ]'
```

**POZOR:** Tímto krokem se Edge Functions začnou používat live keys. Od teď v systému skutečné platby.

### Step 7: Update hardcoded Price IDs v kódu

**Soubor 1:** `pumplo/supabase/functions/stripe-webhook/index.ts`

V PRICE_TO_PLAN mapě nahradit 6 test `price_1TIa...` IDs za 6 nových `price_...` IDs z kroku 3.

**Soubor 2:** `pumplo-admin/src/pages/Register.tsx`

V STRIPE_PRICES objektu nahradit 6 test IDs za live IDs.

**Soubor 3:** DB v pumplo projektu — `subscription_plans` tabulka

```sql
UPDATE subscription_plans SET
  stripe_product_id = 'prod_NEW_LIVE',
  stripe_price_monthly_id = 'price_NEW_LIVE_MONTHLY',
  stripe_price_annual_id = 'price_NEW_LIVE_ANNUAL'
WHERE id = 'start';
-- opakovat pro profi a premium
```

### Step 8: Deploy updated Edge Function + commit + push

```bash
cd /Users/davidnovotny/Desktop/pumplo
SUPABASE_ACCESS_TOKEN=sbp_... npx supabase functions deploy stripe-webhook \
  --project-ref udqwjqgdsjobdufdxbpn --no-verify-jwt

git add supabase/functions/stripe-webhook/index.ts
git commit -m "chore(stripe): switch to live mode price IDs"
git push origin main

# pumplo-admin
cd /Users/davidnovotny/Desktop/pumplo-admin
git add src/pages/Register.tsx
git commit -m "chore(stripe): switch register flow to live mode price IDs"
git push origin main
# (Vercel auto-deploys)
```

### Step 9: Smoke test flow v live módu

**Příprava:**
- Máš fyzickou kartu (může být tvoje vlastní, zkusíš nejnižší plán — 1990 Kč)
- Připravený je test gym který ti nevadí potom smazat z DB
- Jsi schopný zrušit subscription okamžitě po testu (via Customer Portal)

**Flow:**
1. Otevři `pumplo-admin.vercel.app/register` v incognito (NE přes hero "Spustit Pumplo" — je to rychlejší)
2. Projdi wizard s reálnými daty (fiktivní gym "Test Live Migration")
3. Vyber Start / Měsíčně
4. V Stripe Checkout vyplň reálnou kartu → Subscribe
5. Ověř v pumplo-admin že Dashboard ukazuje "Plán: Start" + tlačítko "Správa předplatného"
6. V Stripe Dashboard (live mode) ověř že subscription je `active`, customer vytvořený, faktura s DPH zobrazena
7. V Customer Portal (z Dashboard buttonu) klikni "Zrušit předplatné" → cancel_at_period_end
8. V Stripe Dashboard refund celou částku → faktura bude "refunded"
9. V DB smaž test gym row (webhook `customer.subscription.deleted` to měl už nastavit na cancelled, ale gym row tam zůstane)

**Co sleduj v logs během testu:**
- Stripe webhook attempts (Dashboard → Developers → Events) — všechny 2xx
- Supabase Edge Function logs (Dashboard → Functions → stripe-webhook) — žádné errors
- DB `gym_subscriptions` tabulka — nová řada s live stripe_customer_id + stripe_subscription_id

### Step 10: Final verification

Zkontroluj:
- [ ] Faktura v Stripe Dashboard má všechny business details (DIČ, adresa)
- [ ] Customer Portal text je v češtině
- [ ] Email receipt dorazil (ze zkušebního registračního emailu)
- [ ] Eurogym grandfathered stále funguje — přihlásit Eurogym ownera a Dashboard musí fungovat bez problémů (is_grandfathered bypasses Stripe)

---

## Rollback plan (kdyby cokoli selhalo mezi Step 6-8)

Live mode zavedené secrets v Supabase a code v Gitu pointuje na live IDs. Rollback:

```bash
# Revertuj secrets na test keys
curl -X POST "https://api.supabase.com/v1/projects/udqwjqgdsjobdufdxbpn/secrets" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '[
    {"name":"STRIPE_SECRET_KEY","value":"sk_test_..."},
    {"name":"STRIPE_WEBHOOK_SECRET","value":"whsec_test_..."}
  ]'

# Revertuj code
cd /Users/davidnovotny/Desktop/pumplo
git revert HEAD
git push
cd /Users/davidnovotny/Desktop/pumplo-admin
git revert HEAD
git push

# Revertuj DB
UPDATE subscription_plans SET
  stripe_product_id = 'prod_UH8L...TEST',
  ...
WHERE id = 'start';
```

Test keys + IDs si prophylakticky zálohovat do `.claude/plans/stripe-test-mode-backup.md` před migrací.

---

## Post-migration úklid (1-2 dny po launchi)

- Disable či smaž test mode webhook endpoint (už nebude dostávat eventy, ale zbytečně visí)
- Zkontroluj prvních 5 skutečných subscription v Stripe Dashboard — jestli se neobjevily anomálie (duplicates, failed webhooks atd.)
- Enable Stripe email notifications pro payment failures
- Enable Stripe Radar (fraud detection) — zdarma pro CZK účty
- Backup strategie: povolit Supabase daily backups (Settings → Database → Backups)
