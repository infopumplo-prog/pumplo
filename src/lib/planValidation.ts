// Plan Validation v2.0.0 - PUMPLO Training System
// Pre-commit validation rules for workout plan structure

import { DayTemplate } from './trainingGoals';

export interface ExerciseInsert {
  plan_id?: string;
  day_letter: string;
  slot_order: number;
  role_id: string;
  exercise_id: string | null;
  machine_id?: string | null;
  sets: number;
  rep_min: number;
  rep_max: number;
  is_fallback: boolean;
  fallback_reason: string | null;
  selection_score: number | null;
}

export interface ValidationContext {
  machineIdsAvailable: Set<string>;
  durationMinutes: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Role patterns for validation
const PUSH_ROLES = ['horizontal_push', 'vertical_push', 'push_general', 'chest_press_variant'];
const PULL_ROLES = ['horizontal_pull', 'vertical_pull', 'pulldown_variant', 'pullup_variant'];
const SQUAT_HINGE_ROLES = ['squat', 'hinge', 'lunge', 'squat_light', 'hip_hinge_light'];
const CORE_ROLES = ['anti_extension', 'anti_flexion', 'anti_rotation', 'rotation', 'lateral_flexion', 'anti_lateral_flexion', 'core_anti_extension', 'core_rotation'];

/**
 * Check if a role belongs to a pattern category
 */
const isRoleInCategory = (roleId: string, category: string[]): boolean => {
  return category.some(pattern => roleId.includes(pattern) || pattern.includes(roleId));
};

/**
 * Determine if a day is an upper body day
 */
const isUpperDay = (dayName: string): boolean => {
  const lowerName = dayName.toLowerCase();
  return lowerName.includes('upper') || 
         lowerName.includes('push') || 
         lowerName.includes('pull') ||
         lowerName.includes('horní');
};

/**
 * Determine if a day is a lower body day
 */
const isLowerDay = (dayName: string): boolean => {
  const lowerName = dayName.toLowerCase();
  return lowerName.includes('lower') || 
         lowerName.includes('leg') ||
         lowerName.includes('dolní') ||
         lowerName.includes('nohy');
};

/**
 * Validate plan structure before commit
 * 
 * Hard rules:
 * - All exercises must be compatible with equipment available
 * - Minimum 3 exercises per day
 * - Upper day: at least 1 push + 1 pull pattern
 * - Lower day: at least 1 squat/hinge pattern
 * - Core exercise if duration >= 30min
 */
export const validatePlan = (
  exerciseInserts: ExerciseInsert[],
  context: ValidationContext,
  templates: DayTemplate[]
): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Group exercises by day
  const exercisesByDay = new Map<string, ExerciseInsert[]>();
  for (const ex of exerciseInserts) {
    const dayExercises = exercisesByDay.get(ex.day_letter) || [];
    dayExercises.push(ex);
    exercisesByDay.set(ex.day_letter, dayExercises);
  }

  for (const day of templates) {
    const dayExercises = exercisesByDay.get(day.dayLetter) || [];

    // Check minimum count (at least 3 exercises per day)
    if (dayExercises.length < 3) {
      errors.push(`Den ${day.dayLetter} (${day.dayName}): Méně než 3 cviky (má ${dayExercises.length})`);
    }

    // Check equipment compatibility (skipped exercises don't have machine_id)
    for (const ex of dayExercises) {
      if (ex.machine_id && !context.machineIdsAvailable.has(ex.machine_id)) {
        errors.push(`Den ${day.dayLetter}: Cvik používá nedostupný stroj`);
      }
    }

    // Check upper day structure: must have push + pull
    if (isUpperDay(day.dayName)) {
      const hasPush = dayExercises.some(e => isRoleInCategory(e.role_id, PUSH_ROLES));
      const hasPull = dayExercises.some(e => isRoleInCategory(e.role_id, PULL_ROLES));
      
      if (!hasPush) {
        errors.push(`Den ${day.dayLetter} (${day.dayName}): Chybí tlakový cvik (push)`);
      }
      if (!hasPull) {
        errors.push(`Den ${day.dayLetter} (${day.dayName}): Chybí tahový cvik (pull)`);
      }
    }

    // Check lower day structure: must have squat/hinge
    if (isLowerDay(day.dayName)) {
      const hasSquatOrHinge = dayExercises.some(e => isRoleInCategory(e.role_id, SQUAT_HINGE_ROLES));
      
      if (!hasSquatOrHinge) {
        errors.push(`Den ${day.dayLetter} (${day.dayName}): Chybí dřep/hinge cvik`);
      }
    }

    // Check core requirement for longer sessions
    if (context.durationMinutes >= 30) {
      const hasCore = dayExercises.some(e => isRoleInCategory(e.role_id, CORE_ROLES));
      
      if (!hasCore) {
        warnings.push(`Den ${day.dayLetter} (${day.dayName}): Chybí core cvik pro ${context.durationMinutes}min trénink`);
      }
    }

    // Check for too many skipped slots
    const skippedCount = dayExercises.filter(e => e.exercise_id === null).length;
    if (skippedCount > 2) {
      warnings.push(`Den ${day.dayLetter}: ${skippedCount} přeskočených slotů - možná nedostatek cviků v DB`);
    }
  }

  // Check overall structure
  if (exerciseInserts.length === 0) {
    errors.push('Plán neobsahuje žádné cviky');
  }

  const skippedTotal = exerciseInserts.filter(e => e.exercise_id === null).length;
  const totalSlots = exerciseInserts.length;
  const skippedPercent = totalSlots > 0 ? (skippedTotal / totalSlots) * 100 : 0;
  
  if (skippedPercent > 30) {
    warnings.push(`Vysoké procento přeskočených slotů: ${skippedPercent.toFixed(0)}%`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Create validation report for audit storage
 */
export const createValidationReport = (result: ValidationResult): object => {
  return {
    valid: result.valid,
    errors: result.errors,
    warnings: result.warnings,
    generated_at: new Date().toISOString()
  };
};

/**
 * Check if gym equipment changes invalidate a plan
 */
export const checkPlanEquipmentValidity = async (
  planExercises: { exercise_id: string | null; machine_id?: string | null }[],
  currentMachineIds: Set<string>
): Promise<{ valid: boolean; invalidExercises: string[] }> => {
  const invalidExercises: string[] = [];

  for (const ex of planExercises) {
    if (ex.machine_id && !currentMachineIds.has(ex.machine_id)) {
      invalidExercises.push(ex.exercise_id || 'unknown');
    }
  }

  return {
    valid: invalidExercises.length === 0,
    invalidExercises
  };
};
