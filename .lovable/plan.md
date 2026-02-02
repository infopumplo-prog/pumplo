

# Oprava obnovení pozastaveného tréninku

## Problém
Když klikneš na "Pokračovat v tréninku", trénink se spustí od začátku místo od místa, kde jsi přestal. Důvod:

1. V `Home.tsx` se při kliknutí na "Pokračovat" **okamžitě vymaže** uložený stav (`clearPausedWorkout()`)
2. Teprve pak se naviguje na `/training?start=true`
3. Training.tsx už nemá přístup k uloženým datům → spustí trénink od nuly

## Řešení

### Změny v souborech

| Soubor | Změna |
|--------|-------|
| `src/pages/Home.tsx` | Nemazat `pausedWorkout` při kliknutí, navigovat na `/training?resume=true` |
| `src/pages/Training.tsx` | Přidat logiku pro detekci `?resume=true` a obnovení ze stavu |
| `src/components/workout/WorkoutSession.tsx` | Přidat props pro počáteční index a výsledky |
| `src/components/workout/WarmupPlayer.tsx` | Přidat props pro počáteční index |

---

## Technické detaily

### 1. Home.tsx - Nemazat stav předčasně (řádky 389-392)

**Aktuální kód:**
```jsx
onResume={() => {
  clearPausedWorkout();  // ❌ Maže data PŘED navigací
  navigate('/training?start=true');
}}
```

**Nový kód:**
```jsx
onResume={() => {
  navigate('/training?resume=true');  // ✅ Naviguje bez mazání
}}
```

### 2. Training.tsx - Přidat resume logiku

Přidat nový `useEffect` pro detekci `?resume=true`:

```jsx
// Auto-resume paused workout
useEffect(() => {
  const shouldResume = searchParams.get('resume') === 'true';
  
  if (shouldResume && pausedWorkout && !autoStartTriggered) {
    setAutoStartTriggered(true);
    searchParams.delete('resume');
    setSearchParams(searchParams, { replace: true });
    
    // Restore exercises from paused state
    setGeneratedExercises(pausedWorkout.exercises);
    setWarmupExercises(pausedWorkout.warmupExercises || []);
    setSelectedWorkoutGymId(pausedWorkout.gymId);
    
    if (pausedWorkout.isInWarmup) {
      // Resume in warmup
      setShowWarmup(true);
      setInitialWarmupIndex(pausedWorkout.warmupIndex || 0);
    } else {
      // Resume in main workout
      setIsWorkoutActive(true);
      setInitialExerciseIndex(pausedWorkout.currentExerciseIndex);
      setInitialResults(pausedWorkout.completedSets);
    }
  }
}, [searchParams, pausedWorkout, autoStartTriggered]);
```

### 3. WorkoutSession.tsx - Přijímat počáteční stav

Přidat nové props:
```tsx
interface WorkoutSessionProps {
  exercises: WorkoutExercise[];
  // ... existing props ...
  initialExerciseIndex?: number;  // ← NOVÉ
  initialResults?: ExerciseResult[];  // ← NOVÉ
}
```

Inicializovat state z props:
```tsx
const [currentExerciseIndex, setCurrentExerciseIndex] = useState(initialExerciseIndex || 0);
const [results, setResults] = useState<ExerciseResult[]>(initialResults || []);
```

### 4. WarmupPlayer.tsx - Přijímat počáteční index

Přidat nové props:
```tsx
interface WarmupPlayerProps {
  exercises: WarmupExercise[];
  // ... existing props ...
  initialIndex?: number;  // ← NOVÉ
}
```

Inicializovat state z props:
```tsx
const [currentIndex, setCurrentIndex] = useState(initialIndex || 0);
```

### 5. Kdy mazat pausedWorkout

Vymazat až při:
- **Dokončení tréninku** → v `handleWorkoutComplete`
- **Ukončení tréninku** (ne pozastavení) → v `onCancel` callback

---

## UI Flow po opravě

```text
POZASTAVENÍ:
┌──────────────────────────────────────────────────────────────┐
│  Trénink → [X] → Dialog "Pozastavit / Ukončit"              │
│                    ↓                                         │
│             [Pozastavit] → Uloží stav do localStorage        │
│                    ↓                                         │
│             Navigace na Home                                 │
└──────────────────────────────────────────────────────────────┘

OBNOVENÍ:
┌──────────────────────────────────────────────────────────────┐
│  Home → PausedWorkoutCard → [Pokračovat]                     │
│                    ↓                                         │
│  navigate('/training?resume=true')  (BEZ mazání stavu)       │
│                    ↓                                         │
│  Training.tsx detekuje ?resume=true                          │
│                    ↓                                         │
│  Načte data z pausedWorkout:                                 │
│    - exercises, warmupExercises                              │
│    - currentExerciseIndex                                    │
│    - completedSets (váhy, opakování)                        │
│    - isInWarmup (zda byl v rozcvičce)                       │
│                    ↓                                         │
│  Otevře správnou obrazovku na správném místě                │
└──────────────────────────────────────────────────────────────┘
```

---

## Očekávaný výsledek

1. **Správné místo** - Trénink se obnoví přesně tam, kde uživatel přestal (warmup nebo hlavní cvik)
2. **Zachované data** - Všechny zadané váhy, opakování a dokončené série zůstanou zachovány
3. **Správný progress** - Progress bar ukazuje skutečný stav, ne 0%

