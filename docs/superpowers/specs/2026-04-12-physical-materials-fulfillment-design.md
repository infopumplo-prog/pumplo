# Physical Materials Fulfillment — Design Spec

> Status: APPROVED
> Created: 2026-04-12
> Approved by: David Novotný

## Overview

Systém pro výrobu, distribuci a verifikaci fyzických marketingových materiálů pro zákaznické posilovny. Každá posilovna po registraci a publikaci dostane welcome kit se samolepkami na stroje a stojánky na recepci.

## Rozhodnutí (schváleno 2026-04-11/12)

| Otázka | Rozhodnutí |
|--------|-----------|
| Obsah balíčku | Samolepky na stroje + 2× A5 stojánek + welcome dopis + PDF placement guide |
| Trigger | Při publikaci gymu (po dokončení profilu + zaplacení) |
| Implementační poplatek | 500 CZK jednorázově na první faktuře ("Aktivace Pumplo kitu") |
| Cena samolepek | Zdarma, součást subscription |
| Dopravce | Balíkobot (multi-carrier: Zásilkovna, PPL, ČP, DHL) — default Zásilkovna na gym adresu |
| Poštovné | Zahrnuto v implementačním poplatku 500 CZK |
| Placement rules | PDF guide s fotkami příkladů, samolepky u KAŽDÉHO cvičiště, stojánky na recepci |
| Verifikace | Foto upload (3-5 fotek) → badge "Ověřená posilovna" (opt-in, ne blocking) |
| QR na stojánku | Směřuje na `app.pumplo.com` |
| QR na samolepce | Směřuje na `/s/:short_code` (per-machine station page, existující systém) |
| New machine request | Zákazník submitne formulář → David přidá stroj + videa → samolepka se pošle (flow B) |
| Pricing dalších samolepek | Zdarma (vše v subscription, MVP) |

## 1. Implementační poplatek

### Stripe produkt
- **Name**: Aktivace Pumplo kitu
- **Price**: 500 CZK, one-time
- **Description**: Jednorázový implementační poplatek zahrnující: tisk QR samolepek na všechny stroje, 2× A5 akrylový stojánek na recepci, welcome kit s placement guide, balení a poštovné.
- **Price ID**: `price_1TLJJrEvdp2FxnFOcOEO0cAI` (LIVE)
- **Metadata**: `type=implementation_fee`

### Integrace do checkout flow
V `create-checkout` edge function přidat implementační poplatek jako `line_item` vedle subscription:

```typescript
line_items: [
  // Subscription (existing)
  { price: subscriptionPriceId, quantity: 1 },
  // Implementation fee (new, one-time)
  { price: IMPLEMENTATION_FEE_PRICE_ID, quantity: 1 },
]
```

Mode zůstává `subscription` — Stripe podporuje one-time items v subscription checkout.

## 2. Fulfillment Flow

### 2.1 Trigger: Publish gymu

Když zákazník klikne "Publikovat" v admin dashboardu (po dokončení profilu):

1. Gym se nastaví `is_published = true`
2. Vytvoří se `fulfillment_orders` záznam:
   - `gym_id`, `status: 'pending'`, `type: 'welcome_kit'`
   - `shipping_address`: gym address (default)
   - `sticker_count`: SUM of all `gym_machines.quantity`
   - `stand_count`: 2
3. Telegram notifikace → David: "Nová objednávka: {gym_name}, {sticker_count} samolepek, {stand_count} stojánků"

### 2.2 David zpracuje objednávku (ruční MVP flow)

**Trigger:** Telegram notifikace přijde → David otevře admin dashboard `/fulfillment`

**Krok za krokem:**

1. **Otevři fulfillment dashboard** — vidíš novou objednávku se statusem "Čeká na zpracování"
2. **Vytiskni samolepky**:
   - Jdi na `/qr-codes` pro danou posilovnu (nebo GymQRCodes page)
   - Stáhni PDF se všemi QR kódy
   - Tisk na samolepkový papír 5×5 cm (tiskárna: vlastní nebo copycentrum)
3. **Připrav stojánky**:
   - Vytiskni A5 kartu (design z mockupů) na 300g křídový papír, mat laminace
   - Vlož do akrylového L-stojanu (zakoupené předem, ~80 Kč/ks z Aliexpress/Alza)
4. **Vytiskni welcome dopis** — A4, jednostranný (šablona v `docs/email-templates/`)
5. **Vytiskni placement guide** — A4, oboustranný (šablona bude v `docs/`)
6. **Zabal**:
   - Bublinkový obálka nebo malá krabička
   - Pořadí: welcome dopis navrch → placement guide → samolepky v sáčku → stojánky
7. **Podej zásilku** — ruční podání přes web dopravce:
   - **Zásilkovna** (doporučeno): zasilkovna.cz → "Odeslat zásilku" → adresa z dashboardu → ~89-129 Kč
   - **Česká pošta**: posta.cz → Balík Do ruky → ~130 Kč
   - **PPL**: ppl.cz → Online podání → ~149 Kč
