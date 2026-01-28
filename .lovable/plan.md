
# PUMPLO Training System Refactor - Complete Implementation Plan

## Overview
This plan addresses all 11 specification prompts for a comprehensive refactor of the PUMPLO workout generation system. The changes ensure proper methodology compliance, safety, auditability, and reproducibility.

---

## Phase 1: Database Schema Changes

### 1.1 Add columns to `exercises` table
- `banned_injuries TEXT[] DEFAULT '{}'` - injuries that contraindicate this exercise (e.g., shoulder, lower_back, knees)
- `slot_type TEXT DEFAULT 'main'` - which slot types this exercise fits (main/secondary/accessory/core)
- `is_compound BOOLEAN DEFAULT false` - differentiates compound vs isolation movements
- `stability_rating INTEGER DEFAULT 5` - 1-10 safety/stability score for beginner filtering

### 1.2 Add columns to `user_workout_plans` table
- `generator_version TEXT DEFAULT '2.0.0'` - version of the generator algorithm
- `methodology_version TEXT DEFAULT '2.0.0'` - methodology spec version
- `selection_seed TEXT` - random seed for reproducible selection
- `inputs_snapshot_json JSONB` - frozen generation inputs (goal, level, duration, injuries, equipment, gym snapshot)
- `validation_report_json JSONB` - pass/fail status with reasons
- `needs_regeneration BOOLEAN DEFAULT false` - flag when gym equipment changes invalidate plan

### 1.3 Add columns to `user_workout_exercises` table
- `selection_score NUMERIC` - the scoring value used to select this exercise

### 1.4 Add columns to `training_roles` table
- `allowed_equipment_categories TEXT[] DEFAULT '{}'` - equipment types valid for this role
- `banned_injury_tags TEXT[] DEFAULT '{}'` - injuries that contraindicate this role
- `difficulty_level TEXT DEFAULT 'all'` - beginner_safe/intermediate/advanced/all
- `has_bodyweight_variant BOOLEAN DEFAULT true` - whether bodyweight fallback exists
- `phase_type TEXT DEFAULT 'main'` - main/secondary/accessory/core

### 1.5 Create new `role_aliases` table
Stores movement-pattern substitutions for fallback:
```
id TEXT PRIMARY KEY
alias_for TEXT REFERENCES training_roles(id)
priority INTEGER DEFAULT 1
```
Examples: `push_general` -> alias for `horizontal_push`, `vertical_push`

### 1.6 Create new `user_exercise_history` table
Tracks recent exercise usage for anti-repetition logic:
```
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id UUID NOT NULL
exercise_id UUID
role_id TEXT
used_at TIMESTAMP DEFAULT now()
plan_id UUID
day_letter TEXT
```
With RLS: users can only view/insert their own history.

### 1.7 Fix `role_muscles` mappings
**Corrections needed:**
- `horizontal_push`: Remove rhomboids from secondary (they are NOT trained by push movements)
- `squat`: Remove `back_thighs` from secondary (hamstrings are not a hypertrophy target in squats)
- `hinge`: Ensure `back_thighs`, `glutes` are PRIMARY, add `core_stabilizers` as secondary

**New roles to add to `training_roles` and `role_muscles`:**
- `rear_delt_isolation` (primary: rear_shoulders; secondary: middle_back)
- `upper_back_isolation` / `scapular_retraction` (primary: rhomboids, middle_trapezius)
- `external_rotation` (primary: rotator_cuff / infraspinatus)
- `anti_lateral_flexion` (primary: obliques, core_stabilizers)

---

## Phase 2: Algorithm Refactor (`useWorkoutGenerator.ts`)

### 2.1 New Types and Interfaces

```typescript
interface ExerciseCandidate {
  exercise: Exercise;
  scores: {
    roleMatch: number;      // +100 if exact role match
    muscleScore: number;    // Primary: +3, Secondary: +0.5
    equipmentBonus: number; // +5 if matches preference
    difficultyBonus: number;// +3 for beginner-friendly
    repetitionPenalty: number; // -10 to -30 based on recent usage
    injuryPenalty: number;  // -999 if contraindicated
    varietyBonus: number;   // +2 for equipment variety
  };
  totalScore: number;
}

interface SelectionContext {
  gymId: string;
  userLevel: UserLevel;
  injuries: string[];
  equipmentPreference: string | null;
  equipmentAvailable: Set<string>;
  machineIdsAvailable: Set<string>;
  coveredMusclesSession: Set<string>;
  usedExerciseIdsToday: string[];
  recentExerciseHistory: Map<string, Date[]>; // role -> dates
  pushPullBalance: { push: number; pull: number };
  slotType: 'main' | 'secondary' | 'accessory' | 'core';
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
```

