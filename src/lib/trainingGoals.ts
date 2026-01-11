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

// Mapping from onboarding primary_goal to training_goals
export const PRIMARY_GOAL_TO_TRAINING_GOAL: Record<string, TrainingGoalId> = {
  'muscle': 'muscle_gain',
  'fat_loss': 'fat_loss',
  'tone': 'general_fitness',
  'strength': 'strength',
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
