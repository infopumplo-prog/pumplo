// Training Roles - abstraktní vrstvy pro plánování tréninků
// Cviky se dosazují až podle fitka, ne předem

export interface TrainingRole {
  id: TrainingRoleId;
  name: string;
  category: 'upper' | 'lower' | 'core';
  description?: string;
}

export const TRAINING_ROLE_IDS = [
  'horizontal_push',
  'horizontal_pull',
  'vertical_push',
  'vertical_pull',
  'knee_dominant',
  'hip_dominant',
  'single_leg_lower',
  'calf_isolation',
  'biceps_isolation',
  'triceps_isolation',
  'core_anti_extension',
  'core_rotation'
] as const;

export type TrainingRoleId = typeof TRAINING_ROLE_IDS[number];

// Czech names for UI display (fallback if DB not loaded)
export const TRAINING_ROLE_NAMES: Record<string, string> = {
  horizontal_push: 'Tlak na prsa',
  horizontal_pull: 'Tah zad',
  vertical_push: 'Tlak nad hlavu',
  vertical_pull: 'Stahování',
  knee_dominant: 'Dřepy',
  hip_dominant: 'Mrtvý tah',
  single_leg_lower: 'Výpady',
  calf_isolation: 'Lýtka',
  biceps_isolation: 'Biceps',
  triceps_isolation: 'Triceps',
  core_anti_extension: 'Břišní svaly',
  core_rotation: 'Rotace trupu',
  chest_isolation: 'Prsa',
  back_isolation: 'Záda',
  shoulder_isolation: 'Ramena',
  glute_isolation: 'Hýždě',
  quad_isolation: 'Přední stehno',
  hamstring_isolation: 'Zadní stehno',
};

export const TRAINING_ROLE_CATEGORIES: Record<TrainingRoleId, 'upper' | 'lower' | 'core'> = {
  horizontal_push: 'upper',
  horizontal_pull: 'upper',
  vertical_push: 'upper',
  vertical_pull: 'upper',
  knee_dominant: 'lower',
  hip_dominant: 'lower',
  single_leg_lower: 'lower',
  calf_isolation: 'lower',
  biceps_isolation: 'upper',
  triceps_isolation: 'upper',
  core_anti_extension: 'core',
  core_rotation: 'core',
};