### 2.2 Remove Unsafe Logic
- **Remove** hard-coded beginner equipment restriction (`['machine', 'cable', 'bodyweight']`)
- **Remove** Fallback 1 that ignores equipment availability
- **Remove** Fallback 2 that selects based on secondary_muscles matching

### 2.3 Implement New Equipment Logic
- `equipmentAvailable` from `gym_machines` is a **HARD filter** (never select unavailable equipment)
- `equipmentPreference` is a **SOFT scoring factor** (+5 bonus)
- Exception: `preference === 'bodyweight'` becomes a hard filter

### 2.4 Implement Injury Filtering
```typescript
const isContraindicated = (exercise: Exercise, injuries: string[]): boolean => {
  const bannedInjuries = exercise.banned_injuries || [];
  return injuries.some(injury => bannedInjuries.includes(injury));
};
```
- Contraindicated exercises get `injuryPenalty = -999` (effectively excluded)

### 2.5 Implement Anti-Repetition Window
```typescript
const getRepetitionPenalty = (
  exerciseId: string,
  roleId: string,
  history: Map<string, Date[]>
): number => {
  const roleHistory = history.get(roleId) || [];
  const recentDays = roleHistory.filter(d => 
    (Date.now() - d.getTime()) < 7 * 24 * 60 * 60 * 1000
  );
  
  if (recentDays.length >= 3) return -30; // Used 3+ times in 7 days
  if (recentDays.length >= 2) return -20;
  if (recentDays.length >= 1) return -10;
  return 0;
};
```

### 2.6 Implement New Scoring System
```typescript
const calculateExerciseScore = (
  exercise: Exercise,
  context: SelectionContext,
  targetMuscles: TargetMuscles,
  history: Map<string, Date[]>
): ExerciseCandidate => {
  const scores = {
    roleMatch: 100, // Always start with role match (pre-filtered)
    muscleScore: calculateMuscleScore(exercise, context.coveredMusclesSession, targetMuscles),
    equipmentBonus: matchesEquipmentPreference(exercise, context.equipmentPreference) ? 5 : 0,
    difficultyBonus: context.userLevel === 'beginner' && exercise.difficulty <= 3 ? 3 : 0,
    repetitionPenalty: getRepetitionPenalty(exercise.id, exercise.primary_role, history),
    injuryPenalty: isContraindicated(exercise, context.injuries) ? -999 : 0,
    varietyBonus: getVarietyBonus(exercise, context),
  };
  
  return {
    exercise,
    scores,
    totalScore: Object.values(scores).reduce((a, b) => a + b, 0)
  };
};

// Updated muscle scoring with correct weights
const calculateMuscleScore = (exercise, covered, target): number => {
  let score = 0;
  for (const muscle of exercise.primary_muscles || []) {
    if (target.primary.includes(muscle) && !covered.has(muscle)) {
      score += 3; // Primary: +3 (was +2)
    }
  }
  for (const muscle of exercise.secondary_muscles || []) {
    if (!covered.has(muscle)) {
      score += 0.5; // Secondary: +0.5 (was +1)
    }
  }
  return score;
};
```

### 2.7 Implement Safe Fallback Hierarchy
```typescript
const selectExerciseWithFallbacks = async (
  role: string,
  context: SelectionContext
): Promise<AssignedExercise> => {
  // F0: Normal selection
  let candidates = await getCandidates(role, context, { 
    strictEquipment: true, 
    strictInjuries: true,
    checkRepetition: true 
  });
  
  if (candidates.length > 0) {
    return selectFromTop(candidates, 5);
  }
  
  // F1: Relax anti-repetition ONLY
  candidates = await getCandidates(role, context, {
    strictEquipment: true,
    strictInjuries: true,
    checkRepetition: false // Allow repeats with penalty
  });
  
  if (candidates.length > 0) {
    return selectFromTop(candidates, 3, 'repetition_relaxed');
  }
  
  // F2: Expand equipment within available (different types, same gym)
  candidates = await getCandidates(role, context, {
    strictEquipment: true, // Still gym-available only!
    expandEquipmentTypes: true, // Ignore preference
    strictInjuries: true,
    checkRepetition: false
  });
  
  if (candidates.length > 0) {
    return selectFromTop(candidates, 3, 'equipment_expanded');
  }
  
  // F3: Role alias substitution
  const aliases = await getRoleAliases(role);
  for (const alias of aliases) {
    candidates = await getCandidates(alias.id, context, {
      strictEquipment: true,
      strictInjuries: true,
      checkRepetition: false
    });
    if (candidates.length > 0) {
      return selectFromTop(candidates, 3, `role_alias:${alias.id}`);
    }
  }
  
  // F4: Bodyweight fallback (only if role has valid bodyweight variant)
  const roleInfo = await getRoleInfo(role);
  if (roleInfo.has_bodyweight_variant) {
    candidates = await getCandidates(role, context, {
      bodyweightOnly: true,
      strictInjuries: true
    });
    if (candidates.length > 0) {
      return selectFromTop(candidates, 3, 'bodyweight');
    }
  }
  
  // F5: Skip slot (validate minimum structure)
  return { exercise: null, isFallback: true, fallbackReason: 'skipped' };
};
```

