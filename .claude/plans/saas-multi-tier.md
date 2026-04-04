# Pumplo SaaS Multi-Tier Subscription Plan

> Status: PLÁNOVÁNO
> Poslední update: 2026-04-04
> Autor: David Novotný + Claude

## Přehled

Přechod z jedné flat ceny (5 000 CZK) na tři subscription tiers s platební bránou (Stripe), self-registrací posiloven a feature gatingem.

---

## Tři úrovně předplatného

### Cenová tabulka

| | **Start** | **Profi** | **Premium** |
|---|---|---|---|
| **Cena/měsíc** | 1 990 CZK | 3 990 CZK | 6 990 CZK |
| **Cena/rok** | 19 900 CZK (-17%) | 39 900 CZK (-17%) | 69 900 CZK (-17%) |

### Feature Matrix

| Feature | **Start** | **Profi** | **Premium** |
|---|---|---|---|
| Gym Profile (název, adresa, popis, logo, cover) | Plný | Plný | Plný |
| Otevírací doba | Plná | Plná | Plná |
| Ceník (jednorázové + permanentky) | Plný | Plný | Plný |
| Publikace na mapě | Ano | Ano | Ano |
| **Stroje** | max 25 | max 60 | Neomezeno |
| **Fotky galerie** | max 3 | max 10 | Neomezeno |
| **Trenéři** | 1 | 5 | Neomezeno |
| **Hromadné zprávy** | 2/měsíc | 10/měsíc | Neomezeno |
| **Přímé konverzace** | Ne | 5 aktivních | Neomezeno |
| **Instagram na profilu** | Ne | Ano | Ano |
| **Analytika členů** | Jen počet | Plná (grafy, cíle, úrovně) | Plná + CSV export |
| **Detail členů** | Jen jméno + status | Vše (workouts/week, regularita, streak) | Vše |
| **Zvýraznění na mapě** | Standardní pin | Standardní pin | Featured pin + priorita v hledání |

### Klíčová rozhodnutí

- **Bez free trialu** — posilovna se na mapě objeví až po zaplacení
- **Platební brána (Stripe) od začátku** — škálovatelnost, automatické fakturace, subscription management
- **Eurogym Olomouc = grandfathered Premium** se smluvní cenou, bez Stripe
- **Trenéři 1/5/neomezeno** — připravuje půdu pro budoucí trenérské předplatné

---

## Self-registrace posiloven

### Flow (3 kroky)

**Krok 1 — Základní info**
- Název posilovny
- Adresa (s mapou pro pin)
- Kontaktní email + telefon
- Výběr strojů z knihovny (klikací výběr)

**Krok 2 — Výběr tieru + platba**
- 3 karty s porovnáním plánů
- Klik → Stripe Checkout → platba

**Krok 3 — Dashboard**
- Gym se vytvoří automaticky po zaplacení
- Owner si postupně doplní: logo, fotky, otevírací dobu, popis, IG, trenéry, ceník
- Posilovna se na mapě neobjeví dokud owner neklikne "Publikovat"

---

## Databázové změny

### Nové tabulky

