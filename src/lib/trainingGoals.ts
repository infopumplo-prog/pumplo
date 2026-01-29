// Training Goals v2.0.0 - cíle tréninku s dynamickým počtem dní
// Struktura dní se načítá z DB (day_templates)
// Updated with audit/snapshot interfaces

import { TrainingRoleId } from './trainingRoles';

export interface TrainingGoal {
  id: TrainingGoalId;
  name: string;
  description: string;
  dayCount: number;
}

export const TRAINING_GOAL_IDS = [
  'muscle_gain',
  'fat_loss', 
  'strength',
  'general_fitness'
] as const;

export type TrainingGoalId = typeof TRAINING_GOAL_IDS[number];

// MVP Goals for onboarding - 4 goals only (single select)
export const MVP_GOALS = [
  { 
    id: 'muscle_gain' as TrainingGoalId, 
    label: 'Nabrat svaly', 
    emoji: '💪',
    split: 'ppl',
    description: 'Délka plánu: 12 týdnů',
  },
  { 
    id: 'fat_loss' as TrainingGoalId, 
    label: 'Zhubnout', 
    emoji: '🔥',
    split: 'upper_lower',
    description: 'Délka plánu: 8 týdnů',
  },
  { 
    id: 'strength' as TrainingGoalId, 
    label: 'Získat sílu', 
    emoji: '🏋️',
    split: 'upper_lower',
    description: 'Délka plánu: 8 týdnů',
  },
  { 
    id: 'general_fitness' as TrainingGoalId, 
    label: 'Celková kondice', 
    emoji: '✨',
    split: 'full_body',
    description: 'Délka plánu: 8 týdnů',
  },
];

// Mapping goal -> default split (used when frequency not specified)
// DEPRECATED: Use getSplitByFrequency() instead for proper frequency-based logic
export const GOAL_TO_SPLIT: Record<TrainingGoalId, string> = {
  'muscle_gain': 'ppl',
  'fat_loss': 'upper_lower',
  'strength': 'upper_lower',
  'general_fitness': 'full_body',
};

// Split types
export type SplitType = 'full_body' | 'upper_lower' | 'ppl';

export const SPLIT_LABELS: Record<SplitType, string> = {
  'full_body': 'Full Body',
  'upper_lower': 'Horní / Dolní tělo',
  'ppl': 'Push / Pull / Legs',
};

/**
 * Determine workout split based on training frequency and user level
 * 
 * Rules (from methodology spec):
 * - Frequency <= 3: Full Body (FB_AB)
 * - Frequency = 4: Upper/Lower (UL_AB)
 * - Frequency >= 5: Push/Pull/Legs (PPL_ABC)
 * - Beginners with frequency >= 5 default to Upper/Lower for safety
 */
export const getSplitByFrequency = (
  frequency: number,
  userLevel: UserLevel = 'beginner'
): SplitType => {
  // Beginners with high frequency get Upper/Lower for safety
  if (userLevel === 'beginner' && frequency >= 5) {
    return 'upper_lower';
  }
  
  if (frequency <= 3) {
    return 'full_body';
  } else if (frequency === 4) {
    return 'upper_lower';
  } else {
    return 'ppl';
  }
};

// Mapping from onboarding primary_goal to training_goals
// Keep for backward compatibility, but now they're the same IDs
export const PRIMARY_GOAL_TO_TRAINING_GOAL: Record<string, TrainingGoalId> = {
  'muscle_gain': 'muscle_gain',
  'fat_loss': 'fat_loss',
  'strength': 'strength',
  'general_fitness': 'general_fitness',
  // Legacy mappings for backward compatibility
  'muscle': 'muscle_gain',
  'tone': 'general_fitness',
  'endurance': 'general_fitness',
  'consistency': 'general_fitness',
};

export type UserLevel = 'beginner' | 'intermediate' | 'advanced';

