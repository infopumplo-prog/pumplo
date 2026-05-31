# Pumplo Launch Plan — Landing + SaaS Subscription

> Status: AKTIVNÍ
> Vytvořeno: 2026-04-10
> Autor: David Novotný + Claude

## Kontext

Napojujeme Lovable landing page (pumplo.com) na hlavní Pumplo appku (app.pumplo.com) s plnou self-service subscription (Start/Profi/Premium). Plán je postupný — nejdřív rychlé opravy, pak SaaS infrastruktura.

**Architektura:**
- **pumplo.com / www.pumplo.com** → Lovable landing page (marketing, pricing, CTA)
- **app.pumplo.com** → Vercel Pumplo app (registrace, cvičení, admin)

---

## FÁZE 0 — Oprava domény (HOTOVO po dnešku) ⚡

**Cíl:** Vrátit pumplo.com na Lovable landing page, aby byla dostupná.

- [ ] Jít do Lovable → Project Settings → Domains
- [ ] Connect existing domain: `pumplo.com` + `www.pumplo.com`
- [ ] Lovable potvrdí DNS (už směřuje na 185.158.133.1)
- [ ] Počkat na SSL re-aktivaci (pár minut)
- [ ] Ověřit: https://pumplo.com / https://www.pumplo.com se načítá

**Odhad:** 10 minut

---

## FÁZE 1 — Landing Page Polish 🎨 ✅ HOTOVO (2026-04-10)

**Cíl:** Doladit landing page texty, CTA a cross-linking.

### 1.1 Stránka `/client` — Dokončit "Jak to funguje?"
- [x] Sekce "Jak to funguje?" přidaná (3 karty: Stáhni → Řekni o sobě → Začni cvičit)
- [x] Sekce "Co z toho budeš mít?" (4 benefity)
- [x] Tlačítko "Stáhnout aplikaci" v hero vede na `https://app.pumplo.com`

### 1.2 Stránka `/business` — Doladit CTA
- [x] Sekce "Jak to pro vás bude fungovat?" (4-krok timeline)
- [x] Sekce "Kolik to stojí?" (3 pricing karty)
- [x] Finální CTA zmenšené + přepsané na nezávaznou konzultaci (outlined button)
- [x] Pricing tlačítka mají popisek o platbě kartou a okamžité faktuře
- [ ] Tlačítka "Vybrat Start/Profi/Premium" zatím vedou na `/contact?plan=X` — OK pro teď, změníme ve FÁZI 6

### 1.3 Cross-linking Landing → App
- [x] Hero `/client`: "Stáhnout aplikaci" → `https://app.pumplo.com`
- [x] Header cross-linking `/client` ↔ `/business` funguje

### 1.4 Publish
- [x] Publikováno na pumplo.com — "Up to date" v Lovable

**Odhad:** 1-2 hodiny

---

## FÁZE 2 — DB Foundation (Subscription Tables) 🗄️ ✅ HOTOVO (2026-04-10)

**Cíl:** Databázové tabulky pro subscription management.

**Lokace:** Hlavní Pumplo Supabase (`udqwjqgdsjobdufdxbpn`)

**Status:** Většina infrastruktury už existovala z dřívější práce. Dnes doplněno `is_featured` do `public_gyms` view.

### 2.1 Tabulky
- [x] `subscription_plans` existuje (id, name, price_monthly, price_annual, limits JSONB, sort_order)
- [x] Seed: Start (1990/19900), Profi (3990/39900), Premium (6990/69900) s limity — ověřeno
- [x] `gym_subscriptions` existuje (gym_id, plan_id, status, stripe_*, period, is_grandfathered)
- [x] `subscription_events` existuje (event_type, from/to_plan, metadata)

### 2.2 Funkce & Views
- [x] `check_gym_limit()` funkce existuje
- [x] `public_gyms` view má `is_featured` — přidáno 2026-04-10 (Eurogym=true, DSN Gym=false)

### 2.3 Eurogym grandfathered
- [x] Eurogym Olomouc má `plan_id='premium'`, `is_grandfathered=true`, `current_period_end='2099-12-31'`

