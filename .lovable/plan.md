
# Plán opravy: PPL místo Upper/Lower splitu

## Identifikovaný problém

### Situace
Tvůj plán zobrazuje **Push/Pull/Legs** (den C = Legs, den A = Push, den B = Pull), ale měl bys mít **Upper/Lower** nebo **Full Body** split.

### Příčina
Tabulka `day_templates` má pevné mapování mezi `goal_id` a `split_type`:

| goal_id | split_type | Dny |
|---------|------------|-----|
| muscle_gain | ppl | Push, Pull, Legs |
| fat_loss | upper_lower | Horní tělo, Dolní tělo |
| general_fitness | full_body | Celé tělo A, Celé tělo B |
| strength | upper_lower | Horní tělo, Dolní tělo |

**Problém:** Pro cíl `muscle_gain` existují POUZE PPL šablony. Ale metodika PUMPLO říká:
- 4 tréninkové dny → **Upper/Lower** split (ne PPL)
- PPL je pouze pro 5+ dnů

### Co se stalo
1. Máš cíl `muscle_gain` a **4 tréninkové dny** (`[friday, sunday, monday, wednesday]`)
2. Generátor správně určil split podle frekvence: `getSplitFromFrequency(4, 'beginner')` = **`upper_lower`**
3. ALE v databázi pro `muscle_gain` existuje pouze `split_type = 'ppl'`
4. Generátor musel použít Full Body jako fallback (A/B), protože nenašel Upper/Lower pro muscle_gain
5. UI pak načetlo názvy dnů podle `goal_id = muscle_gain` → dostalo PPL názvy (Push/Pull/Legs)

### Důkaz z databáze
Tvůj plán má ve skutečnosti **Full Body** cviky (A/B):
- **Den A**: squat, horizontal_push, horizontal_pull, anti_extension
- **Den B**: hinge, vertical_push, vertical_pull, lunge

Ale UI zobrazuje Push/Pull/Legs protože načítá názvy z `day_templates` kde `goal_id = 'muscle_gain'` → PPL.

---

## Řešení

### 1. Opravit tabulku `day_templates` - přidat všechny kombinace split×goal

Pro každý cíl musí existovat všechny tři typy splitů:

```sql
-- Přidat Upper/Lower pro muscle_gain
INSERT INTO day_templates (goal_id, split_type, day_letter, day_name, slot_order, role_id, ...) VALUES
('muscle_gain', 'upper_lower', 'A', 'Horní tělo', 1, 'horizontal_push', ...),
('muscle_gain', 'upper_lower', 'A', 'Horní tělo', 2, 'horizontal_pull', ...),
('muscle_gain', 'upper_lower', 'B', 'Dolní tělo', 1, 'squat', ...),
('muscle_gain', 'upper_lower', 'B', 'Dolní tělo', 2, 'hinge', ...);

-- Přidat Full Body pro muscle_gain
INSERT INTO day_templates (goal_id, split_type, day_letter, day_name, slot_order, role_id, ...) VALUES
('muscle_gain', 'full_body', 'A', 'Celé tělo A', 1, 'squat', ...),
('muscle_gain', 'full_body', 'A', 'Celé tělo A', 2, 'horizontal_push', ...),
('muscle_gain', 'full_body', 'B', 'Celé tělo B', 1, 'hinge', ...),
('muscle_gain', 'full_body', 'B', 'Celé tělo B', 2, 'vertical_push', ...);

-- Podobně pro ostatní cíle
```

### 2. Opravit `useWorkoutPlan.ts` - načítat šablony podle split_type

Aktuálně (řádek 100-102):
```typescript
const { data: dayTemplatesData } = await supabase
  .from('day_templates')
  .select('day_letter, day_name')
  .eq('goal_id', planData.goal_id);  // ← ŠPATNĚ
```

Správně by mělo být:
```typescript
// Určit split_type z uloženého plánu nebo inputs_snapshot
const splitType = planData.inputs_snapshot_json?.split_type 
  || determineSplitFromExercises(exercisesData);

const { data: dayTemplatesData } = await supabase
  .from('day_templates')
  .select('day_letter, day_name')
  .eq('split_type', splitType);  // ← SPRÁVNĚ
```

### 3. Přidat sloupec `split_type` do `user_workout_plans`

Pro spolehlivé uložení jakým splitem byl plán vygenerován:

```sql
ALTER TABLE user_workout_plans ADD COLUMN split_type text;
```

A v generátoru uložit:
```typescript
p_split_type: splitType  // 'full_body', 'upper_lower', nebo 'ppl'
```

---

## Shrnutí změn

| Soubor/Tabulka | Změna |
|----------------|-------|
| `day_templates` (DB) | Přidat všechny kombinace goal×split (9 kombinací celkem) |
| `user_workout_plans` (DB) | Přidat sloupec `split_type` |
| `src/hooks/useWorkoutPlan.ts` | Načítat day names podle `split_type`, ne `goal_id` |
| `src/hooks/useWorkoutGenerator.ts` | Ukládat `split_type` do plánu |

---

## Proč to je důležité

Bez této opravy:
- Uživatel s cílem `muscle_gain` a 4 tréninkovými dny uvidí PPL (Push/Pull/Legs) názvy, ale bude mít Upper/Lower cviky
- UI bude matoucí - zobrazí "Legs" ale cviky budou pro celé tělo
- Den C (Legs) bude prázdný, protože plán má jen A a B
