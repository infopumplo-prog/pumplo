# F12 — Vlastní trénink podle Hevy, FÁZE 1: tvorba tréninku + výběr cviků (2026-07-07)

Zdroj: Davidovy screenshoty Hevy (Workout tab, Create Routine, Add Exercise picker). Další fáze (logging během tréninku atd.) přijdou v dalších screenshotech.

## Co kopírujeme z Hevy

### 1. Tvorba rutiny (Create Routine)
- Obrazovka s polem **Název tréninku** (placeholder „Název tréninku") + prázdný stav s ikonou a textem „Začni přidáním cviku"
- Primární tlačítko **+ Přidat cvik**
- **Uložit** vpravo nahoře (disabled dokud není název + ≥1 cvik), Zrušit vlevo

### 2. Add Exercise picker (fullscreen modal)
- Nahoře: **Zrušit | Přidat cvik | (Vytvořit — vlastní cvik, FÁZE 2, zatím vynechat)**
- **Search bar** — hledá v name + name_en, průběžně
- Dva filter chipy vedle sebe: **[Vybavení] [Svaly]** — každý otevře bottom sheet se seznamem (radio, „Vše" default, checkmark u zvolené)
- Seznam cviků: thumbnail (video poster/first frame, fallback ikona), název, sval (primary muscle CZ/EN dle jazyka)
- **Multi-select**: tap = toggle (modrý proužek vlevo u vybraných jako v Hevy), dole sticky CTA „Přidat N cviků"
- Sekce „Oblíbené cviky" (nejpoužívanější — u nás zatím prostě abecedně / podle category), po zadání filtru/hledání plochý seznam

### 3. Filtry — mapování na Pumplo data
- **Svaly**: distinct `exercises.primary_muscles` seskupené do skupin jako Hevy (Břicho, Biceps, Triceps, Prsa, Záda, Ramena, Hýždě, Hamstringy, Kvadricepsy, Lýtka, Předloktí, Kardio…). Mapování CZ↔EN dle jazyka appky.
- **Vybavení**: `exercises.equipment_type` (hodnoty v DB zjistit distinct dotazem) → položky jako Hevy: Vše / Bez vybavení / Osa / Jednoručky / Kettlebell / Stroj / Kladka / Guma / … dle reálných hodnot.
- **Filtr posilovny (Pumplo navíc)**: default filtrovat na cviky dostupné ve vybrané posilovně (machine_id ∈ gym_machines vybraného gymu, nebo bez stroje). Přepínač „Jen moje posilovna" (default ON, vypnutelný).

## Kde to žije v kódu
- Tab „Vlastní trénink" na Home/Training → stávající custom workout flow (CustomPlanDetail.tsx, CustomWorkoutPlayer.tsx, + jak se dnes vytváří vlastní plán — prozkoumat a NAHRADIT tvorbu tímto novým flow).
- Zachovat stávající DB schéma vlastních tréninků (custom plans tabulky — prozkoumat), jen změnit UI tvorby. Pokud schéma neumí pořadí cviků/série/opakování per cvik, doplnit minimálně pořadí.
- Benda pain point: **opakování se musí přepisovat u každé série zvlášť** — při nastavení hodnoty v 1. sérii předvyplnit do všech dalších (copy-down). (Detail obrazovka nastavení sérií = FÁZE 2 podle dalších screenshotů, ale copy-down udělat hned, je to quick win.)
- Jáchym: „přidat cvik" i během běžícího vlastního tréninku — tlačítko v playeru vlastního tréninku otevře stejný Add Exercise picker (FÁZE 1 zahrnuje, pokud to player dovolí bez velkého zásahu).

## Verdikt UI stylu
Vizuálně držet Pumplo design systém (zaoblené karty, primární cyan), layout a interakce 1:1 Hevy.
