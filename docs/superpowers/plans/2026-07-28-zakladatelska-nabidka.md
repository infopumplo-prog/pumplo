# Zakladatelská nabídka — implementační plán

**Goal:** Nově registrovaná posilovna si může koupit Neomezený plán na 3 měsíce předem za 4 500 Kč (místo 9 000), po kvartálu pokračuje měsíčně za 3 000 Kč.

**Architecture:** Nová čtvrtletní Stripe cena na stávajícím produktu Neomezený + kupón 50 % (`duration: once`). Nárok se ověřuje VÝHRADNĚ serverově v `create-checkout` (majitel nesmí mít žádnou existující gym_subscription). Po dokončení checkoutu webhook překlopí subscription na schedule: fáze 1 = zaplacený kvartál, fáze 2 = měsíční 3 000.

**Tech Stack:** Supabase edge functions (Deno/TS), Postgres migrace, React/TS (pumplo-admin), Stripe API.

## Global Constraints

- **Ceník se NEMĚNÍ:** Start 1 500/měs (15 000/rok), Neomezený 3 000/měs (30 000/rok). Zakladatelská nabídka je časově omezená akvizice, ne nová cena.
- Sleva **jen na Neomezený**, nikdy na Start.
- **4 500 Kč za 3 měsíce** předem (plná cena kvartálu 9 000). Aktivace kitu 500 Kč se slevě NEPODLÉHÁ → zákazník platí dnes 5 000 Kč.
- Nárok: **jen první posilovna daného majitele** — žádná existující `gym_subscriptions` (ani zrušená), a nikdy ne v `activate_gym_ids` / `additional_gym` flow.
- Deadline: **registrace do 31. 12. 2026** (na datum registrace, ne na konec slevy). Bez stropu počtu posiloven.
- Po kvartálu **měsíčně 3 000**, ne další kvartál za 9 000.
- Nárok se NIKDY nesmí dát vynutit z klienta — klient smí jen požádat, server rozhoduje.
- Jazyk: kód a commit messages anglicky, komentáře a UI česky.
- Před dokončením: `npx tsc --noEmit` = 0 chyb (oba repozitáře).

## Stripe objekty (zakládá David / doplní se později)

Kód je píše jako konstanty s placeholdery — až se objekty vytvoří, doplní se hodnoty:

| Objekt | Popis | Placeholder |
|---|---|---|
| Price (quarterly) | 9 000 CZK, `recurring: {interval: month, interval_count: 3}`, na stávajícím produktu Neomezeného | `price_TODO_QUARTERLY` |
| Coupon | 50 % off, `duration: once`, omezený na produkt Neomezeného | `TODO_COUPON_ZAKLADATELSKA` |

> ⚠️ **Kupón MUSÍ mít `applies_to.products` omezené na produkt Neomezeného.** Stripe jinak aplikuje session-level kupón na všechny položky včetně implementačního poplatku 500 Kč — kód to nijak nevynutí, je to nastavení ve Stripu. Zkontrolovat při zakládání.

## Datový kontrakt mezi workstreamy

Frontend → `create-checkout` posílá navíc pole `founder_offer: true` a jako `price_id` čtvrtletní cenu. Server:
- ověří nárok; když není → **400 `Zakladatelská nabídka je jen pro první posilovnu.`**
- když je → do checkout session přidá `discounts: [{ coupon }]` a **vynechá `allow_promotion_codes`** (Stripe je nedovolí naráz).
- do `metadata` zapíše `founder_offer: "true"`.

---

## Workstream A — backend (repo `~/pumplo`, větev `feat/zakladatelska-nabidka`)

### A1: Migrace
- `subscription_plans`: přidat `stripe_price_quarterly_id TEXT` (allowlist cen v `create-checkout` z něj bude číst).
- `gym_subscriptions`: rozšířit CHECK `billing_period` o `'quarterly'`.
- `gym_subscriptions`: přidat `is_founder_offer BOOLEAN NOT NULL DEFAULT false` (audit + ochrana proti opakování).
- Aplikovat přes Supabase Management API (PAT v `~/.supabase-pat`), ne přes dashboard.

### A2: `create-checkout` — nárok a sleva
- Do allowlistu cen přidat `stripe_price_quarterly_id`.
- Nová funkce `isEligibleForFounderOffer(adminClient, user_id)`: `true` jen když majitel nemá ŽÁDNÝ řádek v `gym_subscriptions` pro žádnou svou posilovnu (bez ohledu na status).
- Když `founder_offer` a nárok není, nebo jde o activate/additional_gym flow → 400 s českou hláškou.
- Když nárok je → `discounts: [{ coupon: FOUNDER_COUPON_ID }]`, `allow_promotion_codes` vynechat, `metadata.founder_offer = "true"`.
- Kit 500 Kč zůstává v line items v plné výši.

### A3: `stripe-webhook` — překlopení na měsíční po kvartálu
- V `checkout.session.completed`: když `metadata.founder_offer === "true"`, převést vzniklou subscription na `subscriptionSchedules` — fáze 1 = zaplacený kvartál (1 iterace), fáze 2 = měsíční cena Neomezeného, `iterations` neomezeně.
- Do `gym_subscriptions` zapsat `billing_period: 'quarterly'`, `is_founder_offer: true`.
- Idempotence: opakované doručení eventu nesmí založit druhý schedule.