8. **Zadej tracking do dashboardu** — klikni "Označit jako odesláno" → vlož tracking number
9. **Zákazník vidí tracking** v svém dashboard setup progress kartu

**Časový odhad:**
- Příprava balíčku: 20-30 min (tisk + balení)
- Podání zásilky: 10 min (online) + cesta na poštu/výdejní místo
- Doručení: **2-3 pracovní dny** (Zásilkovna/PPL), 3-5 dnů (ČP)
- Celkem od objednávky po doručení: **3-5 pracovních dnů**

**Náklady per balíček (hrazeno z 500 Kč implementačního poplatku):**
- Samolepky (30 ks průměr × 8 Kč): ~240 Kč
- 2× A5 stojánek (tisk + stojan): ~200 Kč
- Poštovné: ~100-150 Kč
- Obálka/krabička: ~20 Kč
- **Celkem: ~560-610 Kč** (mírná ztráta u menších gymů, ale customer acquisition cost)

### 2.3 Shipping — ruční MVP (bez Balíkobotu)

Balíkobot (600 Kč/měs) se vyplatí až od 10+ zásilek/měsíc. Pro launch používáme ruční podání:

- **Primární dopravce**: Zásilkovna na adresu (129 Kč, 2-3 dny)
- **Alternativa**: ČP Balík Do ruky (130 Kč, 3-5 dnů)
- **Tracking**: manuálně zadáno do admin dashboardu po podání
- **Migrace na Balíkobot**: až překročíme 10 zásilek/měsíc (cca 10 nových zákazníků)

### 2.4 Post-delivery verification

Po doručení (Balíkobot tracking → status `delivered`):

1. **Automatický email** (den po doručení): "Vaše samolepky dorazily! Nalepte je podle přiloženého guide."
2. **+3 dny reminder** (pokud nepotvrzeno): "Už jste nalepili samolepky? Vaši členové čekají na QR kódy!"
3. **+7 dní reminder**: "Poslední připomínka — nalepte samolepky a získejte badge Ověřená posilovna."
4. Dashboard karta: "Nalepili jste samolepky?" s tlačítkem "Potvrdit a nahrát fotky"

### 2.5 Badge "Ověřená posilovna"

- Zákazník nahraje 3-5 fotek (stroje se samolepkami + recepce se stojánkem)
- Auto-approve (žádné manuální schvalování)
- Gym dostane badge viditelný v member appce:
  - Na mapě: speciální ikona/štítek
  - Na gym detail page: "✓ Ověřená posilovna"
- Fotky uložené v Supabase Storage (`gym-assets/{gym_id}/verification/`)

## 3. Datový model

### Nová tabulka: `fulfillment_orders`

```sql
CREATE TABLE fulfillment_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL DEFAULT 'welcome_kit',
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  -- pending → processing → shipped → delivered → verified

  shipping_address JSONB NOT NULL,
  -- { street, city, zip, country, contact_name, contact_phone }

  sticker_count INTEGER NOT NULL,
  stand_count INTEGER NOT NULL DEFAULT 2,

  carrier VARCHAR(50), -- zasilkovna, ppl, cp, dhl
  tracking_number VARCHAR(100),
  tracking_url TEXT,

  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,

  verification_photos TEXT[], -- array of storage paths

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
CREATE POLICY "Gym owners can view own orders"
  ON fulfillment_orders FOR SELECT
  USING (gym_id IN (SELECT id FROM gyms WHERE owner_id = auth.uid()));

CREATE POLICY "Admins can manage all orders"
  ON fulfillment_orders FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));
```

### Nová tabulka: `machine_requests`

```sql
CREATE TABLE machine_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES auth.users(id),

  machine_name VARCHAR(255) NOT NULL,
  category VARCHAR(100), -- stroj, free_weight, cardio, accessories
  description TEXT,
  photo_url TEXT, -- fotka stroje od zákazníka

  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  -- pending → in_progress → completed → sticker_sent

  resolved_machine_id UUID REFERENCES machines(id), -- po schválení
  admin_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Rozšíření `gyms` tabulky

```sql
ALTER TABLE gyms ADD COLUMN is_verified BOOLEAN DEFAULT false;
ALTER TABLE gyms ADD COLUMN verified_at TIMESTAMPTZ;
```

## 4. Welcome dopis

### Text

```
Ahoj,

děkuji, že jste si vybrali Pumplo pro svou posilovnu.

V tomto balíčku najdete:
  • QR samolepky na vaše stroje ({sticker_count} ks)
  • 2× stojánek na recepci s QR kódem pro stažení appky
  • Placement guide s příklady správného umístění

3 kroky k aktivaci:

  1. NALEPTE samolepky na každý stroj podle přiloženého guide
  2. POSTAVTE stojánky na recepci — viditelně pro členy
  3. POTVRĎTE v dashboardu a nahrajte fotky → získáte badge
     "Ověřená posilovna" viditelný pro vaše členy v aplikaci

Pokud budete potřebovat cokoliv — nový stroj do databáze,
další samolepky, nebo poradit — napište mi.

S pozdravem,

