// BMI Utilities for PUMPLO Training System
// Calculates BMI and determines exercise restrictions for obese users

export type BmiCategory =
  | 'underweight'      // < 18.5
  | 'normal'           // 18.5 - 24.9
  | 'overweight'       // 25 - 29.9
  | 'obese_1'          // 30 - 34.9 (Obezita I. stupně)
  | 'obese_2'          // 35 - 39.9 (Obezita II. stupně)
  | 'obese_3';         // 40+ (Ultra obezita / morbidní)

export interface BmiResult {
  bmi: number;
  category: BmiCategory;
  label: string;
}

/**
 * Calculate BMI from height (cm) and weight (kg)
 */
export const calculateBmi = (heightCm: number, weightKg: number): number => {
  if (heightCm <= 0 || weightKg <= 0) return 0;
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
};

/**
 * Get BMI category and label
 */
export const getBmiCategory = (bmi: number): BmiResult => {
  if (bmi < 18.5) return { bmi, category: 'underweight', label: 'Podváha' };
  if (bmi < 25) return { bmi, category: 'normal', label: 'Normální váha' };
  if (bmi < 30) return { bmi, category: 'overweight', label: 'Nadváha' };
  if (bmi < 35) return { bmi, category: 'obese_1', label: 'Obezita I. stupně' };
  if (bmi < 40) return { bmi, category: 'obese_2', label: 'Obezita II. stupně' };
  return { bmi, category: 'obese_3', label: 'Morbidní obezita' };
};

/**
 * Get BMI result from user profile data
 */
export const getBmiFromProfile = (
  heightCm: number | null | undefined,
  weightKg: number | null | undefined
): BmiResult | null => {
  if (!heightCm || !weightKg) return null;
  const bmi = calculateBmi(heightCm, weightKg);
  return getBmiCategory(bmi);
};

/**
 * Check if user is in an obese category (BMI >= 30)
 */
export const isObese = (bmiResult: BmiResult | null): boolean => {
  if (!bmiResult) return false;
  return ['obese_1', 'obese_2', 'obese_3'].includes(bmiResult.category);
};

/**
 * Check if user has severe obesity (BMI >= 35)
 */
export const isSeverelyObese = (bmiResult: BmiResult | null): boolean => {
  if (!bmiResult) return false;
  return ['obese_2', 'obese_3'].includes(bmiResult.category);
};

// ============ EXERCISE RESTRICTIONS FOR OBESE USERS ============

/**
 * Equipment types that are safer for obese users
 * Machines provide stability and reduce joint stress
 */
export const OBESE_PREFERRED_EQUIPMENT = ['machine'];

/**
 * Roles/exercises to AVOID for obese users (BMI >= 30)
 * High-impact, high joint stress, or require significant mobility
 */
export const OBESE_RESTRICTED_ROLES: string[] = [
  // No restrictions at role level — restrictions are at exercise level via banned_injuries
  // But we add scoring penalties for high-impact exercises
];

/**
 * Get additional scoring adjustments based on BMI
 * Used in selectionAlgorithm to prefer safer exercises for obese users
 */
export const getBmiScoringAdjustments = (bmiResult: BmiResult | null) => {
  if (!bmiResult) return { preferMachines: false, penaltyHighImpact: 0, maxDifficultyOverride: null as number | null };

  switch (bmiResult.category) {
    case 'obese_1':
      return {
        preferMachines: true,        // Prefer machines for stability
        penaltyHighImpact: -15,      // Small penalty for high-impact exercises
        maxDifficultyOverride: null,  // No difficulty override
      };
    case 'obese_2':
      return {
        preferMachines: true,
        penaltyHighImpact: -30,      // Larger penalty for high-impact
        maxDifficultyOverride: 2,    // Cap at basic exercises (scale 1-4)
      };
    case 'obese_3':
      return {
        preferMachines: true,
        penaltyHighImpact: -50,      // Strong penalty for high-impact
        maxDifficultyOverride: 1,    // Only machine/guided exercises (scale 1-4)
      };
    default:
      return {
        preferMachines: false,
        penaltyHighImpact: 0,
        maxDifficultyOverride: null,
      };
  }
};

// ============ FAT LOSS CARDIO LOGIC ============

/**
 * Cardio role IDs available in the database
 */
export const CARDIO_ROLE_IDS = ['cyclical_pull', 'cyclical_push'];

/**
 * Default cardio slot configuration for fat_loss plans
 * Sets always 1 — duration is calculated dynamically from target workout time
 */
export const CARDIO_SLOT_DEFAULTS = {
  roleId: 'cyclical_push',
  slotCategory: 'conditioning' as const,
  beginnerSets: 1,
  intermediateSets: 1,
  advancedSets: 1,
  repMin: 8,
  repMax: 12,
  rirMin: null,
  rirMax: null,
  notes: 'Kardio — čas závisí na délce tréninku',
};

/**
 * Floor/ceiling for cardio duration in minutes based on exercise difficulty (1–4)
 * Higher difficulty = shorter but more intense; lower = longer, steadier pace
 */
export const CARDIO_DURATION_BOUNDS: Record<number, { floor: number; ceiling: number }> = {
  1: { floor: 10, ceiling: 20 },
  2: { floor: 8,  ceiling: 16 },
  3: { floor: 6,  ceiling: 13 },
  4: { floor: 4,  ceiling: 10 },
};

/**
 * Calculate cardio duration in minutes based on target workout time, number of cardio slots,
 * and exercise difficulty. Clamps to difficulty-specific bounds.
 */
export const getCardioDurationMinutes = (
  durationMinutes: number,
  numCardioSlots: number,
  exerciseDifficulty: number = 2
): { repMin: number; repMax: number } => {
  const slots = Math.max(1, numCardioSlots);
  const targetMin = Math.round((durationMinutes / 3) / slots);
  const diff = Math.min(4, Math.max(1, exerciseDifficulty));
  const { floor, ceiling } = CARDIO_DURATION_BOUNDS[diff];
  const clamped = Math.max(floor, Math.min(ceiling, targetMin));
  return { repMin: Math.max(floor, clamped - 2), repMax: clamped };
};

/**
 * Calculate how many cardio slots to inject for fat_loss
 * Rule: 1/3 of total exercises must be cardio
 *
 * @param totalSlots - total number of exercise slots in the day
 * @returns number of cardio slots to add
 */
export const getCardioSlotsCount = (totalSlots: number): number => {
  // 1/3 of workout is cardio
  // For 6 exercises: 2 cardio slots
  // For 4 exercises: 1-2 cardio slots
  // For 3 exercises: 1 cardio slot
  // Minimum 1 cardio slot
  return Math.max(1, Math.round(totalSlots / 3));
};
