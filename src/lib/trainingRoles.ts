// Training Roles v2.0.0 - abstraktní vrstvy pro plánování tréninků
// Cviky se dosazují až podle fitka, ne předem

export interface TrainingRole {
  id: TrainingRoleId;
  name: string;
  category: 'upper' | 'lower' | 'core' | 'cardio' | 'compound';
  description?: string;
  // New v2.0 fields
  allowed_equipment_categories?: string[];
  banned_injury_tags?: string[];
  difficulty_level?: 'beginner_safe' | 'intermediate' | 'advanced' | 'all';
  has_bodyweight_variant?: boolean;
  phase_type?: 'main' | 'secondary' | 'accessory' | 'core';
}

export const TRAINING_ROLE_IDS = [
  'horizontal_push',
  'horizontal_pull',
  'vertical_push',
  'vertical_pull',
  'squat',
  'hinge',
  'lunge',
  'step',
  'jump',
  'elbow_flexion',
  'elbow_extension',
  'shoulder_abduction',
  'shoulder_adduction',
  'shoulder_external_rotation',
  'shoulder_internal_rotation',
  'anti_extension',
  'anti_flexion',
  'anti_rotation',
  'rotation',
  'lateral_flexion',
  'cyclical_push',
  'cyclical_pull',
  'full_body_pull',
  // New roles for v2.0
  'rear_delt_isolation',
  'upper_back_isolation',
  'anti_lateral_flexion',
  // Legacy aliases for compatibility
  'core_anti_extension',
  'core_rotation',
  'knee_dominant',
  'hip_dominant',
  'single_leg_lower',
  'calf_isolation',
  'biceps_isolation',
  'triceps_isolation',
] as const;

export type TrainingRoleId = typeof TRAINING_ROLE_IDS[number];

// Role aliases for fallback substitution
// Maps a general/alias role to specific roles it can substitute
export const ROLE_ALIASES: Record<string, string[]> = {
  'push_general': ['horizontal_push', 'vertical_push'],
  'pull_general': ['horizontal_pull', 'vertical_pull'],
  'chest_press_variant': ['horizontal_push'],
  'pulldown_variant': ['vertical_pull'],
  'pullup_variant': ['vertical_pull'],
  'squat_light': ['squat', 'lunge'],
  'lunge_alias': ['lunge', 'step'],
  'hip_hinge_light': ['hinge'],
  'glute_bridge': ['hinge'],
  // Legacy mappings
  'knee_dominant': ['squat', 'lunge'],
  'hip_dominant': ['hinge'],
  'single_leg_lower': ['lunge', 'step'],
  'core_anti_extension': ['anti_extension'],
  'core_rotation': ['rotation'],
  'calf_isolation': ['step'],
  'biceps_isolation': ['elbow_flexion'],
  'triceps_isolation': ['elbow_extension'],
};

// Resolve role to its canonical form
export const resolveRoleAlias = (roleId: string): string => {
  for (const [alias, targets] of Object.entries(ROLE_ALIASES)) {
    if (targets.includes(roleId)) {
      return roleId; // Already a target, return as-is
    }
    if (alias === roleId && targets.length > 0) {
      return targets[0]; // Return first target as canonical
    }
  }
  return roleId;
};

// Czech names for UI display (fallback if DB not loaded)
export const TRAINING_ROLE_NAMES: Record<string, string> = {
  horizontal_push: 'Tlak na prsa',
  horizontal_pull: 'Tah zad',
  vertical_push: 'Tlak nad hlavu',
  vertical_pull: 'Stahování',
  squat: 'Dřepy',
  hinge: 'Mrtvý tah',
  lunge: 'Výpady',
  step: 'Krok',
  jump: 'Skok',
  elbow_flexion: 'Biceps',
  elbow_extension: 'Triceps',
  shoulder_abduction: 'Abdukce ramena',
  shoulder_adduction: 'Addukce ramena',
  shoulder_external_rotation: 'Zevní rotace ramena',
  shoulder_internal_rotation: 'Vnitřní rotace ramena',
  anti_extension: 'Anti-extenze',
  anti_flexion: 'Anti-flexe',
  anti_rotation: 'Anti-rotace',
  rotation: 'Rotace trupu',
  lateral_flexion: 'Laterální flexe',
  cyclical_push: 'Cyklický tlak',
  cyclical_pull: 'Cyklický tah',
  full_body_pull: 'Celotělový tah',
  rear_delt_isolation: 'Zadní ramena',
  upper_back_isolation: 'Horní záda',
  anti_lateral_flexion: 'Boční stabilizace',
  // Legacy
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

export const TRAINING_ROLE_CATEGORIES: Record<string, 'upper' | 'lower' | 'core' | 'cardio' | 'compound'> = {
  horizontal_push: 'upper',
  horizontal_pull: 'upper',
  vertical_push: 'upper',
  vertical_pull: 'upper',
  squat: 'lower',
  hinge: 'lower',
  lunge: 'lower',
  step: 'lower',
  jump: 'lower',
  elbow_flexion: 'upper',
  elbow_extension: 'upper',
  shoulder_abduction: 'upper',
  shoulder_adduction: 'upper',
  shoulder_external_rotation: 'upper',
  shoulder_internal_rotation: 'upper',
  anti_extension: 'core',
  anti_flexion: 'core',
  anti_rotation: 'core',
  rotation: 'core',
  lateral_flexion: 'core',
  anti_lateral_flexion: 'core',
  cyclical_push: 'cardio',
  cyclical_pull: 'cardio',
  full_body_pull: 'compound',
  rear_delt_isolation: 'upper',
  upper_back_isolation: 'upper',
  // Legacy
  knee_dominant: 'lower',
  hip_dominant: 'lower',
  single_leg_lower: 'lower',
  calf_isolation: 'lower',
  biceps_isolation: 'upper',
  triceps_isolation: 'upper',
  core_anti_extension: 'core',
  core_rotation: 'core',
};
