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

## ⛔ BLOKOVANÉ — Simonina videa (krok 1 plánu)

- Chtěli jsme přenahrát cviky v lepší kvalitě z videí od Simony (stažené z Úschovny).
- **Zjištěno: zásilka od Simony (Úschovna `VPDRTE33MK6VCBUP`, 15. 6., 1,0 GB, 29× .MOV) obsahuje STARÁ videa — všech 29 natočeno 26. 2. 2026** (ověřeno přes ffprobe `creation_time`).
- Soubory jsou lokálně na disku: `~/Downloads/zasilka-VPDRTE33MK6VCBUP/` (rozbalené) + `.zip`. Úschovna link vypršel 29. 6. (chce platbu) — ale lokálně to máme, takže re-download netřeba.
- **V celém Gmailu je tohle jediná videozásilka od Simony — novější (lepší kvalita) neexistuje v mailu.**
- **Akce:** požádat Simonu, ať pošle SPRÁVNÁ nová videa (a ověří, že to nejsou ta z 26. 2.). Případně zkontrolovat, jestli je neposlala jinudy (WhatsApp / Google Drive).

---

## 📋 Pořadí práce (dle Davida)

1. Přenahrát Simoniny videa v lepší kvalitě → **BLOKOVÁNO** (nemáme nová videa)
2. Opravit video v rozcvičce
3. Nachystat Bendovy landminy (nová videa) do smyčky
4. **Až potom** update

## 🗂️ Backlog dalšího feedbacku (na později, velký redesign)

- **Vlastní trénink = úplně předělat podle appky Hevy** (Benda říká, že náš vlastní trénink je špatný). Stáhnout Hevy, okopírovat jejich flow vlastních tréninků.
- **Jáchym:** do vlastního tréninku přidat **tlačítko „přidat cvik"** i po nastavení (teď nejde přidat, aniž bys zrušil workout).

## 🎥 Video pipeline (až budou videa)
CapCut úprava → ffmpeg `-vcodec libx264 -crf 28 -an -movflags faststart` (krátké/unilaterální `-stream_loop 2`) → upload Supabase Storage → update `video_path`. Klipy mají kamerové kódy, ne názvy cviků → potřeba mapování klip → cvik.
