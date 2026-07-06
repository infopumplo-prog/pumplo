# Pumplo — Feedback handoff (stav k 2. 7. 2026)

Pokračovací poznámka po restartu počítače. Vše níže je na větvi **`feat/push-notifications`** (to je aktivní vývojová větev, ne `main`).

---

## ✅ HOTOVO a commitnuté (pushnuté)

1. **Popis cviku v náhledu tréninku** (`a13b38a`)
   - `WorkoutPreview` Drawer teď ukazuje Popis & technika / Nastavení / Časté chyby / Tipy (dřív jen svaly). Data v DB kompletní (všech 201 cviků má description).

2. **Bump verze na 1.2.1** (`e2b3b7b`)
   - Android versionCode 5 / versionName 1.2.1, iOS build 6 / MARKETING_VERSION 1.2.1.

3. **3 úpravy workout playeru** (`df8bf70`) — spec: `docs/superpowers/specs/2026-06-30-workout-player-polish-design.md`
   - **Další cvik u poslední série:** na poslední sérii se vlevo dole zobrazí „Další:" + název + mini smyčka videa dalšího cviku (`ExercisePlayer.tsx`, `WorkoutSession.tsx`).
   - **Zvuk/vibrace pauzy při zamčené obrazovce:** Android dedikovaný kanál `pumplo_rest` (HIGH + vibrace + rest_beep.wav), iOS `interruptionLevel: 'timeSensitive'` + entitlement `com.apple.developer.usernotifications.time-sensitive` (`restNotification.ts`, `App.entitlements`). Na tichu aspoň zavibruje, Focus/DND prorazí. (Critical Alert = zvuk i přes ticho = mimo rozsah, vyžaduje schválení Apple.)
   - **Zámek na portrait:** iOS Info.plist jen Portrait (vč. iPadu), Android manifest `android:screenOrientation="portrait"`.
   - Stav: `npm run build` + `npx cap sync ios android` provedeno. TypeScript čistý.

### ⏸️ Čeká na tebe (ověření na telefonu)
Dev build z Xcode / Android Studio → zkontrolovat:
- poslední série: sedí velikost/pozice náhledu dalšího cviku?
- pauza + zamčená obrazovka na tichu → zavibruje? se zvonkem → pípne?
- otáčení → drží na výšku všude?

### 📲 Store update (až po ověření)
Verze 1.2.1 je připravená. Postup (nativně přes Xcode + Android Studio → App Store Connect / Play Console):
- iOS: `open ios/App/App.xcworkspace` → Any iOS Device → Product ▸ Archive → Distribute ▸ App Store Connect.
- Android: `open -a "Android Studio" android` → Build ▸ Generate Signed Bundle (.aab) → **STEJNÝ keystore jako minule** → Play Console Production.

---

## ✅ ODBLOKOVÁNO — Simonina NOVÁ videa dorazila (krok 1 plánu)

- **Nová zásilka od Simony: Úschovna `WAZHD5VV2JXIY63M` (30. 6., 6,2 GB) → `~/Downloads/zasilka-WAZHD5VV2JXIY63M/`** — 44 klipů .mov, natočeno **24.–25. 5. 2026** (ověřeno ffprobe `creation_time`), tj. skutečně nové záběry.
- Klipy mají kamerové kódy `A001_05242058_C003.mov` … `A001_05251244_C053.mov` (řada C003–C053 s dírami — některé záběry vyřazeny). **Potřeba mapování klip → cvik** (vytáhnout náhledové framy).
- Stará únorová zásilka `VPDRTE33MK6VCBUP` je bezpředmětná.

## 🎬 HOTOVO 2.–3. 7. — Davidova nová videa cviků (28 ks)

- 28 cviků přenahráno novými videi (`0702(N).mov`, N=0–29; (7) nepřiřazeno — spare, (21) přeskočeno, (30) leží v `~/Desktop/videa pro bendu na nahratí cviků/`).
- Pipeline na video: ffmpeg komprese (720×1280, crf 28, faststart, ~0,3–0,9 MB) → kontrola smyčky přes první/poslední frame (příp. trim) → upload `exercise-videos/<uuid>/<název>_20260702.mp4` → PATCH `video_path` → vizuální kontrola v admin.pumplo.com. **Vždy ověřit UUID cviku proti ID ze screenshotu (jména nejsou unikátní!).** Stará videa zachována ve Storage pro revert.
- Drobnost: cvik „Rotace trupu" (1041cbb8…) má v DB popis o kabelové kladce, ale je to selektorizovaný rotační stroj — text opravit.

## ⏳ Bendovy landminy

- Zásilka z Úschovny se na disku ani v Gmailu nenašla (link zřejmě expiroval). **Benda pošle znovu — zatím neřešit.**

---

## 📋 Pořadí práce (dle Davida)

1. Přenahrát Simoniny videa v lepší kvalitě → **odblokováno, mapovat klipy → cviky a nahrát**
2. Opravit video v rozcvičce (boomerang Medvědí plank nachystán v `~/Desktop/pumplo-video-fixes/`, nenasazen)
3. Nachystat Bendovy landminy do smyčky → **čeká na re-send od Bendy**
4. **Až potom** update

## 🗂️ Backlog dalšího feedbacku (na později, velký redesign)

- **Vlastní trénink = úplně předělat podle appky Hevy** (Benda říká, že náš vlastní trénink je špatný). Stáhnout Hevy, okopírovat jejich flow vlastních tréninků.
- **Jáchym:** do vlastního tréninku přidat **tlačítko „přidat cvik"** i po nastavení (teď nejde přidat, aniž bys zrušil workout).

## 🎥 Video pipeline (až budou videa)
CapCut úprava → ffmpeg `-vcodec libx264 -crf 28 -an -movflags faststart` (krátké/unilaterální `-stream_loop 2`) → upload Supabase Storage → update `video_path`. Klipy mají kamerové kódy, ne názvy cviků → potřeba mapování klip → cvik.
