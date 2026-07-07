# Pumplo — Velký update: Feedback Backlog v2 (2026-07-06)

Zdroje: Davidovy Notes (22. 6., 29. 6., 4. 7.), WhatsApp Simona (6. 7.), WhatsApp Benda (5.–6. 7.).
Předchozí batch: `2026-06-08-feedback-backlog.md` (A–E, vše app-side hotové kromě C1/D3 + ops).

## Stav videí (kontext, mimo tento backlog)
- Simonina videa: přenahráno ✅ (44 klipů z 24.–25. 5.)
- Rozcvička: cvik opraven ✅
- Landminy: sestříhané klipy poslány Bendovi, nahraje je sám do adminu

---

## 🔴 F-kritické (bugy co štvou uživatele)

- **F1. ✅ DONE (b9c10a8).** Root cause: `saveWorkoutSession` selhání jen zalogovalo (`console.error`) a autoSave stejně nastavil `workoutSaved=true` — trénink se tiše ztratil. Fix: offline fronta `pumplo_unsaved_sessions` (localStorage), flush při startu appky / native resume / návratu online (`SaveQueueFlusher` v App.tsx, `src/lib/workoutSaveQueue.ts`), info toast `workout.save_queued`.
- **F2. ✅ DONE (b9c10a8).** Rozjetý workout se průběžně snapshotuje do `pumplo_paused_workout` (každá dokončená série / změna cviku) — OS-killnutá appka nabídne resume od poslední série přes existující PausedWorkoutCard flow. Snapshot se maže při dokončení i ukončení.
- **F3. Videa se na Androidu načítají moc dlouho** (22. 6.). Část možná vyřešena přenahráním na komprimovaná videa (0,3–0,9 MB); **ověřit na Motorole** při device testu.
- **F4. ✅ DONE (b9c10a8).** Root cause: scroll div v draweru bez `flex-1 min-h-0` uvnitř `max-h-[85vh]` flex column → overflow se nezapnul a text se ořízl. + safe-area bottom padding. Opraveno v ExercisePlayer i WorkoutPreview.

## 🟡 F-lokalizace

- **F5. ✅ DONE (b9c10a8).** `WorkoutSessionCard` (Home + History sessions tab) teď resolvuje `name_en` přes exercise_id (sety ukládají CZ snapshot). Training day-detail už to uměl.
- **F6. Admin panel: všechny cviky ve dvou jazycích** (22. 6.) — **OTEVŘENÉ, admin repo není lokálně** (admin.pumplo.com ≠ tento repo; src/pages/admin tady je mrtvý kód bez _en polí). Zjistit od Davida, kde admin žije (Lovable?).

## 🟡 F-homescreen & historie & plán

- **F7. ✅ DONE (b9c10a8).** Homescreen ukazuje poslední 3 sese (WorkoutSessionCard) jako v historii.
- **F8. ✅ DONE (b9c10a8).** Root cause ①: bulk insert setů = stejný created_at pro všechny řádky → řazení nedeterministické; teď insert dávka per cvik (created_at odlišuje cviky). Root cause ②: Training day-detail řadil abecedně (`order('exercise_name')`). Obě čtení teď řadí created_at → exercise_name → set_number. Staré sese zůstanou seskupené abecedně (data pro chronologii nemají).
- **F9. ✅ DONE (b9c10a8).** Root cause: zelená „dokončeno" karta vyžadovala shodu `completedTodayDayLetter === nextDay.dayLetter`, jenže self-heal posune den hned po uložení → karta se nikdy neukázala. Teď stačí existence dnešní dokončené sese.
- **F10. ✅ DONE (b9c10a8).** `myplan.week`/`history.week` už „Blok" byly; dopřeloženy zbývající training.* stringy (goal_types_weeks, weeks_frequency, bonus_from_first_week, plan_completed_desc, cancel_plan_desc) v cs i en.
- **F11. ✅ DONE (b9c10a8).** MyPlan deload badge RIR 5 už fungoval (RIR_BY_WEEK); v playeru se ale ukazoval slot RIR z day_templates — teď se v deload týdnu (týden = dokončené sese / dny v týdnu, 8týdenní cyklus) přepíše rirMin/rirMax na 5 v useWorkoutPlan.

## 🗄️ Datové opravy
- **✅ „Rotace trupu" (1041cbb8…)** — description/setup_instructions (CZ+EN) přepsány z kabelové kladky na selektorizovaný rotační stroj (PATCH 6. 7.).

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

## 🆕 Feedback od Saši (7. 7., iPhone 15, store verze)

- **F16. Tlačítko „Povolit polohu" nejde zmáčknout**, když je poloha vypnutá v nastavení telefonu (screen „Povolení polohy" s oranžovým boxem). Ověřit v aktuálním kódu (červnový fix A8 měl vést do Nastavení) — buď je button disabled, nebo handler na iOS nefunguje.
- **F17. Obsah se nepřizpůsobuje výřezu (Dynamic Island)** — na plan-overview obrazovce titulek „Získat sílu" podlézá pod status bar. Safe-area inset chybí minimálně na téhle obrazovce; projít i další fullscreen obrazovky.
- (Jeho „Týden 1/12" je stará store verze — v novém buildu už „Blok".)

## 📱 Device test 7. 7. (David, iPhone 17 Pro Max)
- ✅ Vibrace při pauze na tichém režimu + notifikace; se zvukem pípne
- ✅ Portrait lock všude
- ✅ „Další cvik" mini video u poslední série
- ✅ Scroll ℹ️ textu (na cvicích v tréninku)
- 🐛→✅ Kill test odhalil „Série 4/3" po zabití appky během pauzy mezi cviky — opraveno (cabc612): snapshot ukazuje na další cvik, resume normalizuje out-of-range index

## 🆕 David 7. 7. — onboarding & first-run UX

- **F18. Výběr posilovny pryč z onboarding dotazníku.** Gym není potřeba do startu tréninku → vybírat až přímo před tréninkem (pokud profil gym nemá). Onboarding = jen cíl/úroveň/dny/demografie.
- **F19. Uvítací tour po updatu (pro všechny, jednorázově) + průvodce prvním tréninkem.** Kamarád nevěděl, co které tlačítko dělá.
  - Home tour: „tady vlastní plán", „tady najdeš posilovnu", „tady tvůj plán" — spotlight overlay, zobrazit každému 1× po updatu (klíč ve storage per verze).
  - První trénink po updatu: coach marks v playeru — swap tlačítko (refresh cviku), rozmezí opakování („doporučený rozsah"), RIR lidsky u váhy: „Vyber váhu tak, aby ti na konci série zbývala ještě ~N opakování do selhání."
- **F20. Long-press na swap → list alternativ.** Krátký tap = náhodný swap (jak teď), podržení = bottom sheet se seznamem dostupných cviků stejné role (s videem/názvem/strojem), uživatel si vybere sám (např. volný stroj).

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
