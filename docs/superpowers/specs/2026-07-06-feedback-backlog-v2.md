# Pumplo — Velký update: Feedback Backlog v2 (2026-07-06)

Zdroje: Davidovy Notes (22. 6., 29. 6., 4. 7.), WhatsApp Simona (6. 7.), WhatsApp Benda (5.–6. 7.).
Předchozí batch: `2026-06-08-feedback-backlog.md` (A–E, vše app-side hotové kromě C1/D3 + ops).

## Stav videí (kontext, mimo tento backlog)
- Simonina videa: přenahráno ✅ (44 klipů z 24.–25. 5.)
- Rozcvička: cvik opraven ✅
- Landminy: sestříhané klipy poslány Bendovi, nahraje je sám do adminu

---

## 🔴 F-kritické (bugy co štvou uživatele)

- **F1. Trénink se neuložil** (David, 4. 7.: „Neuložil se mi trénink a jsem z toho nasranej jako uživatel"). Najít root cause ukládání dokončeného tréninku — retry/offline queue, error stav, cokoliv. Souvisí s D1 (advanceToNextDay fix z června) — možná jiná cesta, kterou se uložení přeskočí.
- **F2. Ztráta stavu workoutu po návratu do appky** (Simona, 6. 7.: vyjela na plochu, po ~5 min se vrátila a byla na úvodní „začít workout" obrazovce). Rozjetý workout musí přežít backgrounding — persistovat session state + resume.
- **F3. Videa se na Androidu načítají moc dlouho** (22. 6.). Část možná vyřešena přenahráním na komprimovaná videa (0,3–0,9 MB); ověřit na Motorole, případně preload/cache.
- **F4. Info drawer cviku: konec textu je dole uříznutý a nejde doscrollovat** (Benda, 5. 7., screenshot „Stahování lopatek" — poslední řádek „bez pohybu paží" zapadá pod okraj). Scroll/bottom-padding bug v drawer komponentě.

## 🟡 F-lokalizace

- **F5. Názvy cviků v historii tréninku jsou česky i při EN** (4. 7.). Pozn.: v červnu (D4) označeno „saved name snapshots — acceptable", David teď říká, že NE. Historie musí resolvovat name_en.
- **F6. Admin panel: všechny cviky ve dvou jazycích** (22. 6.) — v adminu musí být viditelná/editovatelná CZ i EN verze všude.

## 🟡 F-homescreen & historie & plán

- **F7. Historie tréninku hned na homescreen** (22. 6.) — stejně jak vypadá v sekci historie.
- **F8. Tréninky/cviky vždy chronologicky za sebou** (22. 6. + 4. 7.: „cviky z minulého tréninku nejdou chronologicky na homescreenu").
- **F9. Po dokončení tréninku musí být z homescreenu poznat, že je dokončený** (4. 7.).
- **F10. Místo „týdnů" psát „bloky"** (22. 6.) — aby to nevyznělo špatně.
- **F11. RIR u deload týdnů = RIR 5** (22. 6.).

## 🔵 F-vlastní trénink — REDESIGN PODLE HEVY

- **F12. Tvorbu vlastního tréninku kompletně předělat 1:1 podle appky Hevy.** David má Hevy staženou a pošle screenshoty → z nich uděláme spec.
  - Benda (6. 7.): „tvoření vlastního tréninku je hrozné"; konkrétně: **u jednoho cviku musí přepisovat opakování zvlášť ke každé sérii** (chybí propsání hodnoty do všech sérií / copy-down).
  - Jáchym (červen): tlačítko **„přidat cvik" během běžícího workoutu** bez zrušení.

## 🟣 F-gamifikace (nový celek, 22. 6.)

- **F13. Ranking partií svalů** (kolik toho kdo odtrénoval per partie).
- **F14. Avatar + odemykání skinů za XP.**
- **F15. XP systém:** XP zvlášť za rozcvičku, trénink a protažení po tréninku; streak multiplikátor: den 1 → ×1,1; streak 2 → ×1,3; streak 3+ dny → ×1,5.

## ✅ Už hotové v 1.2.1 (jen ověřit na telefonu)
- Zobrazovat další cvik už u poslední série (df8bf70)
- Pauzy: zvuk/vibrace i na zamčené obrazovce (pumplo_rest kanál / timeSensitive)
- Obrazovka se nikdy neotáčí na šířku (portrait lock)

## Otevřené z června (stále platí)
- C1: dostupnost na Slovensku (App Store + Play)
- D3: store screenshoty s čistým status barem
- E1–E4: web redesign, Eurogym materiály + přístupy, gym-admin e-maily

## Navržené pořadí implementace
1. F1 + F2 (ukládání/persistence workoutu — kritické, ničí důvěru)
2. F4 (drawer scroll — malé), F5 (EN historie), F8/F9 (homescreen chronologie + stav dokončení)
3. F7, F10, F11 (homescreen historie, bloky, RIR deload)
4. F12 redesign vlastního tréninku podle Hevy (čeká na screenshoty od Davida)
5. F6 (admin dvojjazyčně), F3 ověření videí na Androidu
6. Gamifikace F13–F15 (větší celek, může jít v dalším updatu)
