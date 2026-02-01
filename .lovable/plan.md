
# Oprava PPL/Upper-Lower splitu - DOKONČENO ✅

## Co bylo opraveno

### 1. Databázová struktura
- **Přidán sloupec `split_type`** do tabulky `user_workout_plans`
- **Opraven unikátní constraint** v `day_templates` aby zahrnoval `split_type`
- **Přidány všechny kombinace goal×split** (12 kombinací):
  - `muscle_gain`: full_body, upper_lower, ppl
  - `fat_loss`: full_body, upper_lower, ppl
  - `strength`: full_body, upper_lower, ppl
  - `general_fitness`: full_body, upper_lower, ppl

### 2. Logika načítání názvů dnů
- **`useWorkoutPlan.ts`**: Nyní načítá názvy dnů podle `split_type` místo `goal_id`
- Přidána detekce `splitType` z:
  1. Uloženého sloupce `split_type`
  2. Snapshotu `inputs_snapshot_json.split_type`
  3. Fallback: výpočet ze `getSplitFromFrequency()`

### 3. Generátor
- **`useWorkoutGenerator.ts`**: Ukládá `split_type` do `inputs_snapshot_json`
- `PlanInputsSnapshot` interface rozšířen o `split_type`

## Výsledek

Nyní:
- 4 tréninkové dny → zobrazí "Horní tělo" / "Dolní tělo" (Upper/Lower)
- 3 a méně → zobrazí "Celé tělo A" / "Celé tělo B" (Full Body)
- 5+ dnů → zobrazí "Push" / "Pull" / "Legs" (PPL)

**Pro aplikaci nových názvů dnů je potřeba regenerovat plán.**
