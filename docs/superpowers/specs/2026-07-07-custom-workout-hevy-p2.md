# F12 FÁZE 2 — Hevy routine editor: série, typy sérií, rest timer, poznámky (2026-07-07)

Zdroj: Davidovy screenshoty Hevy (Create Routine detail). Navazuje na P1 (ExercisePicker, docs/…-hevy-p1.md, commit 23c5747). Davidovo zadání: „tam kde Hevy má 3D animace, dej VŽDY naše videa" + „vysvětlování jednotlivých druhů setů".

## Karta cviku v editoru (CustomPlanDetail)
- Hlavička: **video thumbnail** (naše video, preload=metadata, fallback ikona) + název cviku (klik = detail cviku s naším videem a popisem — použít existující info drawer) + ⋮ menu (odebrat cvik, přesunout)
- **Poznámka k cviku** — jednořádkový input „Přidej poznámku…" (persistovat; pokud custom_plan_exercises nemá sloupec, ulož do JSON pole co existuje, jinak přidej `notes` text sloupec — DDL připravit jako SQL pro dashboard, NEaplikovat)
- **Rest Timer per cvik**: řádek „Pauza: 1 min 30 s / Vypnuto" → bottom sheet s wheel/list pickerem (Vypnuto, 5 s … po 5 s do 5 min), default z goal logiky
- **Tabulka sérií**: sloupce SÉRIE | KG | OPAK. — editovatelné number inputy, copy-down z P1 zachovat
- **+ Přidat sérii** — zkopíruje hodnoty poslední série

## Typy sérií (tap na číslo série → bottom sheet „Typ série")
- **W Rozehřívací** (oranžová) — „Rozehřívací série připraví tělo na těžší váhy. Nepočítá se do pracovního objemu."
- **1 Normální** — „Pracovní série — ty budují sílu a svaly."
- **F Do selhání** (červená) — „Série, ve které jsi dosáhl svalového selhání a poslední opakování už jsi nedokončil. Když selžeš na 11., zapiš 10."
- **D Drop set** (modrá) — „Po dosažení selhání hned pokračuješ s nižší váhou bez pauzy."
- **✕ Odebrat sérii** (červená)
- Každá položka má **?** → alert s vysvětlením (texty výše, CZ+EN do i18n)
- Typ série ukládat (rozšíř *_per_set JSON/array o typ; W se nepočítá do statistik objemu při ukládání workout_session_sets — jen označit, agregace řešit až P3)

## Validace + zbytek
- Uložit bez názvu → dialog „Trénink potřebuje název" (jak Hevy)
- Player vlastního tréninku: respektovat per-cvik rest timer a typ série (zobrazit W/F/D badge u série); vysvětlení typů dostupné i v playeru přes ?
- Vizuál: Pumplo design systém, ne Hevy modrá

## Kvalita
tsc + build čisté, žádný cap sync, nic necommitovat, generovaný Pumplo plán nedotčen. DDL (pokud potřeba) vypsat jako SQL do summary, neaplikovat.
