// Training Goals - cíle tréninku s dynamickým počtem dní
// Struktura dní se načítá z DB (day_templates)

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

// Mapping goal -> split (automatic determination)
export const GOAL_TO_SPLIT: Record<TrainingGoalId, string> = {
  'muscle_gain': 'ppl',
  'fat_loss': 'upper_lower',
  'strength': 'upper_lower',
  'general_fitness': 'full_body',
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
}