### 2.4 RLS politiky
- [x] `subscription_plans` — `subscription_plans_select_all`
- [x] `gym_subscriptions` — `gym_subscriptions_select_own` + `gym_subscriptions_admin_all`
- [x] `subscription_events` — `subscription_events_admin_only`

---

## FÁZE 3 — Stripe Integrace 💳 ✅ HOTOVO (2026-04-10)

**Cíl:** Platební brána s automatickým fakturováním a self-service portálem.

**Status:** Většina integrace byla už hotová z dřívější práce (Apr 4). Dnes (Apr 10) dokončen Customer Portal + `create-portal-session` Edge Function + UI button v Dashboard.

### 3.1 Stripe setup (dashboard)
- [x] Stripe účet aktivní v test módu — `acct_1TIZn8Evdp2FxnFO` (Pumplo/GynTools CZ)
- [x] Products: Pumplo Start, Pumplo Profi, Pumplo Premium (s `plan_id` v metadata)
- [x] Prices: 6× (monthly + annual) — CZK 1990/19900, 3990/39900, 6990/69900
- [x] Webhook endpoint registrovaný: `we_1TIa71Evdp2FxnFO2BR5aTJu` (5 eventů, enabled)
- [x] Customer Portal config: `bpc_1TKaJPEvdp2FxnFOVLCCk4SK` (default, cancel at_period_end, plan switching mezi Start/Profi/Premium s prorations, payment method update, invoice history)

### 3.2 Supabase Edge Functions
- [x] `create-checkout` v9 ACTIVE — vytvoří Stripe Checkout s metadata (user_id, gym_name, address, phone, machine_ids)
- [x] `stripe-webhook` v14 ACTIVE — zpracovává:
  - [x] `checkout.session.completed` → vytvoří gym + subscription + user_role + machines + event log
  - [x] `invoice.paid` → obnoví period_end, renewed event
  - [x] `invoice.payment_failed` → status = past_due
  - [x] `customer.subscription.deleted` → status = cancelled + unpublish gym
  - [x] `customer.subscription.updated` → upgrade/downgrade + overLimit unpublish
- [x] `create-portal-session` v1 ACTIVE — ověří auth, najde gym owner_id=user, odmítne grandfathered, vrátí Stripe Portal URL

### 3.3 Env vars
- [x] STRIPE_SECRET_KEY (test mode)
- [x] STRIPE_WEBHOOK_SECRET
- [x] Stripe Price IDs hardcoded v `stripe-webhook/index.ts` PRICE_TO_PLAN mapping + uložené do `subscription_plans.stripe_price_*_id` sloupců (DB jako source of truth pro budoucí refactor)

### 3.4 UI integrace
- [x] Dashboard.tsx (pumplo-admin) — "Správa předplatného" tlačítko s CreditCard ikonou + loading state (volá `supabase.functions.invoke('create-portal-session')`), skryto pro grandfathered Eurogym

### Otevřené položky pro produkční go-live
- [ ] Přepnutí Stripe na **live mode** (nové API keys, nový webhook secret, nová Customer Portal config)
- [ ] Business údaje v Stripe Dashboard pro faktury (GynTools CZ IČ/DIČ, adresa, logo)
- [ ] Email šablony v Stripe (invoice, past_due, cancelled)

---

## FÁZE 4 — Self-Registration Flow 📝 ✅ HOTOVO

**Cíl:** Majitel fitka se zaregistruje na pumplo-admin.vercel.app, zaplatí a dostane se do dashboardu.

**Lokace:** `pumplo-admin` repo (separate Vite SPA, `pumplo-admin.vercel.app`).

### 4.1 Registration route
- [x] `Register.tsx` — 6-step wizard (pumplo-admin)
  1. **Název posilovny**
  2. **Adresa + telefon**
  3. **Vytvořit účet** (email + password se sign-up přes Supabase auth API)
  4. **Výběr strojů** (kategorizované: stroje, free weight, cardio, accessories)
  5. **Výběr plánu** + monthly/annual toggle
  6. **Summary** → handleCheckout() → create-checkout → Stripe Checkout

