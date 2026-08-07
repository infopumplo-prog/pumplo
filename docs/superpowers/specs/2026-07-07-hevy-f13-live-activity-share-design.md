# F13 — Rest widget (Live Activity) + nové share karty (Hevy fáze 4)

**Datum:** 7. 7. 2026 · **Verze:** 1.3.0 (Eurogym build) · **Větev:** `feat/push-notifications`
**Schválil:** David (chat 7. 7.)

## Cíl

Doplnit dva Hevy zážitky, které v Pumplu chybí:

1. **Widget na zamčené obrazovce** během restu — odpočet, aktuální cvik, další série (zobrazovací, bez tlačítek; tlačítka -15s/+15s/Skip až ve v2).
2. **Dvě nové share karty** po dokončení tréninku — svalové rozložení na postavičce a fun fact přirovnání objemu.

## A) Widget — vlastní Capacitor plugin `RestActivity`

Žádná npm závislost. Jeden lokální plugin se dvěma nativními implementacemi.

### JS API

```ts
RestActivity.start({ exerciseName, nextSetText, endsAt, totalSeconds })
RestActivity.update({ nextSetText, endsAt, totalSeconds })  // ±15 s mění endsAt
RestActivity.end()
```

- Nový wrapper `src/lib/restLiveActivity.ts` — volaný ze stejných míst jako `restNotification.ts`:
  start restu, úprava ±15 s, Skip, dokončení restu, ukončení/pauznutí tréninku.
- `nextSetText` se skládá v JS (lokalizovaně): „Další: série 2 z 5 (22 kg × 55)".
- Na webu a nepodporovaných platformách všechny metody tiše no-op.

### iOS (Live Activity, iOS 16.2+)

- Nová widget extension **`PumploWidgets`** (nový Xcode target, SwiftUI + ActivityKit).
- `RestActivityAttributes`: statické `exerciseName`; `ContentState`: `endsAt`, `startedAt`, `nextSetText`.
- UI zamčené obrazovky (Hevy vzor): logo + „Trénink" | čas, název cviku, `nextSetText`,
  modrý progress bar (`ProgressView(timerInterval:)`) a odpočet (`Text(timerInterval:)`) —
  odpočítává systém, plugin neposílá updaty každou vteřinu.
- Dynamic Island: compact = odpočet, expanded = totéž co lock screen.
- `staleDate = endsAt + 3 min` — když appka umře, systém aktivitu sám ukončí.
- Guard `#available(iOS 16.2, *)` + `ActivityAuthorizationInfo().areActivitiesEnabled` — tiché selhání.
- Plugin `RestActivityPlugin.swift` v app targetu (start/update/end přes `Activity<RestActivityAttributes>`).

### Android (ongoing notifikace)

- `RestActivityPlugin.kt` (registrace v `MainActivity`).
- `NotificationCompat` s `setOngoing(true)`, `setUsesChronometer(true)`, `setChronometerCountDown(true)`,
  `when = endsAt` — odpočet kreslí systém. Obsah: název cviku + `nextSetText`.
- Vlastní tichý kanál `pumplo_rest_live` (LOW importance, bez zvuku/vibrace) — zvukový alert
  na konci restu zůstává stávající notifikaci z `restNotification.ts` (kanál `pumplo_rest`).
- `update()` = re-notify se stejným ID; `end()` = cancel.

### Hranice jednotek

- `restLiveActivity.ts`: jediné místo, které ví o pluginu; player kód volá jen tento modul.
- Plugin: bezstavové API start/update/end; veškerá logika časování zůstává v JS (existující rest timer).

## B) Share karty — rozšíření `WorkoutShareCard`

### 1. Svalová karta (`T_MuscleMap`)

- Nová komponenta **`src/components/workout/MuscleBodySvg.tsx`** — vlastní SVG postavička
  zepředu + zezadu, ~14 regionů: hrudník, ramena, biceps, triceps, předloktí, břicho,
  šikmé břišní, kvadricepsy, hamstringy, hýždě, lýtka, záda-lats, záda-trapézy, bedra.
- Props: `Record<groupKey, intensity 0–1>`; vybarvení Pumplo cyan `#4CC9FF` s opacitou podle intenzity.
- Data: existující výpočet `muscleDist` z P3 (`groupForMuscle`, primary = 1, secondary = 0,5 na sérii)
  — výpočet se přesune/zduplikuje do sdílené utility, aby ho měl i share flow (`src/lib/muscleDistribution.ts`).
- Karta: název tréninku + počty sérií na cvik vlevo, postavička(y) vpravo, Pumplo branding dole.
- Komponenta je záměrně samostatná — později použitelná v detailu cviku a statistikách.

### 2. Fun fact karta (`T_FunFact`)

- „Zvedl jsi celkem X kg — to je jako Y!" + velké emoji.
- Škála (vybere se nejvyšší dosažený práh): 50 kg pes 🐕 → 200 kg motorka 🏍️ → 700 kg kůň 🐎 →
  1 500 kg auto 🚗 → 3 000 kg nosorožec 🦏 → 6 000 kg slon 🐘 → 12 000 kg autobus 🚌 → 30 000 kg velryba 🐋.
  Pod 50 kg: karta se v karuselu nezobrazí.
- Překlady CZ/EN v `src/i18n/locales/`.

### Zapojení

- Obě šablony se přidají do pole šablon ve `WorkoutShareCard.tsx` (karusel, tečky, swipe už fungují).
- Sdílení beze změny: html2canvas → `@capacitor/share` / IG Stories / foto pozadí.

## C) Mimo rozsah (explicitně)

- Tlačítka -15s/+15s/Skip na widgetu (App Intents, iOS 17) — v2.
- Workout Link (veřejná stránka tréninku), Copy Text, X/Twitter tlačítko — neschváleno, neřeší se.
- Živý widget pro klasický (ne-custom-plan) player se řeší jen tam, kde běží stávající rest timer
  (`CustomWorkoutPlayer` + `WorkoutSession` sdílejí `restNotification.ts` — napojíme obě místa).

## D) Testování a rizika

- **iOS:** build v Xcode, test na Davidově iPhonu — start restu → widget na zamčené obrazovce,
  ±15 s a Skip → widget se aktualizuje/zmizí, konec tréninku → zmizí. Dynamic Island vizuálně.
- **Android:** emulátor/telefon — ongoing notifikace s odpočtem, tichost, zmizení.
- **Share karty:** web preview (vite dev) + telefon (html2canvas render, IG Stories).
- **Riziko č. 1:** provisioning/signing nového widget extension targetu — otestovat build hned
  po vytvoření targetu, před psaním UI.
- **Riziko č. 2:** html2canvas vs. SVG (vykreslení SVG do canvasu) — ověřit hned první render;
  kdyby zlobil, fallback je inline PNG render postavičky.
