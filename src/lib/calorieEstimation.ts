// Calorie Estimation for PUMPLO Training System
// Uses MET (Metabolic Equivalent of Task) values with user weight for realistic estimates
//
// MET values from Compendium of Physical Activities:
// - Resistance training (vigorous): 6.0
// - Resistance training (moderate): 3.5
// - Rest between sets (standing): 1.5
// - Cardio/conditioning: 6.0-8.0
//
// Formula: kcal = MET × weight_kg × duration_hours

// Rest times per goal (must match WorkoutSession.tsx REST_TIMES)
const GOAL_REST_BETWEEN_SETS: Record<string, number> = {
  muscle_gain: 90,
  fat_loss: 45,
  strength: 180,
  general_fitness: 60,
};

// MET values per goal (higher intensity = higher MET during active sets)
const GOAL_ACTIVE_MET: Record<string, number> = {
  muscle_gain: 5.0,     // moderate-vigorous hypertrophy
  fat_loss: 6.0,        // higher intensity, shorter rests
  strength: 6.0,        // heavy compound lifts
  general_fitness: 4.0, // moderate intensity
};

const REST_MET = 1.5; // standing rest between sets
const WORK_SECONDS_PER_SET = 40; // average set duration

interface CalorieEstimationParams {
  durationSeconds: number;
  totalSets: number;
  goalId: string;
  weightKg: number;
  gender?: string | null;
  age?: number | null;
}

/**
 * Estimate calories burned during a strength training workout.
 *
 * Splits total workout time into active (sets) and rest periods,
 * applies different MET values to each, and scales by user weight.
 *
 * More accurate than a flat multiplier because it accounts for:
 * - Goal-specific intensity (MET during active sets)
 * - Goal-specific rest durations (strength rests longer than fat_loss)
 * - User's body weight (heavier people burn more)
 * - Gender adjustment (women burn ~15% fewer calories at same MET)
 */
export const estimateCalories = ({
  durationSeconds,
  totalSets,
  goalId,
  weightKg,
  gender,
  age,
}: CalorieEstimationParams): number => {
  if (durationSeconds <= 0 || weightKg <= 0) return 0;

  const durationHours = durationSeconds / 3600;
  const activeMet = GOAL_ACTIVE_MET[goalId] || 4.0;
  const restBetweenSets = GOAL_REST_BETWEEN_SETS[goalId] || 60;

  // Estimate time split between active work and rest
  const activeSeconds = totalSets * WORK_SECONDS_PER_SET;
  const restSeconds = Math.max(0, totalSets - 1) * restBetweenSets;
  const totalEstimatedSeconds = activeSeconds + restSeconds;

  // If we have actual duration, use it to compute the split ratio
  let activeFraction: number;
  let restFraction: number;
  if (totalEstimatedSeconds > 0 && totalSets > 0) {
    activeFraction = activeSeconds / totalEstimatedSeconds;
    restFraction = restSeconds / totalEstimatedSeconds;
    // Remaining time (transitions, warmup) gets a moderate MET
    const otherFraction = Math.max(0, 1 - activeFraction - restFraction);
    activeFraction += otherFraction * 0.3; // some of "other" is still active
    restFraction += otherFraction * 0.7;   // most of "other" is low activity
  } else {
    // Fallback: assume 30% active, 70% rest
    activeFraction = 0.3;
    restFraction = 0.7;
  }

  // Weighted average MET across the workout
  const weightedMet = (activeMet * activeFraction) + (REST_MET * restFraction);

  // Base calorie calculation: MET × weight × hours
  let calories = weightedMet * weightKg * durationHours;

  // Gender adjustment: women typically burn ~15% fewer calories at same MET
  if (gender === 'female') {
    calories *= 0.85;
  }

  // Age adjustment: metabolism slows ~2% per decade after 30
  if (age && age > 30) {
    const decadesOver30 = (age - 30) / 10;
    calories *= Math.max(0.85, 1 - decadesOver30 * 0.02);
  }

  return Math.round(calories);
};

/**
 * Simple fallback estimation when user weight is unknown.
 * Uses average weight of 75kg.
 */
export const estimateCaloriesFallback = (
  durationSeconds: number,
  goalId: string
): number => {
  return estimateCalories({
    durationSeconds,
    totalSets: Math.round(durationSeconds / 150), // rough: 1 set per 2.5 min
    goalId,
    weightKg: 75,
  });
};