### 4.2 Auto-provisioning (po checkout.session.completed)
- [x] Vytvořit `gyms` record (is_published=false)
- [x] Nastavit `user_roles` na `business`
- [x] Vytvořit `gym_subscriptions` se stripe IDs a obdobím
- [x] Přiřadit vybrané stroje (`gym_machines`)
- [x] Log do `subscription_events`
- [ ] Welcome email (Stripe Receipt funguje, custom welcome email = future)

### 4.3 Post-payment onboarding
- [x] Dashboard zobrazuje "Dokončete profil" card když chybí logo/cover/address/opening_hours
- [x] GymProfilePage.tsx umožňuje doplnit detaily
- [x] Gym je unpublished dokud owner neklikne Publikovat

### Ověřeno funguje end-to-end (2026-04-10)
- Fresh `/register` flow → Stripe Checkout (test karta 4242) → webhook fires → gym created (`xxx`, owner `ae004179...`) → Start plan → login redirect → Dashboard → "Správa předplatného" → Stripe Customer Portal otevřen → plan switching UI verified (Start/Profi/Premium + měsíčně/ročně toggle + limity z Stripe metadata) → return flow zpět na Dashboard
- Také aktivní: `gggg` (Start, `cus_UIBQi8VEEGdpCw`), `Eurogym` (grandfathered Premium, bez Stripe)
- DSN Gym orphan smazán (2026-04-10) — cascade vyčistil subscription + 3 machines

### Známé drobnosti pro produkční launch
- Welcome email (custom) — zatím jen Stripe Receipt; nice-to-have
- Business údaje v Stripe Dashboard (IČ 27804461, logo) pro faktury
- Live mode switch: nové API keys + nový webhook endpoint + nová Customer Portal config

---

## FÁZE 5 — Feature Gating 🔒 ⚠️ TÉMĚŘ HOTOVO

**Cíl:** Enforcement limitů podle zakoupeného tieru.

**Status po auditu 2026-04-10:** Většina hotová. Zbývá jen chránit `GymConversationsPage` proti přímé URL.

### 5.1 React hook
- [x] `useSubscription()` — vrací plán, status, limity, `canUseFeature()`, `checkLimit()`, `getLimit()`, `daysRemaining`, `isActive`, `isPastDue`

### 5.2 Enforcement body (admin app)
- [x] `GymProfilePage.tsx` — `checkLimit` pro max_machines/max_photos/max_trainers, `canUseFeature('instagram_display')` pro IG field
- [x] `GymMembersPage.tsx` — `canUseFeature('member_detail_level')` pro column visibility
- [ ] `GymMembersDetailDrawer.tsx` — **ověřit** že workouts/week, streak jsou gated od Profi
- [x] `Dashboard.tsx` — Analytika tréninků + Rozložení cílů gated přes `canUseFeature('analytics_level')` + UpgradePrompt lock cards (viditelné dnes v testu Start planu)
- [x] `GymMessagesPage.tsx` — měsíční broadcast limit + LimitWarning
- [ ] `GymConversationsPage.tsx` — **chybí page-level guard** (Sidebar má lock ale přímá URL není chráněná). RLS na DB úrovní pravděpodobně zastaví fetch, ale UX je rozbité
- [x] `Sidebar.tsx` — Lock ikona + conditionally hidden items přes `canUseFeature`

### 5.3 Upgrade prompty
- [x] `UpgradePrompt.tsx` komponenta — compact i full variant
- [x] `LimitWarning.tsx` komponenta — pro countable limity
- [x] Lock ikony u zamčených features
- [x] Hláška "Tato funkce je dostupná od plánu X"
- [ ] **Chybí:** Přímý link z UpgradePromptu na Stripe Customer Portal (teď je text "Pro upgrade kontaktujte podporu nebo změňte plán v nastavení")

---

## FÁZE 6 — Landing ↔ App Wire-up 🔗

**Cíl:** Propojit landing page pricing tlačítka s registration flow.

