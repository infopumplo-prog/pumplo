

# Plán opravy: Dotazník a logika podle metodiky PUMPLO

## Souhrn hlavního problému

Aktuální implementace má **fundamentálně špatnou logiku** - split je určován podle CÍLE, ale podle metodiky by měl být určován podle **POČTU TRÉNINKOVÝCH DNÍ** (frekvence).

---

## Co říká metodika (sekce 3.1)

```
Split je volen primárně podle frekvence:
- pokud frequencyPerWeek <= 3 → Full Body A/B (FB_AB)
- pokud frequencyPerWeek == 4 → Upper/Lower A/B (UL_AB)  
- pokud frequencyPerWeek >= 5 → Push/Pull/Legs A/B/C (PPL_ABC)

Bezpečnostní override pro začátečníky:
- pokud level == beginner && frequencyPerWeek >= 5 → použij UL_AB
```

```
Délka plánu: 12 týdnů pro VŠECHNY cíle (sekce 10)
- týdny 1-3: build
- týden 4: deload
- týdny 5-7: build
- týden 8: deload
- týdny 9-11: build
- týden 12: deload
```

---

## Co je aktuálně ŠPATNĚ

### 1. `trainingGoals.ts` - Split podle cíle
```typescript
// ŠPATNĚ - split je napevno přiřazen k cíli
export const GOAL_TO_SPLIT = {
  'muscle_gain': 'ppl',        // ❌
  'fat_loss': 'upper_lower',   // ❌
  'strength': 'upper_lower',   // ❌
  'general_fitness': 'full_body' // ❌
};

// ŠPATNĚ - různá délka plánu
{ id: 'muscle_gain', description: 'Délka plánu: 12 týdnů' },
{ id: 'fat_loss', description: 'Délka plánu: 8 týdnů' },    // ❌
{ id: 'strength', description: 'Délka plánu: 8 týdnů' },    // ❌
```

### 2. Databáze `day_templates` - Vázané na cíl
```sql
-- ŠPATNĚ - templates jsou pod goal_id
goal_id: muscle_gain → Push/Pull/Legs
goal_id: fat_loss → Upper/Lower
goal_id: general_fitness → Full Body A/B
```

### 3. UI v `OnboardingDrawer.tsx` - Špatný text
```tsx
// Řádek 343-347: Zobrazuje "Split: ... (automaticky podle cíle)"
// ŠPATNĚ - mělo by být podle počtu dnů
```

---

## Plán opravy

### Fáze 1: Nová logika určení splitu

**Soubor:** `src/lib/trainingGoals.ts`

Přidat novou funkci pro určení splitu podle frekvence a úrovně:

```typescript
/**
 * Určí split na základě počtu tréninkových dnů a úrovně uživatele
 * Podle metodiky PUMPLO v1.1, sekce 3.1
 */
export const getSplitFromFrequency = (
  frequency: number, 
  userLevel: UserLevel
): 'full_body' | 'upper_lower' | 'ppl' => {
  // Bezpečnostní override pro začátečníky
  if (userLevel === 'beginner' && frequency >= 5) {
    return 'upper_lower';
  }
  
  // Základní pravidlo podle frekvence
  if (frequency <= 3) return 'full_body';
  if (frequency === 4) return 'upper_lower';
  return 'ppl'; // frequency >= 5
};

// Konstanty pro split
export const SPLIT_INFO = {
  full_body: { label: 'Full Body', days: ['A', 'B'] },
  upper_lower: { label: 'Horní / Dolní tělo', days: ['A', 'B'] },
  ppl: { label: 'Push / Pull / Legs', days: ['A', 'B', 'C'] }
};
```

Upravit `MVP_GOALS` - odstranit `split` a sjednotit délku na 12 týdnů:

```typescript
export const MVP_GOALS = [
  { 
    id: 'muscle_gain' as TrainingGoalId, 
    label: 'Nabrat svaly', 
    emoji: '💪',
    // SMAZAT: split: 'ppl',
    description: 'Délka plánu: 12 týdnů',
  },
  { 
    id: 'fat_loss' as TrainingGoalId, 
    label: 'Zhubnout', 
    emoji: '🔥',
    description: 'Délka plánu: 12 týdnů', // Opravit z 8
  },
  // ... ostatní také 12 týdnů
];
```

**Smazat:** `GOAL_TO_SPLIT` mapping (již nepotřebný)

---

### Fáze 2: Migrace databáze `day_templates`

Změnit strukturu - templates vázané na **split typ**, ne na cíl:

```sql
-- 1. Přidat sloupec split_type
ALTER TABLE day_templates ADD COLUMN split_type TEXT;

-- 2. Migrovat data - templates jsou stejné pro všechny cíle se stejným splitem
UPDATE day_templates SET split_type = 'full_body' WHERE goal_id = 'general_fitness';
UPDATE day_templates SET split_type = 'upper_lower' WHERE goal_id IN ('fat_loss', 'strength');
UPDATE day_templates SET split_type = 'ppl' WHERE goal_id = 'muscle_gain';

-- 3. Deduplikovat - ponechat jen jednu sadu pro každý split
-- (fat_loss a strength mají stejné UL templates)

-- 4. V budoucnu: goal_id bude ovlivňovat jen rep_min/rep_max, ne strukturu dne
```

---

### Fáze 3: Upravit `useWorkoutGenerator.ts`

Změnit `fetchDayTemplates` aby hledala podle **split_type**, ne goal_id:

```typescript
const fetchDayTemplates = async (splitType: string): Promise<DayTemplate[]> => {
  const { data, error } = await supabase
    .from('day_templates')
    .select('*')
    .eq('split_type', splitType)  // ZMĚNA: split_type místo goal_id
    .order('day_letter')
    .order('slot_order');
  // ...
};
```

Upravit volání `generateWorkoutPlan`:

```typescript
// Místo předávání goalId pro templates, vypočítat split
const splitType = getSplitFromFrequency(trainingDays.length, userLevel);
const templates = await fetchDayTemplates(splitType);
```

---

### Fáze 4: Upravit `OnboardingDrawer.tsx`

1. **Odstranit** import `GOAL_TO_SPLIT`
2. **Přidat** import `getSplitFromFrequency`
3. **Změnit** výpočet splitu:

```typescript
// PŘED (řádky 113, 176):
const trainingSplit = primaryGoal ? GOAL_TO_SPLIT[primaryGoal] : null;

// PO:
const trainingSplit = trainingDays.length > 0 && userLevel
  ? getSplitFromFrequency(trainingDays.length, userLevel)
  : null;
```

4. **Změnit** info banner (řádky 339-350):

```tsx
{/* Show split info derived from frequency */}
{trainingDays.length > 0 && userLevel && (
  <div className="mt-3 p-2 bg-muted rounded-lg text-center">
    <span className="text-xs text-muted-foreground">
      Split: <span className="font-medium text-foreground">
        {getSplitFromFrequency(trainingDays.length, userLevel) === 'ppl' 
          ? 'Push / Pull / Legs' 
          : getSplitFromFrequency(trainingDays.length, userLevel) === 'upper_lower' 
            ? 'Horní / Dolní tělo' 
            : 'Full Body'}
      </span> (podle počtu dnů: {trainingDays.length})
    </span>
  </div>
)}
```

---

### Fáze 5: Upravit `OnboardingGoalStep.tsx`

Odstranit popis délky plánu z jednotlivých cílů (bude jednotná 12 týdnů):

```typescript
const OnboardingGoalStep = ({ value, onChange }: OnboardingGoalStepProps) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Co je tvůj hlavní cíl?</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Vyber jeden cíl - ovlivní typ cviků a počet opakování
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Délka plánu: 12 týdnů (pro všechny cíle)
        </p>
      </div>
      {/* Goals bez description o délce */}
    </div>
  );
};
```

---

## Shrnutí změn

| Soubor | Změna |
|--------|-------|
| `src/lib/trainingGoals.ts` | Přidat `getSplitFromFrequency()`, smazat `GOAL_TO_SPLIT`, sjednotit délku na 12 týdnů |
| `src/components/OnboardingDrawer.tsx` | Použít novou funkci pro split, opravit banner |
| `src/components/onboarding/OnboardingGoalStep.tsx` | Odstranit individuální délky, přidat společnou 12 týdnů |
| `src/hooks/useWorkoutGenerator.ts` | Změnit logiku načítání templates podle split_type |
| Databáze `day_templates` | Přidat `split_type`, migrovat data |

---

## Logika podle metodiky

```
1. Uživatel vybere CÍL (strength, hypertrophy, conditioning, fat_loss)
   → Ovlivňuje rep-range a RIR

2. Uživatel vybere DNY (frekvence 2-6)
   → Určuje SPLIT:
     - ≤3 dny = Full Body A/B
     - 4 dny = Upper/Lower A/B  
     - ≥5 dní = Push/Pull/Legs A/B/C
     - Začátečník + ≥5 dní = Upper/Lower (bezpečnostní override)

3. Délka plánu = 12 týdnů (pro VŠECHNY cíle)
```

