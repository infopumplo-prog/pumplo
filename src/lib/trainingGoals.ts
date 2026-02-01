// Training Goals v2.0.0 - cíle tréninku s dynamickým počtem dní
// Struktura dní se načítá z DB (day_templates)
// Updated with audit/snapshot interfaces
// v2.1: Split is determined by FREQUENCY, not goal (per PUMPLO methodology)

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

// Split types based on training frequency
export type SplitType = 'full_body' | 'upper_lower' | 'ppl';

// Split info for UI display
export const SPLIT_INFO: Record<SplitType, { label: string; labelCz: string; days: string[] }> = {
  full_body: { label: 'Full Body A/B', labelCz: 'Full Body', days: ['A', 'B'] },
  upper_lower: { label: 'Upper/Lower A/B', labelCz: 'Horní / Dolní tělo', days: ['A', 'B'] },
  ppl: { label: 'Push/Pull/Legs A/B/C', labelCz: 'Push / Pull / Legs', days: ['A', 'B', 'C'] }
};

/**
 * Určí split na základě počtu tréninkových dnů a úrovně uživatele
 * Podle metodiky PUMPLO v1.1, sekce 3.1
 * 
 * @param frequency - počet tréninkových dnů v týdnu (1-7)
 * @param userLevel - úroveň uživatele (beginner/intermediate/advanced)
 * @returns typ splitu (full_body/upper_lower/ppl)
 */
export const getSplitFromFrequency = (
  frequency: number, 
  userLevel: UserLevel
): SplitType => {
  // Bezpečnostní override pro začátečníky - max Upper/Lower
  if (userLevel === 'beginner' && frequency >= 5) {
    return 'upper_lower';
  }
  
  // Základní pravidlo podle frekvence
  if (frequency <= 3) return 'full_body';
  if (frequency === 4) return 'upper_lower';
  return 'ppl'; // frequency >= 5
};

// MVP Goals for onboarding - 4 goals only (single select)
// Goals affect rep ranges and exercise selection, NOT the split
// Split is determined by training frequency (getSplitFromFrequency)
// Plan duration: 12 weeks for ALL goals (per methodology section 10)
export const MVP_GOALS = [
  { 
    id: 'muscle_gain' as TrainingGoalId, 
    label: 'Nabrat svaly', 
    emoji: '💪',
    description: 'Hypertrofie - více objemu',
  },
  { 
    id: 'fat_loss' as TrainingGoalId, 
    label: 'Zhubnout', 
    emoji: '🔥',
    description: 'Spalování tuků + udržení svalů',
  },
  { 
    id: 'strength' as TrainingGoalId, 
    label: 'Získat sílu', 
    emoji: '🏋️',
    description: 'Nižší opakování, vyšší váhy',
  },
  { 
    id: 'general_fitness' as TrainingGoalId, 
    label: 'Celková kondice', 
    emoji: '✨',
    description: 'Vyvážený trénink celého těla',
  },
];

// Standard plan duration for all goals (weeks)
export const PLAN_DURATION_WEEKS = 12;

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
  split_type: SplitType;
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