### 6.1 Lovable landing update
- [ ] Prompt: změnit `/contact?plan=X` → `https://app.pumplo.com/register?plan=X` u všech 3 pricing karet
- [ ] Hero "Stáhnout aplikaci" (/client) → app store links (nebo `app.pumplo.com` pro PWA install)
- [ ] Publikovat

### 6.2 App side
- [ ] `/register?plan=start|profi|premium` — pre-select plán v wizardu
- [ ] `/register?plan=annual` — pre-select annual billing

**Odhad:** 1 den

---

## FÁZE 7 — Member App Premium Features 🌟

**Cíl:** Vizuální odlišení Premium fitek v member appce.

- [ ] `MapView.tsx` — Featured pin pro Premium fitka (větší, jiná barva, animace)
- [ ] `GymSelector.tsx` — Premium fitka nahoře ve výsledcích (priorita)
- [ ] `GymDetailPage.tsx` — Premium badge

**Odhad:** 1-2 dny

---

## FÁZE 8 — Polish & Testování 🧪

**Cíl:** E2E ověření, že celý flow funguje.

### 8.1 Testing
- [ ] E2E test registration flow (Stripe test mode)
- [ ] Test webhook handlers (Stripe CLI `stripe listen`)
- [ ] Eurogym produkční test (grandfathered access)
- [ ] Mobile responsivita landing page (Android Motorola)
- [ ] Mobile responsivita app.pumplo.com registration

### 8.2 Go-live
- [ ] Stripe test mode → live mode
- [ ] Monitoring: failed payments, webhook errors
- [ ] Email šablony (welcome, payment failed, subscription cancelled)
- [ ] Backup strategie DB

**Odhad:** 2-3 dny

---

## Celkový timeline

| Fáze | Popis | Odhad |
|------|-------|-------|
| 0 | Oprava domény | 10 min |
| 1 | Landing polish | 1-2 h |
| 2 | DB foundation | 1-2 dny |
| 3 | Stripe integrace | 3-4 dny |
| 4 | Self-registration | 2-3 dny |
| 5 | Feature gating | 3-4 dny |
| 6 | Landing ↔ App wire-up | 1 den |
| 7 | Premium features | 1-2 dny |
| 8 | Polish & testing | 2-3 dny |

**Celkem: ~14-21 dní aktivní práce**

---

## Priority & závislosti

```
FÁZE 0 (domain fix) ──┐
                      ├─► FÁZE 1 (landing polish)
                      │
FÁZE 2 (DB) ──────────┼─► FÁZE 3 (Stripe) ──► FÁZE 4 (register) ──► FÁZE 6 (wire-up)
                      │                                             │
                      └─► FÁZE 5 (feature gating) ──────────────────┤
                                                                    │
                                                FÁZE 7 (premium) ◄──┤
                                                                    │
                                              FÁZE 8 (polish) ◄─────┘
```

**Kritická cesta:** 0 → 1 → 2 → 3 → 4 → 6 → 8

---

## Dnes (2026-04-10)

1. ✅ FÁZE 0 — Připojit pumplo.com zpět v Lovable
2. ✅ FÁZE 1 — Publikovat landing s novými sekcemi, doladit CTA
3. ✅ FÁZE 2 — DB Foundation (už existovala, doplněn `is_featured` do view)
4. ✅ FÁZE 3 — Stripe integrace dokončena:
   - Customer Portal config vytvořená (`bpc_1TKaJPEvdp2FxnFOVLCCk4SK`)
   - `create-portal-session` Edge Function napsána, deployed (v4, verify_jwt=false)
   - "Správa předplatného" button přidán do pumplo-admin Dashboard
   - Orphan/grandfathered UX ("Kontaktujte podporu" disabled state)
   - Fix bugu: `stripe-webhook` user_roles upsert (byla silent failure — chybějící UNIQUE constraint)
   - DB: `user_roles` dedupe + UNIQUE(user_id, role) constraint
   - DB: `subscription_plans.stripe_*_id` sloupce (připraveno pro future DRY refactor)
5. ✅ FÁZE 4 — Registration flow ověřen end-to-end:
   - Fresh `/register` test (6-step wizard) → Stripe Checkout → webhook → gym "xxx" vytvořený → business role → Dashboard → portal otevřen → return zpět