### 2.8 Implement Duplicate-Role Variation
When the same role appears multiple times in a day:
```typescript
const handleDuplicateRole = (
  role: string,
  occurrence: number,
  candidates: ExerciseCandidate[]
): ExerciseCandidate[] => {
  if (occurrence === 1) {
    // First occurrence: prefer compound/primary pattern
    return candidates.filter(c => c.exercise.is_compound);
  } else {
    // Second occurrence: prefer accessory/isolation, or different equipment
    return candidates.filter(c => !c.exercise.is_compound);
  }
};
```

---

## Phase 3: Plan Validation and Transactions

### 3.1 Create Database Function for Atomic Operations
```sql
CREATE OR REPLACE FUNCTION generate_workout_plan_atomic(
  p_user_id UUID,
  p_gym_id UUID,
  p_goal_id TEXT,
  p_exercises JSONB,
  p_inputs_snapshot JSONB,
  p_training_days TEXT[],
  p_generator_version TEXT,
  p_methodology_version TEXT,
  p_selection_seed TEXT
) RETURNS UUID AS $$
DECLARE
  v_plan_id UUID;
BEGIN
  -- Deactivate existing plans
  UPDATE user_workout_plans 
  SET is_active = false 
  WHERE user_id = p_user_id AND is_active = true;
  
  -- Create new plan with snapshot
  INSERT INTO user_workout_plans (
    user_id, gym_id, goal_id, is_active, 
    training_days, generator_version, methodology_version,
    selection_seed, inputs_snapshot_json
  ) VALUES (
    p_user_id, p_gym_id, p_goal_id, true,
    p_training_days, p_generator_version, p_methodology_version,
    p_selection_seed, p_inputs_snapshot
  ) RETURNING id INTO v_plan_id;
  
  -- Insert exercises from JSONB array
  INSERT INTO user_workout_exercises (
    plan_id, day_letter, slot_order, role_id, 
    exercise_id, sets, rep_min, rep_max,
    is_fallback, fallback_reason, selection_score
  )
  SELECT 
    v_plan_id,
    (ex->>'day_letter')::TEXT,
    (ex->>'slot_order')::INTEGER,
    (ex->>'role_id')::TEXT,
    (ex->>'exercise_id')::UUID,
    (ex->>'sets')::INTEGER,
    (ex->>'rep_min')::INTEGER,
    (ex->>'rep_max')::INTEGER,
    (ex->>'is_fallback')::BOOLEAN,
    (ex->>'fallback_reason')::TEXT,
    (ex->>'selection_score')::NUMERIC
  FROM jsonb_array_elements(p_exercises) AS ex;
  
  RETURN v_plan_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3.2 Implement Pre-Commit Validation
```typescript
const validatePlan = (
  exerciseInserts: ExerciseInsert[],
  context: SelectionContext,
  templates: DayTemplate[]
): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  for (const day of templates) {
    const dayExercises = exerciseInserts.filter(e => e.day_letter === day.dayLetter);
    
    // Check minimum count
    if (dayExercises.length < 3) {
      errors.push(`Day ${day.dayLetter}: Less than 3 exercises`);
    }
    
    // Check equipment compatibility
    for (const ex of dayExercises) {
      if (ex.machine_id && !context.machineIdsAvailable.has(ex.machine_id)) {
        errors.push(`Day ${day.dayLetter}: Exercise uses unavailable machine`);
      }
    }
    
    // Upper day: must have push + pull
    const isUpperDay = day.dayName.toLowerCase().includes('upper') || 
                       day.dayName.toLowerCase().includes('push') ||
                       day.dayName.toLowerCase().includes('pull');
    if (isUpperDay) {
      const hasPush = dayExercises.some(e => e.role_id.includes('push'));
      const hasPull = dayExercises.some(e => e.role_id.includes('pull'));
      if (!hasPush || !hasPull) {
        errors.push(`Day ${day.dayLetter}: Upper day must have push + pull`);
      }
    }
    
    // Lower day: must have squat/hinge
    const isLowerDay = day.dayName.toLowerCase().includes('lower') ||
                       day.dayName.toLowerCase().includes('leg');
    if (isLowerDay) {
      const hasSquatOrHinge = dayExercises.some(e => 
        e.role_id === 'squat' || e.role_id === 'hinge' || e.role_id === 'lunge'
      );
      if (!hasSquatOrHinge) {
        errors.push(`Day ${day.dayLetter}: Lower day must have squat/hinge/lunge`);
      }
    }
    
    // Core check (if duration >= 30min)
    if (context.durationMinutes >= 30) {
      const hasCore = dayExercises.some(e => e.role_id.includes('anti_') || e.role_id.includes('rotation'));
      if (!hasCore) {
        warnings.push(`Day ${day.dayLetter}: No core exercise for ${context.durationMinutes}min session`);
      }
    }
  }
  
  return { valid: errors.length === 0, errors, warnings };
};
```

---

## Phase 4: TypeScript Type Updates

### 4.1 Update `src/lib/trainingRoles.ts`
Add new roles to the type definitions:
```typescript
export const TRAINING_ROLE_IDS = [
  // Existing...
  'horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull',
  'knee_dominant', 'hip_dominant', 'single_leg_lower', 'calf_isolation',
  'biceps_isolation', 'triceps_isolation', 'core_anti_extension', 'core_rotation',
  // New for shoulder health
  'rear_delt_isolation', 'upper_back_isolation', 'external_rotation',
  // New core
  'anti_lateral_flexion',
] as const;

