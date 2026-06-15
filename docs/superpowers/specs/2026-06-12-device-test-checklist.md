# Pumplo v1.1 — Device Test Checklist (2026-06-12)

Build: branch `feat/push-notifications` @ 3ac196b (web build + cap sync hotové).
Deploy: iOS = Xcode ▶ na iPhone · Android = `npx cap run android` (Motorola ZY32M2PFWK).
Pozn.: David je `is_staff=true` → location gate ho pouští všude. Stav rotace: poslední odjetý = A (Horní, út 9.6.), další ve frontě = **B (Dolní)**.

## 1. Konzistence tréninkového dne (D1+D5+D6) 🔴 hlavní
- [x] 1a. Home: nabízí **B / Dolní tělo** jako další trénink ✅ (2026-06-15)
- [x] 1b. Trénink (týdenní mřížka): dnešek/nejbližší den ukazuje **B / Dolní tělo** ✅
- [x] 1c. Můj plán (rozklik z Home): stejná informace — **už žádný „upper vs lower" rozpor** ✅
- [x] 1d. Procenta progresu: Home % == Trénink % (stejné číslo) ✅
- [ ] 1e. Checkmarky v Můj plán sedí na den, kdy se reálně trénovalo (út), ne na první kartu týdne (po)

## Nové bugy z device testu (2026-06-15)
- [x] **N1. „Můj plán" neukazoval splněné tréninky.** Mezikrok (65e3994) zkusil kalendářní model, ale to bylo proti Davidovu modelu — viz N2.
- [x] **N2. Plán se má prodlužovat na všech 60 tréninků.** Pokus o čistou frontu (8a4c705) plnil splněné od první karty týdne → označil dnešní pondělí jako ✓, i když David dnes netrénoval (N3).
- [x] **N3. + N4. FINÁLNÍ MODEL = frontový jako Hevy/Strong** (commit 2eba923, David: „zvolme co mají oni"). „Můj plán" je sekvenční fronta tréninků, NE kalendář dnů. Karty popsané TRÉNINKEM („Horní tělo · 3. trénink"), ne dnem v týdnu → mizí zmatek „pondělí je hotové". Stav jen hotovo ✓ / další / co potom; ŽÁDNÉ „zmeškáno", fronta čeká. Posun týdne = dokončením (currentWeek=floor(completed/count)+1) → plán se natáhne na všech 60. Dny v týdnu zůstaly jen jako chipy nahoře (rozvrh). Mezikroky 65e3994/6f26af5 (kalendář) zahozeny. **POTVRZENO Davidem na telefonu: „vypadá to super".** Viz paměť [[workout-plan-display-model]].
- [x] **N5. Onboarding/notifikace vs frontový model → zvolena cesta A** (commit a5811ca). Dny zůstávají jako **rozvrh připomínek** (jako Hevy: plán = fronta, dny = kdy připomínat). Notifikace BEZ změny logiky. Onboarding copy: days_title přeformulován + days_subtitle „Slouží jen jako tvůj rozvrh pro připomínky." (zkráceno commit ef75cd5). **K ověření na telefonu.**
- [x] **N6. Trénink srovnán na stejný frontový model jako Můj plán** (commit e4b3856). Mřížka = fronta (karty „Horní tělo · 3. trénink", hotovo ✓/další/co potom, žádné „zmeškáno"). currentWeek count-based. **Start/preview/bonus ODDĚLENO od mřížky** → jede na reálném kalendáři (je dnes tréninkový den) + reálných session (`completedToday` podle data), ne podle pozice ve frontě, takže off-schedule trénink z minula NEoznačí dnešek jako hotový / neschová Start. **OVĚŘENO NA ZAŘÍZENÍ Davidem (2026-06-15):** se simulovanou polohou Eurogymu gate prošel a Start správně nabídl **Dolní tělo (B)** = fronta sedí end-to-end.

## Jak simulovat polohu v Xcode (pro test Startu mimo Eurogym)
GPX hotový: `ios/App/App/Eurogym.gpx` (skutečné souřadnice z DB: **49.5893, 17.2335**; POZOR ne souřadnice z logu = Davidův domov ~1 km vedle). Při běhu: Xcode → spodní debug lišta → ikona šipky (Simulate Location) → **Eurogym Olomouc**. Po editaci GPX přepnout None→Eurogym. Ověřeno funkční.

## 2. Workout flow
- [x] 2a. Start tréninku → nabídne B (Dolní), ne A ✅ (na zařízení 2026-06-15)
- [ ] 2b. Video cviku se samo přehraje; po návratu z pozadí pokračuje (A2)
- [ ] 2c. Během pauzy mezi cviky se přednačítá/ukazuje video dalšího cviku (A4)
- [ ] 2d. Apka na pozadí při pauze → po konci pauzy přijde lokální notifikace (A3)
- [ ] 2e. Dokončení tréninku → po Finish se den posune (další = A/Horní)
- [ ] 2f. Zavření apky na share obrazovce (bez Finish) → po znovuotevření se den i tak posune správně (self-heal D1)

## 3. Swap + EN lokalizace (D2+D4)
- [ ] 3a. Preview: výměna cviku → nový název i video spolu sedí (CS)
- [ ] 3b. Totéž v EN režimu: vyměněný cvik má anglický název (ne starý CZ/CS název s novým videem)
- [ ] 3c. EN režim: seznam cviků v preview + info drawer všude anglicky
- [ ] 3d. Chyby/tipy u cviku v jazyce apky (A9)
- [ ] 3e. Historie tréninků: názvy cviků lokalizované (commit 6ab51f2)

## 4. Sdílení (A10)
- [ ] 4a. Share obrázek je čisté 9:16 bez roztažení
- [ ] 4b. V share sheetu se nabízí Instagram (sdílí se jako soubor)

## 5. Onboarding / gym (A6–A8, B1)
- [ ] 5a. Nový účet (OAuth i e-mail): jméno je povinné v onboardingu
- [ ] 5b. První výběr gymu: zelené „Vybrat tuto posilovnu" CTA na mapě i v detailu
- [ ] 5c. Odepřená poloha → návod do Nastavení (A8)
- [ ] 5d. Mimo gym (non-staff účet!): plán vidět, regenerovat lze, start blokovaný + nudge „doporuč nám svůj gym" (6ab51f2)
- [ ] 5e. Staff účet (David): start jde kdekoliv

## 6. Push notifikace (sanity, už ověřeno dříve)
- [ ] 6a. Testovací push dorazí na iOS i Android a kliknutí otevře správnou route

## Stav 2026-06-15 (device test)
- [x] 1a–1d, 2a–2f, 3 (swap+EN) — POTVRZENO Davidem na zařízení ✅
- [x] Rest audio: nativní beep (RestAudioPlugin.swift, registrace přes MainViewController/capacitorDidLoad), slyšet na pozadí/zamčeno+sluchátka, hudba hraje dál, žádná notifikace, 16-bit keep-alive (bez bzučení). Funguje běžný i vlastní trénink. Commits ...8bf1b9a, e4a5ef5.
- [x] Rest video: full-screen pozadí + resume + přednačtení během cviku (00bcd66).
- [x] Onboarding: jméno pryč z „About you" (0108204).

## Zbývá / nové bugy
- [ ] **SDÍLENÍ pořád špatně** (David 15.6.): sdílený obrázek se v Instagram Stories chová jako NÁLEPKA přes kameru (vidět selfie za kartou), ne jako pozadí. Composite v WorkoutShareCard.tsx JE opaque (fillRect #000), takže to není průhlednost obrázku → problém je v PŘEDÁNÍ do IG (Capacitor Share files → IG to bere jako sticker). FIX (příště, čerstvý kontext): nejspíš použít IG Stories pasteboard API `com.instagram.sharedSticker.backgroundImage` místo generic share sheetu. Vyžaduje nativní + device test.
- [ ] 4b. Instagram v share sheetu (souvisí s ^).
- [ ] 5a–5e onboarding/gym (5d potřebuje non-staff účet), 6a push sanity.
- [ ] ducking (ztlumit hudbu při pípnutí) — ODLOŽENO na příští update.
- [ ] D3 store screenshoty, Eurogym materiály/creds (C3/C4/C5), Slovensko (C1), gym-admin e-maily, web PR #1 merge+publish.
