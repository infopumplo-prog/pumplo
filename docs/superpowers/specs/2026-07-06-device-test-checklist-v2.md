# Device test checklist — velký update (fixy F1–F11 + 1.2.1)

Build: commit `b9c10a8` (+ `2249961`), web build + `cap sync ios android` hotové.
Spuštění: `open ios/App/App.xcworkspace` (iPhone kabelem) / `open -a "Android Studio" android` (Motorola).
Testovat ideálně na OBOU platformách; co je platform-specific, je označeno.

## 🔴 F1 — Neuložený trénink (offline fronta)
1. Spusť trénink, odcvič aspoň 2 cviky (klidně po 1 sérii).
2. **Před dokončením posledního cviku zapni Letadlo (airplane mode).**
3. Dokonči poslední cvik → objeví se souhrn. Očekávej toast: „Trénink se teď nepodařilo uložit — uloží se automaticky…"
4. Zavři appku úplně (swipe away), vypni letadlo, otevři appku.
5. ✅ Trénink je v historii (Home → Poslední tréninky) se všemi sériemi. Nesmí být duplicitně.

## 🔴 F2 — Zabití appky uprostřed tréninku (Simona)
1. Spusť trénink, dokonči ~2 série.
2. Vyjeď na plochu a **zabij appku** (swipe away v app switcheru).
3. Otevři appku znovu.
4. ✅ Na Home je karta „pozastavený trénink" → Pokračovat → jsi na správném cviku a správné sérii, dokončené série sedí.
5. Dokonči trénink → ✅ karta pozastaveného tréninku zmizela, trénink uložen jednou.

## 🔴 F4 — Scroll textu u cviku (Benda)
1. V tréninku (nebo náhledu tréninku) rozklikni ℹ️ u cviku s dlouhým textem — ideálně **Stahování lopatek** v rozcvičce, případně jakýkoli dřep/mrtvý tah.
2. ✅ Text jde doscrollovat úplně dolů, poslední řádek Tipů není uříznutý, pod textem je mezera nad home-indikátorem.

## 🔴 F3 — Rychlost videí (hlavně Motorola)
1. Na Motorole projdi 3–4 cviky s novými videi (např. Dřep ve stojanu, Rotace trupu, Hip thrust v kleci).
2. ✅ Video naskočí do ~2 s na gym wifi/LTE. Poznamenej, která videa jsou pomalá (stará nekomprimovaná).

## 🟡 F5 — EN názvy v historii
1. Přepni appku do angličtiny (Settings).
2. Home → rozbal Poslední tréninky → rozklikni starší trénink.
3. ✅ Názvy cviků anglicky (starší tréninky: v rozbalené kartě; úplně staré mohou mít CZ jen pokud cvik už neexistuje v DB).

## 🟡 F7/F8/F9 — Homescreen
1. ✅ F7: Home → „Poslední trénink" rozbalí **až 3 poslední tréninky** (karty jako v historii).
2. ✅ F8: v rozkliknutém tréninku (novém, odcvičeném po updatu) jsou cviky **v pořadí, jak jsi je cvičil** (ne abecedně). Pozn.: tréninky odcvičené PŘED updatem chronologii nemají — kontroluj na novém.
3. ✅ F9: hned po dokončení tréninku je na Home **zelená karta „Trénink dokončen"** se statistikami (dřív se neukazovala). Druhý den zmizí a ukáže se další trénink.

## 🟡 F10/F11 — Bloky + deload
1. Můj plán → ✅ hlavička říká „Blok N" (ne Týden), šipkami dojeď na blok 7/8 → ✅ zelený štítek Deload + RIR 5.
2. (RIR 5 v playeru se ukáže jen reálně v deload bloku — netestovatelné bez posunutí progressu, přeskoč.)

## 📦 Regrese z 1.2.1 (ještě neověřeno na telefonu)
1. **Další cvik u poslední série:** u poslední série cviku se vlevo dole ukáže „Další: …" s mini videem. Sedí velikost/pozice?
2. **Pauza na zamčené obrazovce:** spusť pauzu mezi cviky, zamkni telefon. Na tichém režimu → zavibruje; se zvukem → pípne (iOS: time-sensitive notifikace).
3. **Portrait lock:** otoč telefon na šířku kdekoli v appce → ✅ zůstává na výšku.
4. Rychlý smoke: onboarding otevře, QR sken stroje, admin drawer cviku (web).

## Po testu
- Padlé body → nahlásit, opravím.
- Vše zelené → bump verze (1.3.0), Archive → App Store Connect + Signed Bundle (STEJNÝ keystore) → Play Console. SK dostupnost (C1) nastavit při submitu!