#### `subscription_plans` (konfigurace tierů)
```sql
CREATE TABLE public.subscription_plans (
  id TEXT PRIMARY KEY,                    -- 'start', 'profi', 'premium'
  name TEXT NOT NULL,
  price_monthly INTEGER NOT NULL,         -- CZK
  price_annual INTEGER NOT NULL,
  limits JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

Limits JSONB příklad:
```json
{
  "max_machines": 25,
  "max_photos": 3,
  "max_trainers": 1,
  "max_broadcast_messages_monthly": 2,
  "max_active_conversations": 0,
  "analytics_level": "basic",
  "member_detail_level": "basic",
  "featured_listing": false,
  "instagram_display": false,
  "csv_export": false,
  "priority_search": false
}
```

#### `gym_subscriptions`
```sql
CREATE TABLE public.gym_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES public.subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'past_due', 'cancelled', 'expired')),
  billing_period TEXT NOT NULL DEFAULT 'monthly'
    CHECK (billing_period IN ('monthly', 'annual')),
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ NOT NULL,
  cancelled_at TIMESTAMPTZ,
  is_grandfathered BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(gym_id)
);
```

#### `subscription_events` (audit log)
```sql
CREATE TABLE public.subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('activated', 'upgraded', 'downgraded', 'renewed', 'cancelled', 'expired', 'payment_failed')),
  from_plan_id TEXT REFERENCES public.subscription_plans(id),
  to_plan_id TEXT REFERENCES public.subscription_plans(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Modifikace existujících

#### `public_gyms` view — přidat `is_featured`
```sql
CREATE OR REPLACE VIEW public.public_gyms AS
SELECT
  g.id, g.name, g.description, g.latitude, g.longitude,
  g.address, g.is_published, g.opening_hours, g.cover_photo_url,
  g.logo_url, g.pricing, g.instagram_handle, g.created_at, g.updated_at,
  CASE WHEN gs.plan_id = 'premium' AND gs.status = 'active'
       THEN true ELSE false END AS is_featured
FROM public.gyms g
LEFT JOIN public.gym_subscriptions gs ON gs.gym_id = g.id
WHERE g.is_published = true
  AND (gs.status = 'active' OR gs.is_grandfathered = true OR gs.id IS NULL);
```

---

## Feature Gating — Enforcement

### Server-side (RLS + funkce)
Limity na stroje, fotky, trenéry, zprávy enforced v DB pomocí check funkcí:
```sql
CREATE OR REPLACE FUNCTION public.check_gym_limit(p_gym_id UUID, p_limit_key TEXT, p_current_count INTEGER)
RETURNS BOOLEAN AS $$
DECLARE max_allowed INTEGER;
BEGIN
  SELECT (sp.limits->>p_limit_key)::INTEGER INTO max_allowed
  FROM public.gym_subscriptions gs
  JOIN public.subscription_plans sp ON sp.id = gs.plan_id
  WHERE gs.gym_id = p_gym_id AND gs.status = 'active';
  IF max_allowed IS NULL THEN RETURN true; END IF;
  RETURN p_current_count < max_allowed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Client-side (React hook)
`useSubscription` hook pro business dashboard:
- Vrací aktuální plán, status, limity
- `canUseFeature(feature)` helper
- Zobrazuje upgrade prompty u zamčených features

### Enforcement body v admin appce:
- `GymProfilePage.tsx` — limity fotek, trenérů, IG field
- `GymMembersPage.tsx` — viditelnost sloupců podle tieru
- `Dashboard.tsx` — viditelnost analytiky
- `GymMessagesPage.tsx` — měsíční limit zpráv
- `GymConversationsPage.tsx` — skrytá pro Start
- `Sidebar.tsx` — podmíněné menu položky

---

## Stripe integrace

### Komponenty
1. **Stripe Checkout** — při registraci, výběr plánu → platba
2. **Stripe Webhooks** — Supabase Edge Function zpracovává:
   - `checkout.session.completed` → vytvoří gym + subscription
   - `invoice.paid` → obnoví subscription period
   - `invoice.payment_failed` → status = past_due
   - `customer.subscription.deleted` → status = cancelled
3. **Stripe Customer Portal** — self-service pro změnu plánu / platební údajů
4. **Stripe Products** — 3 products × 2 prices (monthly + annual)

---

## Implementační fáze

| Fáze | Co | Odhad |
|------|-----|-------|
| 1. DB základ | Tabulky, RLS, limity, Eurogym migrace | 1-2 dny |
| 2. Stripe integrace | Checkout, webhooky, Edge Functions | 3-4 dny |
| 3. Admin subscription management | Dashboard MRR, subscription tab | 2-3 dny |
| 4. Self-registrace + platba | Register flow, Stripe Checkout, auto-provisioning | 2-3 dny |
| 5. Feature gating (business) | Limity na stroje/fotky/trenéry/zprávy/analytiku | 3-4 dny |
| 6. Member app | Featured pin, Premium sorting | 1-2 dny |
| 7. Polish & testování | E2E, Eurogym, mobile, Stripe test mode | 2-3 dny |

**Celkem: ~14-21 dní**
