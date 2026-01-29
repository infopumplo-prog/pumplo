// Onboarding Types - shared types for pre-registration onboarding flow

import { TrainingGoalId, UserLevel } from './trainingGoals';

export interface OnboardingData {
  // Step 0: Goal
  primaryGoal: TrainingGoalId | null;
  // Step 1: Level
  userLevel: UserLevel | null;
  // Step 2: Training Days
  trainingDays: string[];
  // Step 3: Time & Duration
  preferredTime: string | null;
  trainingDuration: number;
  // Step 4: Demographics
  gender: string | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  // Step 5: Injuries
  injuries: string[];
  // Step 6: Equipment
  equipmentPreference: string | null;
}

export const INITIAL_ONBOARDING_DATA: OnboardingData = {
  primaryGoal: null,
  userLevel: null,
  trainingDays: [],
  preferredTime: null,
  trainingDuration: 45,
  gender: null,
  age: null,
  heightCm: null,
  weightKg: null,
  injuries: [],
  equipmentPreference: null,
};

export const DAYS = [
  { id: 'monday', label: 'Pondělí' },
  { id: 'tuesday', label: 'Úterý' },
  { id: 'wednesday', label: 'Středa' },
  { id: 'thursday', label: 'Čtvrtek' },
  { id: 'friday', label: 'Pátek' },
  { id: 'saturday', label: 'Sobota' },
  { id: 'sunday', label: 'Neděle' },
];

export const TIMES = [
  { id: 'morning', label: 'Ráno', time: '6:00 - 10:00', emoji: '🌅' },
  { id: 'late_morning', label: 'Dopoledne', time: '10:00 - 14:00', emoji: '☀️' },
  { id: 'afternoon', label: 'Odpoledne', time: '14:00 - 18:00', emoji: '🌤️' },
  { id: 'evening', label: 'Večer', time: '18:00 - 22:00', emoji: '🌙' },
];

export const INJURIES_LIST = [
  { id: 'neck', label: 'Krk' },
  { id: 'upper_back', label: 'Horní záda' },
  { id: 'lower_back', label: 'Bedra' },
  { id: 'shoulders', label: 'Ramena' },
  { id: 'elbows', label: 'Lokty' },
  { id: 'wrists', label: 'Zápěstí' },
  { id: 'hips', label: 'Kyčle' },
  { id: 'knees', label: 'Kolena' },
  { id: 'ankles', label: 'Kotníky' },
  { id: 'none', label: 'Nemám žádné' },
];

export const EQUIPMENT_OPTIONS = [
  { id: 'machines', label: 'Hlavně stroje', description: 'Káblové a hydraulické stroje' },
  { id: 'free_weights', label: 'Volné váhy', description: 'Činky, kettlebelly, olympijské tyče' },
  { id: 'bodyweight', label: 'Vlastní váha', description: 'Cviky bez vybavení' },
  { id: 'no_preference', label: 'Bez preference', description: 'Kombinace všeho' },
];

export const USER_LEVEL_OPTIONS = [
  { id: 'beginner' as UserLevel, label: 'Začátečník', description: 'Méně než 1 rok tréninku', emoji: '🌱' },
  { id: 'intermediate' as UserLevel, label: 'Pokročilý', description: '1-3 roky pravidelného tréninku', emoji: '💪' },
  { id: 'advanced' as UserLevel, label: 'Expert', description: 'Více než 3 roky intenzivního tréninku', emoji: '🔥' },
];

export const ONBOARDING_TOTAL_STEPS = 7; // 0-6 questions, step 7 is registration