[podpis D. Novotný]
David Novotný
Zakladatel Pumplo
david@pumplo.com | +420 731 188 352
```

### Formát
- A4, jednostranný tisk
- Pumplo wordmark logo nahoře (cyan na bílém)
- Text v Nunito Regular, 12pt
- Podpis: `src/assets/generated/signature-david.png` (kurzivní "D. Novotný")
- Bottom: kontaktní údaje

## 5. Placement Guide (PDF)

### Obsah (A4, oboustranný)

**Strana 1 — Samolepky na stroje:**
- Headline: "Kam nalepit QR samolepky"
- 3-4 fotky příkladů z Eurogymu (bench press, leg press, cable machine, cardio)
- Pravidla:
  - Nalep na viditelné místo na rámu stroje
  - Ideálně v úrovni očí při cvičení (sezení/stání)
  - Na čistý, suchý povrch (ne na čalounění/potah)
  - Každý stroj co jste zadali v aplikaci musí mít svou samolepku
  - Více kusů stejného stroje = stejná samolepka na každém

**Strana 2 — Stojánky na recepci:**
- Headline: "Kam postavit stojánky"
- Fotka příkladu na recepčním pultu
- Pravidla:
  - Na recepci nebo vstupní pult — viditelné při příchodu členů
  - Pokud máte více recepcí/vstupů → jeden stojánek na každý
  - QR kód směřuje na stažení Pumplo appky

## 6. A5 Stojánek — finální design

- **Formát**: A5 portrét (148×210 mm), mat laminace, 300g křída
- **Stojan**: akrylový L-stojan
- **Layout** (shora dolů):
  1. Pumplo wordmark (cyan) — nahoře centrovaný
  2. Eyebrow: "— PRO ČLENY TOHOTO FITKA —"
  3. Hero headline: "Nevíš, jak správně cvičit?"
  4. Subhead: "Osobní tréninkový plán na každý stroj. Zdarma."
  5. QR kód s glow rámem → `app.pumplo.com`
  6. CTA: "NAMIŘ NA MĚ MOBIL"
  7. Trust strip: 📱 Naskenuj · ⚡ Plán za 2 min · 💪 Trénuj chytře
- **Pozadí**: navy gradient (#071024 → #0B1628)
- **Design assety**: mockup v `.superpowers/brainstorm/` session

## 7. Samolepky — specifikace

- **Velikost**: 5×5 cm
- **Materiál**: laminovaný vinyl (odolný potu, čistění)
- **Design**: existující QR systém (`qrGenerator.ts` + `QRCodeCard.tsx`)
  - Dark bg (#0B1222), white QR, Pumplo wordmark pod QR
  - Center badge: "Pumplo" horizontal pill (místo starého hex loga)
  - Error correction: H (30%) pro logo overlay
- **Počet**: dle `SUM(gym_machines.quantity)` pro danou posilovnu
- **Jeden QR = jeden typ stroje** (víc kusů stejného stroje = více samolepek se stejným QR)

## 8. Admin Dashboard — nové sekce

### 8.1 Fulfillment management (super_admin)
- Seznam všech fulfillment_orders se statusem
- Filtr: pending / shipped / delivered / verified
- Detail: gym info, sticker count, shipping address, tracking
- Akce: "Označit jako odesláno" (zadá tracking #), "Označit jako doručeno"

### 8.2 Machine requests (super_admin)
- Seznam machine_requests se statusem
- Detail: fotka stroje, název, kategorie
- Akce: "Schválit a přidat do DB", "Odmítnout", "Duplikát existujícího"

### 8.3 Setup progress (gym_admin dashboard)
- Progress bar: Profil ✓ → Publikováno ✓ → Samolepky objednány ✓ → Odesláno ✓ → Doručeno ✓ → Nalepeno ✓
- Tracking odkaz (po odeslání)
- "Potvrdit nalepení" tlačítko s photo upload
- Badge status: "Ověřená posilovna" po verifikaci

### 8.4 Request new machine (gym_admin)
- Formulář: název + kategorie + foto + popis
- Status tracker: pending → in_progress → completed → sticker_sent

## 9. Implementační pořadí

1. **DB migrace** — `fulfillment_orders`, `machine_requests`, `gyms.is_verified`
2. **Stripe produkt** — "Aktivace Pumplo kitu" 500 CZK + integrace do checkout
3. **Publish trigger** — auto-create fulfillment_order při publish
4. **Admin fulfillment view** — seznam objednávek + akce
5. **Gym setup progress** — dashboard karta s progress barem
6. **Balíkobot integrace** — API pro label generation + tracking
7. **Remindery** — email/push notifikace po doručení
8. **Photo verification** — upload + badge "Ověřená posilovna"
9. **Machine request flow** — formulář + admin schvalování
10. **PDF guide generation** — placement guide + welcome letter PDF

## 10. Mimo scope MVP

- Automatický reorder samolepek (bulk replenishment)
- Self-service sticker ordering (zákazník si sám objedná extra)
- QR analytika (počty skenů per samolepka)
- Mapa posilovny s pozicemi strojů
- Video placement guide (místo PDF)
- A/B testing různých A5 stojánek designů
