
# Plan: Fix Onboarding Refresh + Training Issues

## Overview

This plan addresses **7 issues** reported by the user:

1. **Onboarding refresh issue** - After completing onboarding and logging in, the home page doesn't show "questionnaire completed" until manual refresh
2. **Exercise icon overflow** - Icons next to exercises in /training overflow the screen on mobile
3. **Exercise sets always 2** - All exercises generate with only 2 sets instead of at least 3
4. **Bonus workout lacks warmup** - Bonus workouts skip directly to workout session without warmup
5. **Bonus workout single exercise** - Bonus workout generates only 1 exercise instead of a reasonable amount
6. **Add pause button to warmup** - WarmupPlayer needs a pause/resume button
7. **Workout duration calculation** - Update formula to: 4 min warmup + 8 min per exercise + 3 min padding

---

## Issue 1: Onboarding Refresh Issue

### Root Cause
After login, the `AuthContext` triggers a state change but the `useUserProfile` hook may not immediately refetch the profile data. The home page shows "Dokonči svůj profil" because `profile.onboarding_completed` is still `false` from the stale cache.

### Solution
Force a profile refetch when the auth state changes to `SIGNED_IN`.

### Files to Modify
- `src/hooks/useUserProfile.ts`

### Changes
Add a listener for auth state changes to trigger refetch:

```typescript
// In useUserProfile.ts useEffect
useEffect(() => {
  fetchProfile();
  
  // Listen for auth state changes to refetch profile
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN') {
      // Small delay to ensure trigger has created/updated profile
      setTimeout(() => fetchProfile(), 500);
    }
  });
  
  return () => subscription.unsubscribe();
}, [user]);
```

---

## Issue 2: Exercise Icon Overflow in /training

### Root Cause
Looking at the uploaded screenshot and code at lines 1972-1980, the exercise list items have icons that overflow on small screens because the container doesn't constrain width properly.

### Solution
Add `overflow-hidden` to the parent container and ensure icons have `shrink-0 flex-none` classes.

### Files to Modify
- `src/pages/Training.tsx` (lines 1972-1980 and 1818-1827)

### Changes
Update the exercise list item layout:

```typescript
// Current (line 1974):
<div key={ex.id} className="flex items-center gap-3 text-sm">

// New:
<div key={ex.id} className="flex items-center gap-3 text-sm overflow-hidden max-w-full">
  <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0 flex-none">
    {idx + 1}
  </span>
  <span className="flex-1 min-w-0 truncate">{ex.exerciseName}</span>
  <span className="text-xs text-muted-foreground shrink-0 flex-none">{ex.sets}×</span>
</div>
```

Apply similar fixes to:
- Lines 1854-1860 (selected day detail exercises)
- Lines 1818-1827 (history exercises)

---

## Issue 3: Exercises Always Generate with 2 Sets

### Root Cause
The database `day_templates` has `beginner_sets: 2`, `intermediate_sets: 3`, `advanced_sets: 3-4`. The issue is that beginner users get 2 sets which is too low.

Additionally, bonus and extension workouts hardcode sets:
```typescript
// Line 1128 and 1191:
sets: profile.user_level === 'beginner' ? 2 : 3,
```

### Solution
1. Update the database `day_templates` to have minimum 3 sets for all levels
2. Update bonus/extension workout generation to use minimum 3 sets

### Database Migration
```sql
UPDATE day_templates 
SET beginner_sets = 3 
WHERE beginner_sets < 3;
```

### Files to Modify
- `src/pages/Training.tsx` (lines 1128 and 1191)

### Changes
```typescript
// Change from:
sets: profile.user_level === 'beginner' ? 2 : 3,

// To (always at least 3):
sets: profile.user_level === 'advanced' ? 4 : 3,
```

---

## Issue 4 & 5: Bonus Workout Lacks Warmup + Single Exercise

### Root Cause
The `generateBonusWorkout` function (lines 1148-1208):
1. Sets `isWorkoutActive(true)` directly, bypassing `showWorkoutPreview` and `showWarmup`
2. Uses the `count` parameter from ExtendWorkoutSelector which defaults to 2, but the user may only select 1

### Solution
1. Route bonus workouts through the same preview/warmup flow as regular workouts
2. Set minimum exercise count to 3 for bonus workouts

### Files to Modify
- `src/pages/Training.tsx` (function `generateBonusWorkout`)
- `src/components/workout/ExtendWorkoutSelector.tsx` (change minimum from 1 to 3)

### Changes

**ExtendWorkoutSelector.tsx:**
```typescript
// Change line 25:
const minCount = 1;
// To:
const minCount = 3;

// And default state (line 23):
const [count, setCount] = useState(2);
// To:
const [count, setCount] = useState(3);
```