## Workstream B — registrace (repo `~/pumplo-admin`, větev `feat/zakladatelska-nabidka`)

### B1: Třetí karta v kroku 5 `Register.tsx`
Pořadí: Start · **Zakladatelská nabídka** (uprostřed, zvýrazněná) · Neomezený. Předloha 1:1 v mockupu `~/Desktop/pumplo-pricing-zakladatelska-nabidka.png` (zdroj HTML: viz plán níže).
- Badge „NEJVÝHODNĚJŠÍ — DO 31. 12. 2026“ se přesouvá z Neomezeného na novou kartu (dva doporučené plány naráz si konkurují).
- Cena: přeškrtnutých `9 000`, velké `4 500`, jednotka „Kč / 3 měsíce“.
- Pod cenou box: „Vychází na **1 500 Kč měsíčně** — stejně jako Start, ale úplně bez limitů.“
- Odznak „Ušetříte 4 500 Kč“.
- Patička karty: „Nevyužité měsíce vrátíme“, „Po 3 měsících pokračuje za 3 000 Kč/měsíc, kdykoli lze zrušit“, „Platí jen pro nově registrované posilovny“.
- Přepínač Měsíčně/Ročně ovlivňuje **jen Start a Neomezený**; zakladatelská karta stojí mimo něj (je to jednorázový kvartál).

### B2: Krok 6 (souhrn) + odeslání
- Souhrn u zakladatelské nabídky: „4 500 Kč za 3 měsíce“ + „Aktivace Pumplo kitu 500 Kč“ + řádek **Celkem dnes 5 000 Kč**.
- Do `create-checkout` posílat čtvrtletní `price_id` + `founder_offer: true`.
- Serverovou hlášku o nenároku zobrazit uživateli česky (nespoléhat na obecné „Neplatný plán“).

### B3: i18n
- Všechny nové stringy do `src/i18n/locales/cs.ts` i `en.ts` (klíče `register.founder_*`), žádné hardcoded texty v komponentě.

---

## Spouštěcí checklist (po `stripe login`)

**Nejdřív TEST mód, teprve po ověření LIVE.** Jde o peníze; test proběhne celý (checkout → webhook → řádky v DB) na testovacích klíčích a až pak se totéž zopakuje s `--live`.

```bash
# 0) zjistit produkt Neomezeného (z jeho měsíční ceny)
stripe prices retrieve price_1TshbLEvdp2FxnFO4UUBStkz --live   # → pole "product": prod_XXXX

# 1) čtvrtletní cena 9 000 Kč (CZK = haléře → 900000)
stripe prices create --live \
  -d product=prod_XXXX \
  -d currency=czk \
  -d unit_amount=900000 \
  -d "recurring[interval]=month" \
  -d "recurring[interval_count]=3" \
  -d nickname="Neomezeny - kvartal"

# 2) kupón 50 %, jednorázově, OMEZENÝ NA PRODUKT (jinak strhne i 500 Kč za kit!)
stripe coupons create --live \
  -d percent_off=50 \
  -d duration=once \
  -d name="Zakladatelska nabidka" \
  -d "applies_to[products][0]=prod_XXXX"
```

Po vytvoření doplnit ID na **čtyři místa** (musí sedět všechna, jinak checkout spadne):
1. `create-checkout/index.ts` → `FOUNDER_COUPON_ID`
2. `stripe-webhook/index.ts` → klíč `price_TODO_QUARTERLY` v `PRICE_TO_PLAN`
3. `pumplo-admin/src/pages/Register.tsx` → `FOUNDER_QUARTERLY_PRICE_ID`
4. DB: `update subscription_plans set stripe_price_quarterly_id = '<price_id>' where id = 'premium'` (pozor — Neomezený má legacy id `premium`)

Pak nasadit edge funkce (`supabase functions deploy create-checkout stripe-webhook`), zmergovat obě větve a nasadit admin na Vercel.

**Ověřit po nasazení:** v test módu projít registraci nové posilovny se zakladatelskou nabídkou → zkontrolovat, že Stripe naúčtoval 4 500 + 500 (a NE 2 500, což by znamenalo, že kupón sáhl i na kit), že v `gym_subscriptions` je `billing_period='quarterly'` a `is_founder_offer=true`, a že vznikl subscription schedule s druhou fází na měsíčních 3 000.

## Co zůstává na Davidovi
1. `stripe login` — oba klíče v CLI vypršely, bez toho nejdou založit Price ani Coupon.
2. Potvrdit, který Telegram chat je „Pumplo General“ (`TELEGRAM_CHAT_ID` v Supabase secrets je jeden konkrétní chat, obsah neznám) + Telegram usernames Bendy a Tomáše pro označení.
3. Rozhodnout, jestli pilotní program „5 gymů zdarma na 3 měsíce“ z `PUMPLO_KB.md` ještě běží — pokud ne, označit v KB jako NEPLATNÝ.
