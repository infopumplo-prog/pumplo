# QR Station System — Design Spec

## Overview

QR kody na cvicistich v posilovne. Uzivatel naskenuje QR kod na stroji, otevre se verejna stranka s videi cviku pro dany stroj a CTA pro stazeni appky.

## Decisions

- **Approach**: Hybridni (C) — verejna lazy-loaded route v existujici React appce
- **Cislovani**: Bez cisel v MVP. QR kod je vazany na `gym_machine` zaznam (typ stroje v posilce). Cisla pridame v dalsi verzi.
- **URL format**: Kratke kody — `pumplo.app/s/{short_code}` (8 znaku)
- **Samolepky**: Jeden QR = jeden typ stroje. Vice kusu stejneho stroje = vice samolepek se stejnym QR.
- **App Store link**: Banner vede na App Store / Google Play (Capacitor native app). Pred launchem do storu → `/auth` registrace.

## 1. Datovy model

### Zmena v `gym_machines`

```sql
ALTER TABLE gym_machines
ADD COLUMN short_code VARCHAR(8) UNIQUE;

-- Trigger: automaticky generuje short_code pri INSERT
CREATE OR REPLACE FUNCTION generate_short_code()
RETURNS TRIGGER AS $$
DECLARE
  chars TEXT := 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code TEXT := '';
  i INTEGER;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..8 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM gym_machines WHERE short_code = code);
  END LOOP;
  NEW.short_code := code;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_gym_machine_short_code
BEFORE INSERT ON gym_machines
FOR EACH ROW
WHEN (NEW.short_code IS NULL)
EXECUTE FUNCTION generate_short_code();
```

Zadne dalsi tabulky. Existujici relace: `gym_machines` → `machines` → `exercises`.

### Backfill existujicich zaznamu

```sql
UPDATE gym_machines SET short_code = generate_short_code_value()
WHERE short_code IS NULL;
```

## 2. Verejna stranka `/s/:code`

### Route setup

Lazy-loaded public route (bez auth):

```
/s/:code → <StationPage /> (lazy)
```

Code splitting zajisti ze se nenacte cely app bundle.

### Layout

```
┌─────────────────────────────┐
│ [Pumplo logo]  [Otevrit v aplikaci] │  ← fixni horni banner
├─────────────────────────────┤
│                             │
│    ┌───────────────────┐    │
│    │                   │    │
│    │   VIDEO CVIKU     │    │  ← fullscreen loopovane video
│    │   (autoplay)      │    │
│    │                   │    │
│    └───────────────────┘    │
│                             │
│    ← Bench press →          │  ← nazev cviku + swipe sipky
│    [i] info button          │  ← detail: popis, svaly, obtiznost
│                             │
│    ● ○ ○ ○ ○               │  ← dots indikator (pocet cviku)
│                             │
├─────────────────────────────┤
│  Vytvor si treninkovy plan  │  ← fixni spodni CTA
│  [Stahni Pumplo]            │  → App Store / Google Play
└─────────────────────────────┘
```

### Data flow

1. GET `/s/:code`
2. Query: `gym_machines` WHERE `short_code = :code` → `machine_id`, `gym_id`
3. Query: `exercises` WHERE `machine_id = :machine_id`
4. Query: `gyms` WHERE `id = :gym_id` → gym name (pro meta tagy)
5. Render video player s cviky

### RLS

Nova policy na `gym_machines` pro verejny pristup pres short_code:

```sql
CREATE POLICY "Public access via short_code"
ON gym_machines FOR SELECT
USING (short_code IS NOT NULL);
```

Exercises a machines uz maji verejne SELECT policies.

### Komponenty (znovupouziti z workout view)

- Video player — sdileny s `ExercisePlayer` (video loop, signed URL)
- Info overlay — popis cviku, svaly, obtiznost
- Swipe navigace — levy/pravy pro prepinani cviku

### Nove komponenty

- `StationPage` — hlavni stranka
- `StationBanner` — horni "Otevrit v aplikaci" banner
- `StationCTA` — spodni call-to-action

## 3. QR generovani a export

### Frontend knihovna

`qr-code-styling` — podporuje logo uprostred, custom barvy, SVG export.

### QR design

- Dark theme (#0B1222 pozadi)
- Bily QR kod na glass-effect kontejneru
- Pumplo logo uprostred s cyan (#4CC9FF) glow
- "PUMPLO" 110px bold, wide spacing
- Subtitle "Naskenuj a cvic spravne"
- Error correction: H (30%) — nutne pro logo

### Admin dashboard — QR sekce

Nova stranka v business dashboardu: `/business/qr-codes`

- Seznam vsech stroju posilovny s QR nahledem
- Pocet samolepek u kazdeho (default = quantity z gym_machines)
- Tlacitko "Stahnout PDF" — generuje tiskovou predlohu:
  - A4 format, 5x5 cm samolepky v mrizce (3x4 na stranku)
  - Vysoke rozliseni (SVG/300 DPI)
  - Kazdy QR: logo + "PUMPLO" text

### Fyzicke samolepky

- Velikost: 5x5 cm
- Material: laminovany vinyl (odolny potu, cisteni)
- Jeden QR = jeden typ stroje (vice kusu = vice samolepek se stejnym QR)
- Tiskarna: poptavka v Brne/Olomouci
- Orientacni cena: 8-15 CZK/ks pri 100 ks

## 4. App Store banner (smart banner)

### Logika

```
if (userAgent.iOS) → link na App Store
if (userAgent.Android) → link na Google Play
else → link na /auth registraci
```

### Pred launchem do storu

Banner text: "Registruj se v Pumplo" → `/auth`

### Po launchi

Banner text: "Otevrit v aplikaci" → Universal Link / App Link
- iOS: Apple Smart App Banner meta tag
- Android: intent:// scheme

## 5. SEO a meta tagy

Kazda station stranka ma dynamicke meta tagy:

```html
<title>{machine_name} — cviky | {gym_name} | Pumplo</title>
<meta name="description" content="Podivej se jak spravne cvicit na {machine_name} v {gym_name}" />
<meta property="og:image" content="{first_exercise_thumbnail}" />
```

## 6. Implementacni poradi

1. **DB migrace** — `short_code` pole + trigger + backfill
2. **Public route** — `/s/:code` s lazy loading, data fetching
3. **Video player** — znovupouziti ExercisePlayer pro verejnou stranku
4. **Banner + CTA** — horni app banner, spodni registracni CTA
5. **QR generovani** — admin stranka s QR nahledem a PDF exportem
6. **Samolepky** — poptavka tiskarny, priprava podkladu

## 7. Mimo scope MVP

- Cislovani stroju (station_number)
- QR skenovani primo v appce
- Offline podpora
- Analytika skenovani (pocty, cas, konverze)
- Mapa posilovny s pozicemi stroju
