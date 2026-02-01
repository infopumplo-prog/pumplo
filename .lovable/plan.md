

# Oprava: Správná detekce split_type z cviků v plánu

## Příčina problému

Tvůj plán byl vygenerován jako **Full Body** (cviky `squat` + `horizontal_push` v jednom dni A), ale:
1. `split_type` sloupec v DB = `NULL` (RPC funkce ho neukládá)
2. `inputs_snapshot_json` = `NULL` (starší verze generátoru)
3. Fallback logika v `useWorkoutPlan.ts` používá `getSplitFromFrequency(4, ...)` = `upper_lower`
4. UI pak zobrazuje "Horní tělo" místo "Celé tělo A"

**Výsledek**: Clap Curtsy Squat (squat role) se zobrazuje pod "Horní tělo" - to je matoucí.

## Řešení

Přidáme **detekci split_type z obsahu cviků**, ne z frekvence. Pokud den A obsahuje jak upper, tak lower body cviky → je to Full Body.

### Logika deriveSplitType:

```
Den A obsahuje:
  - squat/hinge/lunge/step → lower body role ✓
  - horizontal_push/pull, vertical_push/pull → upper body role ✓

Pokud má den A OBĚ → split = full_body
Pokud počet dnů = 3 → split = ppl
Jinak → split = upper_lower
```

## Technické změny

| Soubor | Změna |
|--------|-------|
| `src/hooks/useWorkoutPlan.ts` | Přidat funkci `deriveSplitTypeFromExercises()` která analyzuje role v cviků a vrátí správný split_type |
| `src/hooks/useWorkoutGenerator.ts` | Upravit RPC volání - předat `split_type` jako parametr |
| Migrace SQL | Přidat parametr `p_split_type` do RPC `generate_workout_plan_atomic` a uložit do sloupce |

## Detailní implementace

### 1. useWorkoutPlan.ts - nová funkce

```typescript
const deriveSplitTypeFromExercises = (exercises: any[]): SplitType => {
  const LOWER_ROLES = ['squat', 'hinge', 'lunge', 'step', 'jump'];
  const UPPER_ROLES = ['horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull', 
                       'elbow_flexion', 'elbow_extension'];
  
  // Analyzovat den A
  const dayAExercises = exercises.filter(e => e.day_letter === 'A');
  const hasLowerBody = dayAExercises.some(e => LOWER_ROLES.includes(e.role_id));
  const hasUpperBody = dayAExercises.some(e => UPPER_ROLES.includes(e.role_id));
  
  // Pokud den A má obojí → Full Body
  if (hasLowerBody && hasUpperBody) {
    return 'full_body';
  }
  
  // Počet unikátních dnů
  const uniqueDays = new Set(exercises.map(e => e.day_letter));
  if (uniqueDays.size >= 3) return 'ppl';
  
  return 'upper_lower';
};
```

### 2. Změna fallback logiky (řádek 110-114)

```typescript
// Místo:
const splitType: SplitType = (planData as any).split_type 
  || (planData.inputs_snapshot_json as any)?.split_type
  || getSplitFromFrequency(trainingDaysCount, userLevel);

// Na:
const splitType: SplitType = (planData as any).split_type 
  || (planData.inputs_snapshot_json as any)?.split_type
  || deriveSplitTypeFromExercises(exercisesData || []);
```

### 3. RPC migrace (budoucí prevence)

```sql
ALTER FUNCTION generate_workout_plan_atomic ADD PARAMETER p_split_type TEXT;
-- A v INSERT přidat: split_type = p_split_type
```

## Očekávaný výsledek

Po opravě:
- Systém detekuje, že den A obsahuje `squat` + `horizontal_push` → **Full Body**
- UI zobrazí: "Celé tělo A" místo "Horní tělo"
- Clap Curtsy Squat bude dávat smysl v kontextu Full Body tréninku

## Poznámka k regeneraci plánu

Existující plán má smíchanou strukturu. Pokud chceš **opravdu Upper/Lower** (horní tělo v dni A, dolní v dni B), budeš muset plán **regenerovat**. Tato oprava pouze zajistí správné zobrazení názvů dnů.