export const USER_LEVELS: { id: UserLevel; name: string; description: string }[] = [
  { id: 'beginner', name: 'Začátečník', description: 'Méně než 1 rok tréninku' },
  { id: 'intermediate', name: 'Pokročilý', description: '1-3 roky pravidelného tréninku' },
  { id: 'advanced', name: 'Expert', description: 'Více než 3 roky intenzivního tréninku' },
];

export interface DayTemplateSlot {
  id: string;
  slotOrder: number;
  roleId: string; // Can be any role from DB
  beginnerSets: number;
  intermediateSets: number;
  advancedSets: number;
  repMin: number;
  repMax: number;
}

export interface DayTemplate {
  dayLetter: string;
  dayName: string;
  slots: DayTemplateSlot[];
}

export interface WorkoutPlan {
  id: string;
  gymId: string;
  goalId: TrainingGoalId;
  isActive: boolean;
  createdAt: string;
}

export interface WorkoutExercise {
  id: string;
  dayLetter: string;
  slotOrder: number;
  roleId: string; // Can be any role from DB
  exerciseId: string | null;
  exerciseName?: string;
  equipment?: string[];
  machineName?: string | null;
  difficulty?: number;
  sets: number;
  repMin: number;
  repMax: number;
  isFallback: boolean;
  fallbackReason: string | null;
  isExtension?: boolean; // Flag for extension exercises added after workout completion
  selectionScore?: number | null; // v2.0: Score used to select this exercise
}

// ============ NEW v2.0 AUDIT INTERFACES ============

/**
 * Frozen snapshot of all inputs used to generate a plan
 * Stored in user_workout_plans.inputs_snapshot_json
 */
export interface PlanInputsSnapshot {
  goal_id: TrainingGoalId;
  user_level: UserLevel;
  duration_minutes: number;
  equipment_preference: string | null;
  injuries: string[];
  gym_id: string;
  equipment_available_snapshot: string[]; // machine_ids at time of generation
  training_days: string[];
  generated_at: string;
}

/**
 * Validation report stored with the plan
 */
export interface ValidationReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
  generated_at: string;
}

/**
 * Extended plan data with v2.0 audit fields
 */
export interface WorkoutPlanV2 extends WorkoutPlan {
  generatorVersion: string;
  methodologyVersion: string;
  selectionSeed: string | null;
  inputsSnapshot: PlanInputsSnapshot | null;
  validationReport: ValidationReport | null;
  needsRegeneration: boolean;
  startedAt: string | null;
  trainingDays: string[] | null;
}

// ============ MVP PROGRESSION MODEL ============

/**
 * RIR (Reps In Reserve) guidance by week
 * UI guidance only, not algorithm changes
 */
export const RIR_BY_WEEK: Record<number, { rir: number; label: string; description: string }> = {
  1: { rir: 3, label: 'RIR 3', description: 'Pohodlné - mohli byste udělat ještě 3 opakování' },
  2: { rir: 3, label: 'RIR 3', description: 'Pohodlné - mohli byste udělat ještě 3 opakování' },
  3: { rir: 2, label: 'RIR 2', description: 'Náročné - mohli byste udělat ještě 2 opakování' },
  4: { rir: 2, label: 'RIR 2', description: 'Náročné - mohli byste udělat ještě 2 opakování' },
  5: { rir: 1, label: 'RIR 1', description: 'Velmi těžké - mohli byste udělat ještě 1 opakování' },
  6: { rir: 1, label: 'RIR 1', description: 'Velmi těžké - mohli byste udělat ještě 1 opakování' },
  7: { rir: 3, label: 'Deload', description: 'Regenerační týden - snižte váhu o 30-40%' },
  8: { rir: 3, label: 'Deload', description: 'Regenerační týden - snižte váhu o 30-40%' },
};

export const getRIRGuidance = (weekNumber: number): { rir: number; label: string; description: string } => {
  // Cycle through 8-week blocks
  const adjustedWeek = ((weekNumber - 1) % 8) + 1;
  return RIR_BY_WEEK[adjustedWeek] || RIR_BY_WEEK[1];
};
