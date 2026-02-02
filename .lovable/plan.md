
# Přidání sledování aktuální série při pozastavení tréninku

## Problém
Při pozastavení tréninku se ukládá:
- Index aktuálního cviku (`currentExerciseIndex`)
- Dokončené série předchozích cviků (`completedSets`)

**ALE NEUKLÁDÁ SE:**
- Na které sérii v aktuálním cviku uživatel skončil
- Data (váhy, opakování) již zadaná pro aktuální cvik

Například: Pokud uživatel dokončí sérii 1 a 2 ze 4 a pak pozastaví trénink, při obnovení musí začít aktuální cvik od série 1 znovu.

---

## Řešení

### 1. Rozšířit `PausedWorkoutState` o sledování série

**Soubor: `src/hooks/usePausedWorkout.ts`**

Přidat nová pole:
```typescript
export interface PausedWorkoutState {
  // ... stávající pole ...
  currentExerciseIndex: number;
  currentSetIndex: number;  // ← NOVÉ: na které sérii v aktuálním cviku
  currentExerciseSets: { weight?: number; reps?: number; completed: boolean }[];  // ← NOVÉ: data aktuálního cviku
  completedSets: Record<string, { weight?: number; reps?: number; completed: boolean }[]>;
  // ...
}
```

### 2. Upravit `WorkoutSession` pro předávání dat aktuální série

**Soubor: `src/components/workout/WorkoutSession.tsx`**

- Přidat nový prop `initialSetIndex` a `initialCurrentExerciseSets`
- Upravit `onPause` callback aby zahrnoval i data aktuální série:

```typescript
onPause?: (
  currentExerciseIndex: number, 
  results: ExerciseResult[], 
  currentSetIndex: number,
  currentExerciseSets: SetData[]
) => void;
```

### 3. Upravit `ExercisePlayer` pro předání stavu série

**Soubor: `src/components/workout/ExercisePlayer.tsx`**

- Přidat nové props: `initialSetIndex` a `initialSetsData`
- Inicializovat `currentSet` a `setsData` z props místo z nuly

### 4. Upravit `Training.tsx` pro ukládání a obnovu série

**Soubor: `src/pages/Training.tsx`**

- Rozšířit `handlePauseFromWorkout` o přijímání `currentSetIndex` a `currentExerciseSets`
- Rozšířit resume logiku o obnovení `initialSetIndex` a `initialCurrentExerciseSets`

---

## Změny v souborech

| Soubor | Změna |
|--------|-------|
| `src/hooks/usePausedWorkout.ts` | Přidat `currentSetIndex` a `currentExerciseSets` do interface |
| `src/components/workout/ExercisePlayer.tsx` | Přidat `initialSetIndex` a `initialSetsData` props |
| `src/components/workout/WorkoutSession.tsx` | Rozšířit `onPause` callback, přidat předávání dat do ExercisePlayer |
| `src/pages/Training.tsx` | Upravit ukládání a obnovení pauzovaného tréninku |

---

## Datový tok

```text
POZASTAVENÍ:
┌──────────────────────────────────────────────────────────────┐
│  ExercisePlayer (currentSet=2, setsData=[...])              │
│       ↓                                                      │
│  WorkoutSession.onPause(exerciseIdx, results, setIdx, sets) │
│       ↓                                                      │
│  Training.handlePauseFromWorkout(...)                        │
│       ↓                                                      │
│  savePausedWorkout({                                        │
│    currentExerciseIndex: 1,                                 │
│    currentSetIndex: 2,           ← NOVÉ                     │
│    currentExerciseSets: [...],   ← NOVÉ                     │
│    completedSets: { ... },                                  │
│  })                                                          │
└──────────────────────────────────────────────────────────────┘

OBNOVENÍ:
┌──────────────────────────────────────────────────────────────┐
│  Training.tsx detekuje ?resume=true                          │
│       ↓                                                      │
│  Načte z pausedWorkout:                                     │
│    - initialExerciseIndex: 1                                 │
│    - initialSetIndex: 2          ← NOVÉ                     │
│    - initialCurrentExerciseSets  ← NOVÉ                     │
│       ↓                                                      │
│  WorkoutSession:                                             │
│    - currentExerciseIndex = 1                                │
│    - currentSetIndex = 2         ← NOVÉ                     │
│       ↓                                                      │
│  ExercisePlayer:                                             │
│    - initialSetIndex = 2         ← NOVÉ                     │
│    - initialSetsData = [...]     ← NOVÉ                     │
│       ↓                                                      │
│  Uživatel pokračuje od série 3/4                            │
└──────────────────────────────────────────────────────────────┘
```

---

## Očekávaný výsledek

1. **Přesné obnovení** - Trénink se obnoví na přesně té sérii, kde uživatel skončil
2. **Zachované váhy** - Všechny zadané váhy a opakování (i v aktuálním cviku) zůstanou zachovány
3. **Progress indikátor** - Vizuální indikátor sérií správně zobrazuje dokončené série