**Training.tsx (generateBonusWorkout):**
```typescript
// After generating exercises (line 1200-1202), instead of:
setGeneratedExercises(bonusExercises);
setSelectedWorkoutGymId(profile.selected_gym_id);
setIsWorkoutActive(true);

// Change to show preview first:
setGeneratedExercises(bonusExercises);
setSelectedWorkoutGymId(profile.selected_gym_id);
setShowWorkoutPreview(true);  // This will then flow to warmup
```

---

## Issue 6: Add Pause Button to Warmup

### Root Cause
The `WarmupPlayer` component has `isPaused` state (line 38) but no UI button to toggle it.

### Solution
Add a pause/resume button to the warmup UI.

### Files to Modify
- `src/components/workout/WarmupPlayer.tsx`

### Changes
Add a toggle pause button in the action buttons section (line 244):

```typescript
// Before the "Další cvik" button:
<Button
  variant={isPaused ? "default" : "outline"}
  size="lg"
  className="flex-1 gap-2"
  onClick={() => setIsPaused(!isPaused)}
>
  {isPaused ? (
    <>
      <Play className="w-5 h-5" />
      Pokračovat
    </>
  ) : (
    <>
      <Pause className="w-5 h-5" />
      Pauza
    </>
  )}
</Button>
```

Add import for `Pause` and `Play` icons from lucide-react.

---

## Issue 7: Workout Duration Calculation

### Current Formula
```
duration = (exercises × 8) + 10 (warmup) + 5 (cooldown) = exercises × 8 + 15
```

### New Formula (per user request)
```
warmup = 4 min (dynamic, real estimate)
exercises = count × 8 min
padding = 3 min max

Target exercises = floor((userDuration - warmupEstimate + 3) / 8)

Display: warmupEstimate + (exercises × 8) min
```

### Solution
1. Calculate warmup duration dynamically (warmupExercises.length × 0.5 min = 30 sec each)
2. Update `calculateWorkoutDuration` to use 4 min warmup estimate by default
3. Update `calculateSlotsForDuration` in `useWorkoutGenerator.ts` with new formula

### Files to Modify
- `src/pages/Training.tsx` (calculateWorkoutDuration)
- `src/hooks/useWorkoutGenerator.ts` (calculateSlotsForDuration)

### Changes

**Training.tsx (calculateWorkoutDuration):**
```typescript
const calculateWorkoutDuration = (exercises: WorkoutExercise[], warmupCount: number = 4): number => {
  // Warmup: each exercise is 30 seconds = 0.5 min
  const WARMUP_MINUTES = Math.ceil(warmupCount * 0.5);
  const MINUTES_PER_EXERCISE = 8;
  
  const exerciseCount = exercises.length;
  const estimatedDuration = (exerciseCount * MINUTES_PER_EXERCISE) + WARMUP_MINUTES;
  
  return estimatedDuration;
};
```

**useWorkoutGenerator.ts (calculateSlotsForDuration):**
```typescript
const calculateSlotsForDuration = (
  durationMinutes: number,
  templateSlots: DayTemplateSlot[],
  userLevel: UserLevel
): DayTemplateSlot[] => {
  const WARMUP_MINUTES = 4;  // Updated from 10
  const PADDING_MINUTES = 3;
  const MINUTES_PER_EXERCISE = 8;
  
  // Available time for exercises = userDuration - warmup + allowed padding
  const availableMinutes = durationMinutes - WARMUP_MINUTES + PADDING_MINUTES;
  let targetExerciseCount = Math.floor(availableMinutes / MINUTES_PER_EXERCISE);
  
  // Minimum 3 exercises, maximum reasonable
  const MIN_EXERCISES = 3;
  const MAX_EXERCISES = Math.max(templateSlots.length + 4, 10);
  
  targetExerciseCount = Math.max(MIN_EXERCISES, Math.min(targetExerciseCount, MAX_EXERCISES));
  
  // ... rest of function unchanged
};
```

### Example Calculation (45 min workout):
- Available: 45 - 4 + 3 = 44 min
- Exercises: floor(44 / 8) = 5 exercises
- Display: 4 + (5 × 8) = 44 min

---

## Summary of Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useUserProfile.ts` | Add auth state listener to refetch profile on login |
| `src/pages/Training.tsx` | Fix icon overflow, update bonus workout flow, update duration calc |
| `src/components/workout/WarmupPlayer.tsx` | Add pause/resume button |
| `src/components/workout/ExtendWorkoutSelector.tsx` | Change min count from 1 to 3 |
| `src/hooks/useWorkoutGenerator.ts` | Update duration calculation formula |
| **Database migration** | Update `day_templates` beginner_sets to minimum 3 |

---

## Implementation Order

1. Database migration (update beginner_sets)
2. Fix useUserProfile refetch on auth state change
3. Fix Training.tsx icon overflow
4. Update sets minimum in Training.tsx bonus/extension generation
5. Update ExtendWorkoutSelector minimum count
6. Update bonus workout to use preview/warmup flow
7. Add pause button to WarmupPlayer
8. Update duration calculation in both files
