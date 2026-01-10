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
export const TRAINING_ROLE_NAMES: Record<TrainingRoleId, string> = {
  horizontal_push: 'Horizontální tlak',
  horizontal_pull: 'Horizontální tah',
  vertical_push: 'Vertikální tlak',
  vertical_pull: 'Vertikální tah',
  knee_dominant: 'Dřep',
  hip_dominant: 'Hip hinge',
  single_leg_lower: 'Unilaterální nohy',
  calf_isolation: 'Lýtka',
  biceps_isolation: 'Biceps',
  triceps_isolation: 'Triceps',
  core_anti_extension: 'Core - anti-extenze',
  core_rotation: 'Core - rotace',
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