6. ✅ Úklid: DSN Gym orphan subscription smazána (cascade)
7. ⚠️ FÁZE 5 — po auditu: ~90% hotová, zbývá:
   - `GymConversationsPage.tsx` page-level subscription guard
   - `GymMembersDetailDrawer.tsx` verifikace workouts/week + streak gatingu
   - Link z `UpgradePrompt` na Stripe Customer Portal (místo textové hlášky "kontaktujte podporu")

### Rozhodnutí dnes
- **Žádný Stripe Connect** — standardní subscriptions (gymy platí Pumplo/GynTools CZ, není multi-party flow)
- **Webhook PRICE_TO_PLAN mapping hardcoded** zůstává — battle-tested, nerozbíjet
- **`subscription_plans.stripe_*_id` sloupce** zůstávají jako dokumentace/budoucí DRY, zatím nepoužívané

### Next candidates (po dnešku)
- Dokončit Fáze 5 drobnosti (1-2 h práce)
- Fáze 6: Lovable landing pricing → `register?plan=X` (1 h)
- Fáze 7: Featured pin Premium v member app (tento repo — MapView, GymSelector, GymDetailPage)
- Go-live: live mode Stripe + business údaje + email šablony

---

## 2026-04-11 (pokračování)

### Dokončeno dnes ráno (autonomně, nedestruktivní)
- ✅ Napsán **Stripe live migration runbook** → `.claude/plans/stripe-live-migration-runbook.md` (10 kroků + rollback plan + post-migration cleanup)
- ✅ Napsán **test mode backup** → `.claude/plans/stripe-test-mode-backup.md` (všechny test IDs + hardcoded mappings pro rollback)
- ✅ Ověřen stav Stripe účtu: `charges_enabled=True, details_submitted=True` — účet je připravený k live mode
- ✅ Ověřen DB stav: 3 gymy (xxx test, gggg test, Eurogym grandfathered)
- ✅ Telegram bot test — `@Pumplo_admin_bot` funguje, použit pro status updates během Davidova nákupu

### Telegram workflow
- Bot má nastavený webhook (daily briefing Edge Function), `getUpdates` není dostupné
- Telegram = **one-way notification channel**: Claude → David na mobil
- Schválení destruktivních akcí přijmu v Claude Code terminálu až se David vrátí

### ✅ Dokončeno odpoledne (Stripe LIVE mode)
- [x] **Claude Remote Bridge** — Telegram → tmux bidirectional (tmux session "claude-remote" + daemon)
- [x] **PermissionRequest hook** — inline button approval z Telegramu pro Bash/Edit/Read/etc
- [x] **Úklid test dat** — DSN, xxx, gggg gymy smazané + orphan auth.users (x@x.com, newgym2026@test.cz)
- [x] **Stripe Business details** vyplněné: GynTools CZ s.r.o., IČ 27804461, Videnska 6779 Olomouc, Pumplo logo + branding, +420 731 188 352
- [x] **Live Products** (3): `prod_UJbApVmo9l8cTW` / `prod_UJbAtwnu8VKkAi` / `prod_UJbAeLUTiTMxYH`
- [x] **Live Prices** (6): `price_1TKxyr...3TTdE9mS` (Start M), `price_1TKxys...CXjuXt8g` (Start Y), `price_1TKxys...4ImRp2gn` (Profi M), `price_1TKxys...WAg03uG7` (Profi Y), `price_1TKxyt...px9DiIw3` (Premium M), `price_1TKxyt...qbt8PhRo` (Premium Y)
- [x] **Live Customer Portal**: `bpc_1TKxzTEvdp2FxnFOYnEG2KEh` (is_default, cancel at_period_end, plan switching, invoice history)
- [x] **Live Webhook**: `we_1TKxzUEvdp2FxnFOEqH1HklQ` enabled, 5 events registered
- [x] **Supabase secrets** rotované na live (09:38:12 UTC)
- [x] **Code updates**: `stripe-webhook/index.ts` PRICE_TO_PLAN + `pumplo-admin/Register.tsx` STRIPE_PRICES
- [x] **DB**: `subscription_plans.stripe_*_id` updated to live IDs
- [x] **Deployed**: `stripe-webhook` v18 ACTIVE + Vercel auto-deploy pumplo-admin
- [x] **Committed**: `797cf96` (pumplo), `e33e929` (pumplo-admin)
- [x] **Smoke test** (bez reálné platby): `/register?plan=start` → Stripe Checkout URL `cs_live_...` confirmed, branding + Pumplo logo + čeština + "Zaplatit a předplatit" — vše bez oranžového test banneru