// Role aliases for fallback substitution
export const ROLE_ALIASES: Record<string, string[]> = {
  'horizontal_push': ['push_general', 'chest_press_variant'],
  'vertical_pull': ['pulldown_variant', 'pullup_variant'],
  'squat': ['squat_light', 'lunge'],
  'hinge': ['hip_hinge_light', 'glute_bridge'],
  'knee_extension': ['squat_light', 'lunge'],
};
```

### 4.2 Update `src/lib/trainingGoals.ts`
Add new interfaces for audit/snapshot:
```typescript
export interface PlanInputsSnapshot {
  goal_id: TrainingGoalId;
  user_level: UserLevel;
  duration_minutes: number;
  equipment_preference: string | null;
  injuries: string[];
  gym_id: string;
  equipment_available_snapshot: string[]; // machine_ids or equipment_types
  training_days: string[];
}

export interface ValidationReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
  generated_at: string;
}
```

---

## Phase 5: Plan Stability Implementation

### 5.1 Update `useWorkoutPlan.ts`
Ensure exercises are ONLY read from database, never regenerated on refresh:
- Remove any random selection on load
- Add `needs_regeneration` flag check and UI warning

### 5.2 Gym Equipment Change Detection
Create a function to detect when gym equipment changes invalidate a plan:
```typescript
const checkPlanEquipmentValidity = async (planId: string): Promise<boolean> => {
  // Compare current gym_machines with plan's equipment_available_snapshot
  // If any exercise's machine_id is no longer available, return false
};
```

---

## Phase 6: Progression Model (MVP)

### 6.1 Implement Simple Load Progression
For MVP, use RIR (Reps In Reserve) guidance:
- Weeks 1-2: RIR 3 (comfortable)
- Weeks 3-4: RIR 2 (challenging)
- Week 5+: RIR 1 or deload

This is UI guidance only, not algorithm changes.

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/hooks/useWorkoutGenerator.ts` | **Major Refactor** | New scoring, fallbacks, validation |
| `src/lib/trainingRoles.ts` | **Modify** | Add new role IDs, aliases, metadata types |
| `src/lib/trainingGoals.ts` | **Modify** | Add snapshot/validation interfaces |
| `src/hooks/useWorkoutPlan.ts` | **Modify** | Add needs_regeneration check |
| `src/lib/selectionAlgorithm.ts` | **Create** | Extract selection logic for testability |
| `src/lib/planValidation.ts` | **Create** | Validation rules for plan structure |
| Database migrations | **Create** | All schema changes above |

---

## Testing Checklist

1. **Injury filtering**: Generate plan with injuries, verify contraindicated exercises excluded
2. **Equipment hard filter**: Verify no exercise with unavailable machine_id selected
3. **Duplicate role variation**: Same role twice in a day gets compound first, isolation second
4. **Anti-repetition**: Same exercise not selected for same role within 7 days (unless pool empty)
5. **Fallback safety**: All fallbacks respect equipment availability
6. **Plan snapshot**: Profile changes don't affect existing plan
7. **Validation**: Upper day has push+pull, lower day has squat/hinge
8. **Reproducibility**: Same seed produces same plan

---

## Technical Notes for University Review

- Generator version: `2.0.0`
- Methodology version: `2.0.0`
- All generation inputs are frozen in `inputs_snapshot_json`
- Selection scores are stored per-exercise for auditability
- Validation reports stored with pass/fail and reasons
- Plans are immutable after creation unless manually regenerated
