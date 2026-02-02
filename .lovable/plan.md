
# Sledování aktuální série při pozastavení tréninku - IMPLEMENTOVÁNO ✅

## Implementované změny

### 1. `src/hooks/usePausedWorkout.ts`
- Přidána nová pole do `PausedWorkoutState`:
  - `currentSetIndex: number` - na které sérii v aktuálním cviku
  - `currentExerciseSets: { weight?: number; reps?: number; completed: boolean }[]` - data aktuálního cviku

### 2. `src/components/workout/ExercisePlayer.tsx`
- Přidány nové props:
  - `initialSetIndex?: number` - počáteční index série
  - `initialSetsData?: SetData[]` - počáteční data sérií
  - `onSetChange?: (currentSetIndex: number, setsData: SetData[]) => void` - callback při změně série
- Inicializace `currentSet` a `setsData` z props
- Volání `onSetChange` při dokončení série a po odpočinku

### 3. `src/components/workout/WorkoutSession.tsx`
- Rozšířen interface `WorkoutSessionProps`:
  - `initialSetIndex?: number`
  - `initialCurrentExerciseSets?: SetData[]`
  - `onPause` callback rozšířen o 4 parametry
- Přidány nové state proměnné pro tracking série
- `ExercisePlayerWithVideo` předává nové props do `ExercisePlayer`

### 4. `src/pages/Training.tsx`
- Přidány nové state proměnné:
  - `initialSetIndex`
  - `initialCurrentExerciseSets`
- `handlePauseFromWorkout` přijímá a ukládá data série
- Resume logika obnovuje `initialSetIndex` a `initialCurrentExerciseSets`
- `WorkoutSession` dostává nové props

---

## Datový tok

```text
POZASTAVENÍ:
┌──────────────────────────────────────────────────────────────┐
│  ExercisePlayer (currentSet=2, setsData=[...])              │
│       ↓ onSetChange(setIdx, sets)                           │
│  WorkoutSession (trackuje currentSetIndex, currentExerciseSets)
│       ↓ onPause(exerciseIdx, results, setIdx, sets)         │
│  Training.handlePauseFromWorkout(...)                        │
│       ↓                                                      │
│  savePausedWorkout({                                        │
│    currentExerciseIndex: 1,                                 │
│    currentSetIndex: 2,           ✅                          │
│    currentExerciseSets: [...],   ✅                          │
│    completedSets: { ... },                                  │
│  })                                                          │
└──────────────────────────────────────────────────────────────┘

OBNOVENÍ:
┌──────────────────────────────────────────────────────────────┐
│  Training.tsx detekuje ?resume=true                          │
│       ↓                                                      │
│  Načte z pausedWorkout:                                     │
│    - initialExerciseIndex: 1                                 │
│    - initialSetIndex: 2          ✅                          │
│    - initialCurrentExerciseSets  ✅                          │
│       ↓                                                      │
│  WorkoutSession:                                             │
│    - initialSetIndex = 2                                     │
│    - initialCurrentExerciseSets = [...]                     │
│       ↓                                                      │
│  ExercisePlayer:                                             │
│    - initialSetIndex = 2                                     │
│    - initialSetsData = [...]                                │
│       ↓                                                      │
│  Uživatel pokračuje od série 3/4                            │
└──────────────────────────────────────────────────────────────┘
```