### Pumplo je READY pro první reálné zákazníky

**Dnešní stav:** Landing + signup + payment + portal + dashboard kompletně funkční v live módu. Od teď stačí pustit marketing a první majitel fitka který klikne "Vybrat Start" a zaplatí 1 990 Kč → fully automated gym creation.

**Co zbývá pro ROBUSTNÍ launch (ne blocking, ale doporučené před marketing pushem):**

#### Kritické (~2 h)
- [ ] **Supabase daily backups** — zapnout v Dashboard → Settings → Database → Backups. Bez toho jsme jeden výpadek od ztráty všech zákaznických dat.
- [ ] **Stripe Radar** — povolit fraud detection (zdarma pro CZK účty, chrání před fraudulent kartami)
- [ ] **Stripe email notifications** — povolit Customer emails pro: payment_failed, subscription_cancelled, invoice.paid (v Stripe Dashboard → Settings → Emails)

#### Důležité UX (~1-2 h)
- [ ] **Custom domain** `admin.pumplo.com` místo `pumplo-admin.vercel.app`
  - Vercel: project → Domains → Add → `admin.pumplo.com`
  - DNS: CNAME záznam → `cname.vercel-dns.com`
  - Update webhook return URLs + Lovable pricing links
- [ ] **Reálné screenshoty aplikace** do Product Showcase sekce /business (Lovable update)
- [ ] **First-real-customer dress rehearsal**: až budeš mít peníze, projdi full flow sám, refundni, ověř že faktura dorazila mailem

#### Nice-to-have (po prvním zákazníkovi)
- [ ] **Welcome email** custom (Resend/Mailgun/SendGrid) — Stripe Receipt zatím stačí
- [ ] **Monitoring/alerting** — Stripe Dashboard email alerts pro failed charges, webhook failures
- [ ] **Status page** pro zákazníky (např. status.pumplo.com přes BetterStack free tier)
- [ ] **Analytics** — Plausible / Umami pro landing page conversion tracking
- [ ] **A/B testing** na landing page (až bude dostatek traffic)

#### Blocking před marketing push — LOGO REBRAND (2026-04-11)
- [ ] **Logo rebrand na čistý "Pumplo" wordmark** — schválený směr, master SVGs v `src/assets/pumplo-wordmark*.svg`
- [ ] Kompletní checklist + rollout fáze → `.claude/plans/pumplo-logo-rebrand.md`
- [ ] **Musí být hotové před:** veškerým marketingem, tiskem samolepek, tiskem stojánků, Stripe email templates setup
- [ ] **NESMÍ se zapomenout** na žádném touchpointu — všechny repos, Stripe Dashboard, Supabase emails, Telegram bot, social media profily, fyzické materiály, iOS/Android app stores

#### Marketing launch checklist (po backup + fraud setup)
- [ ] **LinkedIn post** — "Spouštíme Pumplo..." + screenshot + /business link
- [ ] **Facebook/Instagram** — ads nebo organic do fitness skupin
- [ ] **Blog článek** — "Jak jsme snížili churn v Eurogymu o X%"
- [ ] **Email cold outreach** — seznam nezávislých fitek v ČR
- [ ] **Reddit r/gymowners** (international) nebo české FB fitness skupiny

---

### Next candidates pro zbytek dnes

1. **Supabase backups + Stripe Radar + Stripe emails** (30 min, kritické)
2. **Custom domain admin.pumplo.com** (30 min + DNS propagace)
3. **Screenshoty do Product Showcase** (ty uděláš v Lovable, já ti napíšu prompt)
