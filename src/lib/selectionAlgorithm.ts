// Selection Algorithm v2.0.0 - PUMPLO Training System
// New scoring, fallback hierarchy, and anti-repetition logic

import { supabase } from '@/integrations/supabase/client';
import { UserLevel } from './trainingGoals';
import { CARDIO_ROLE_IDS } from './bmiUtils';

// ============ TYPES ============

export interface Exercise {
  id: string;
  name: string;
  primary_role: string | null;
  difficulty: number | null;
  machine_id: string | null;
  equipment_type: string | null;
  allowed_phase: string | null;
  primary_muscles: string[];
  secondary_muscles: string[];
  banned_injuries?: string[];
  is_compound?: boolean;
  stability_rating?: number;
  slot_type?: string;
  required_bench_config?: string | null;
}

export interface TargetMuscles {
  primary: string[];
  secondary: string[];
}

export interface ExerciseScores {
  roleMatch: number;        // +100 if exact role match
  muscleScore: number;      // Primary: +3, Secondary: +0.5
  equipmentBonus: number;   // +5 if matches preference
  difficultyBonus: number;  // +3 for beginner-friendly
  repetitionPenalty: number; // -10 to -30 based on recent usage
  injuryPenalty: number;    // -999 if contraindicated
  varietyBonus: number;     // +2 for equipment variety
}

export interface ExerciseCandidate {
  exercise: Exercise;
  scores: ExerciseScores;
  totalScore: number;
}

export interface SelectionContext {
  gymId: string;
  userLevel: UserLevel;
  injuries: string[];
  equipmentPreference: string | null;
  equipmentAvailable: Set<string>; // equipment_types available at gym
  machineIdsAvailable: Set<string>; // actual machine UUIDs
  machineIdToBenchConfigs: Map<string, string[]>; // machine_id -> bench configs available
  coveredMusclesSession: Set<string>;
  usedExerciseIdsToday: string[];
  usedEquipmentTypes: Set<string>;
  roleOccurrence: number; // 1 = first time this role appears, 2+ = duplicate
  durationMinutes: number;
  // BMI-based adjustments for obese users
  bmiPreferMachines?: boolean;
  bmiPenaltyHighImpact?: number;
  bmiMaxDifficultyOverride?: number | null;
}

export interface SelectionOptions {
  strictEquipment: boolean;
  strictInjuries: boolean;
  checkRepetition: boolean;
  expandEquipmentTypes?: boolean;
  bodyweightOnly?: boolean;
}

export interface AssignedExercise {
  exercise: Exercise | null;
  isFallback: boolean;
  fallbackReason: string | null;
  newCoveredMuscles: string[];
  selectionScore: number | null;
}

export interface RoleAlias {
  id: string;
  alias_for: string;
  priority: number;
}

export interface ExerciseHistoryEntry {
  exercise_id: string;
  role_id: string;
  used_at: string;
}

// ============ CONSTANTS ============

export const GENERATOR_VERSION = '2.1.0';
export const METHODOLOGY_VERSION = '2.1.0';

const SCORE_ROLE_MATCH = 100;
const SCORE_PRIMARY_MUSCLE = 3;
const SCORE_SECONDARY_MUSCLE = 0.5;
const SCORE_EQUIPMENT_PREFERENCE = 5;
const SCORE_BEGINNER_FRIENDLY = 3;
const SCORE_VARIETY_BONUS = 2;
const PENALTY_INJURY = -999;
const PENALTY_REPETITION_1 = -10;
const PENALTY_REPETITION_2 = -20;
const PENALTY_REPETITION_3 = -30;

// ============ UTILITY FUNCTIONS ============

/**
 * Map user level to max difficulty (scale 1-4, set by trainer)
 * 1 = stroje, vedené pohyby
 * 2 = jednoručky, kladky, základní cviky
 * 3 = bench, dřep s osou, pullup
 * 4 = olympijské lifty, pokročilé varianty
 */
export const getMaxDifficulty = (level: UserLevel): number => {
  switch (level) {
    case 'beginner': return 2;
    case 'intermediate': return 3;
    case 'advanced': return 4;
    default: return 2;
  }
};

/**
 * Check if exercise is contraindicated for user's injuries
 */
export const isContraindicated = (exercise: Exercise, injuries: string[]): boolean => {
  if (!injuries || injuries.length === 0) return false;
  const bannedInjuries = exercise.banned_injuries || [];
  return injuries.some(injury => bannedInjuries.includes(injury));
};

/**
 * Calculate anti-repetition penalty based on recent history
 */
export const getRepetitionPenalty = (
  exerciseId: string,
  roleId: string,
  history: Map<string, Date[]>
): number => {
  const roleHistory = history.get(roleId) || [];
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  
  const recentUsage = roleHistory.filter(d => d.getTime() > sevenDaysAgo);
  
  if (recentUsage.length >= 3) return PENALTY_REPETITION_3;
  if (recentUsage.length >= 2) return PENALTY_REPETITION_2;
  if (recentUsage.length >= 1) return PENALTY_REPETITION_1;
  return 0;
};

/**
 * Check if exercise matches equipment preference
 */
export const matchesEquipmentPreference = (
  exercise: Exercise,
  preference: string | null
): boolean => {
  // No preference or 'no_preference' means no scoring bonus
  if (!preference || preference === 'no_preference') return false;
  
  const exType = exercise.equipment_type || 'bodyweight';
  
  if (preference === 'machines') {
    return exType === 'machine';
  }
  if (preference === 'free_weights') {
    return exType === 'free_weight';
  }
  if (preference === 'bodyweight') {
    return exType === 'bodyweight';
  }
  return false;
};

/**
 * Get variety bonus for using different equipment
 */
export const getVarietyBonus = (
  exercise: Exercise,
  context: SelectionContext
): number => {
  const exType = exercise.equipment_type || 'bodyweight';
  if (!context.usedEquipmentTypes.has(exType)) {
    return SCORE_VARIETY_BONUS;
  }
  return 0;
};

/**
 * Calculate muscle coverage score
 * Primary muscles matching target: +3 each (if uncovered)
 * Secondary muscles: +0.5 each (if uncovered)
 */
export const calculateMuscleScore = (
  exercise: Exercise,
  coveredMuscles: Set<string>,
  targetMuscles: TargetMuscles
): number => {
  let score = 0;
  
  for (const muscle of exercise.primary_muscles || []) {
    if (targetMuscles.primary.includes(muscle) && !coveredMuscles.has(muscle)) {
      score += SCORE_PRIMARY_MUSCLE;
    }
  }
  
  for (const muscle of exercise.secondary_muscles || []) {
    if (!coveredMuscles.has(muscle)) {
      score += SCORE_SECONDARY_MUSCLE;
    }
  }
  
  return score;
};

// Penalty for using same equipment type multiple times in one session
const PENALTY_EQUIPMENT_REPETITION = -5;

/**
 * Calculate complete exercise score
 */
export const calculateExerciseScore = (
  exercise: Exercise,
  context: SelectionContext,
  targetMuscles: TargetMuscles,
  history: Map<string, Date[]>
): ExerciseCandidate => {
  // Equipment repetition penalty - prefer variety in equipment types within session
  const equipmentType = exercise.equipment_type || 'bodyweight';
  const equipmentRepetitionPenalty = context.usedEquipmentTypes.has(equipmentType) 
    ? PENALTY_EQUIPMENT_REPETITION : 0;

  // BMI-based scoring adjustments
  let bmiBonus = 0;
  if (context.bmiPreferMachines) {
    // Prefer machines/cables for obese users
    const exType = exercise.equipment_type || 'bodyweight';
    if (exType === 'machine') {
      bmiBonus += 10;
    }
  }
  if (context.bmiPenaltyHighImpact && exercise.stability_rating && exercise.stability_rating >= 7) {
    // Penalize high-impact exercises for obese users
    bmiBonus += context.bmiPenaltyHighImpact;
  }

  const scores: ExerciseScores = {
    roleMatch: SCORE_ROLE_MATCH,
    muscleScore: calculateMuscleScore(exercise, context.coveredMusclesSession, targetMuscles),
    equipmentBonus: matchesEquipmentPreference(exercise, context.equipmentPreference)
      ? SCORE_EQUIPMENT_PREFERENCE : 0,
    difficultyBonus: context.userLevel === 'beginner' && (exercise.difficulty || 2) <= 1
      ? SCORE_BEGINNER_FRIENDLY : 0,
    repetitionPenalty: getRepetitionPenalty(exercise.id, exercise.primary_role || '', history),
    injuryPenalty: isContraindicated(exercise, context.injuries) ? PENALTY_INJURY : 0,
    varietyBonus: getVarietyBonus(exercise, context) + equipmentRepetitionPenalty + bmiBonus,
  };
  
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  
  return {
    exercise,
    scores,
    totalScore
  };
};

// ============ MAIN SELECTION FUNCTIONS ============

/**
 * Fetch target muscles for a role from role_muscles table
 */
export const fetchTargetMuscles = async (roleId: string): Promise<TargetMuscles> => {
  const { data, error } = await supabase
    .from('role_muscles')
    .select('muscle, is_primary')
    .eq('role_id', roleId);

  if (error || !data) {
    console.warn(`[SelectionAlgorithm] No muscles found for role: ${roleId}`);
    return { primary: [], secondary: [] };
  }

  return {
    primary: data.filter(m => m.is_primary).map(m => m.muscle),
    secondary: data.filter(m => !m.is_primary).map(m => m.muscle)
  };
};

/**
 * Fetch role aliases for fallback substitution
 * 
 * Logika: Aliasy mapují alternativní názvy rolí na skutečné role se cviky.
 * Např. 'push_general' je alias pro 'horizontal_push'.
 * 
 * Když hledáme cviky pro alias (push_general), tato funkce vrátí
 * skutečnou roli (horizontal_push) pod kterou cviky existují.
 */
export const fetchRoleAliases = async (roleId: string): Promise<RoleAlias[]> => {
  // Zkontroluj zda roleId je alias (hledá kde id = roleId)
  const { data: aliasData, error: aliasError } = await supabase
    .from('role_aliases')
    .select('*')
    .eq('id', roleId)
    .order('priority');

  if (!aliasError && aliasData && aliasData.length > 0) {
    // roleId JE alias - vrať skutečnou roli (alias_for)
    return aliasData.map(a => ({
      id: a.alias_for, // Skutečná role se cviky
      alias_for: a.id,
      priority: a.priority || 1
    })) as RoleAlias[];
  }

  // roleId je skutečná role (ne alias) - není potřeba substituce
  return [];
};

/**
 * Fetch role info including has_bodyweight_variant
 */
export const fetchRoleInfo = async (roleId: string): Promise<{ has_bodyweight_variant: boolean }> => {
  const { data, error } = await supabase
    .from('training_roles')
    .select('has_bodyweight_variant')
    .eq('id', roleId)
    .single();

  if (error || !data) {
    return { has_bodyweight_variant: true }; // Default to true
  }

  return { has_bodyweight_variant: data.has_bodyweight_variant ?? true };
};

/**
 * Fetch user exercise history for anti-repetition logic
 */
export const fetchExerciseHistory = async (
  userId: string,
  daysBack: number = 7
): Promise<Map<string, Date[]>> => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  const { data, error } = await supabase
    .from('user_exercise_history')
    .select('role_id, used_at')
    .eq('user_id', userId)
    .gte('used_at', cutoffDate.toISOString());

  const history = new Map<string, Date[]>();
  
  if (error || !data) {
    return history;
  }

  for (const entry of data) {
    const existing = history.get(entry.role_id) || [];
    existing.push(new Date(entry.used_at));
    history.set(entry.role_id, existing);
  }

  return history;
};

/**
 * Get exercise candidates for a role with given options
 */
export const getCandidates = async (
  role: string,
  context: SelectionContext,
  options: SelectionOptions,
  targetMuscles: TargetMuscles,
  history: Map<string, Date[]>
): Promise<ExerciseCandidate[]> => {
  let maxDifficulty = getMaxDifficulty(context.userLevel);
  // BMI override: cap difficulty for severely obese users
  if (context.bmiMaxDifficultyOverride !== undefined && context.bmiMaxDifficultyOverride !== null) {
    maxDifficulty = Math.min(maxDifficulty, context.bmiMaxDifficultyOverride);
  }

  // Build query — cardio roles use category filter instead of primary_role
  const isCardioRole = CARDIO_ROLE_IDS.includes(role);
  let query = supabase
    .from('exercises')
    .select('*')
    .eq('allowed_phase', 'main')
    .lte('difficulty', maxDifficulty);

  if (isCardioRole) {
    query = query.eq('category', 'cardio');
  } else {
    query = query.eq('primary_role', role);
  }

  // Bodyweight only filter
  if (options.bodyweightOnly) {
    query = query.eq('equipment_type', 'bodyweight');
  }

  const { data: exercises, error } = await query;

  if (error || !exercises) {
    console.error('[SelectionAlgorithm] Error fetching exercises:', error);
    return [];
  }

  // Filter exercises
  const filtered = exercises.filter(ex => {
    // Already used today filter
    if (context.usedExerciseIdsToday.includes(ex.id)) {
      return false;
    }

    // Strict equipment filter - machine_id must be available at gym
    if (options.strictEquipment) {
      if (ex.machine_id && !context.machineIdsAvailable.has(ex.machine_id)) {
        return false;
      }
      
      // Check bench config requirements
      if (ex.required_bench_config && ex.machine_id) {
        const benchConfigs = context.machineIdToBenchConfigs.get(ex.machine_id);
        if (!benchConfigs || !benchConfigs.includes(ex.required_bench_config)) {
          // Gym doesn't have the required bench configuration for this exercise
          return false;
        }
      }
      
      // Check equipment type availability (unless bodyweight)
      const exType = ex.equipment_type || 'bodyweight';
      if (exType !== 'bodyweight') {
        // Equipment preference filter (unless expandEquipmentTypes)
        if (!options.expandEquipmentTypes && context.equipmentPreference) {
          if (context.equipmentPreference === 'bodyweight') {
            if (exType !== 'bodyweight') return false;
          }
          if (context.equipmentPreference === 'machines') {
            if (exType !== 'machine') return false;
          }
          if (context.equipmentPreference === 'free_weights') {
            if (exType !== 'free_weight') return false;
          }
        }
      }
    }

    // Strict injuries filter
    if (options.strictInjuries && isContraindicated(ex, context.injuries)) {
      return false;
    }

    return true;
  });

  // Score candidates
  const candidates = filtered.map(ex => 
    calculateExerciseScore(ex, context, targetMuscles, history)
  );

  // Apply duplicate-role logic
  if (context.roleOccurrence > 1) {
    // Second+ occurrence: prefer isolation/accessory
    const isolation = candidates.filter(c => !c.exercise.is_compound);
    if (isolation.length > 0) {
      return isolation.sort((a, b) => b.totalScore - a.totalScore);
    }
  } else {
    // First occurrence: prefer compound
    const compound = candidates.filter(c => c.exercise.is_compound);
    if (compound.length > 0) {
      return compound.sort((a, b) => b.totalScore - a.totalScore);
    }
  }

  // Sort by score
  return candidates.sort((a, b) => b.totalScore - a.totalScore);
};

/**
 * Select from top N candidates randomly
 */
export const selectFromTop = (
  candidates: ExerciseCandidate[],
  topN: number,
  fallbackReason: string | null = null
): AssignedExercise => {
  if (candidates.length === 0) {
    return { 
      exercise: null, 
      isFallback: true, 
      fallbackReason: 'no_candidates', 
      newCoveredMuscles: [],
      selectionScore: null
    };
  }

  const topCandidates = candidates.slice(0, Math.min(topN, candidates.length));
  const randomIndex = Math.floor(Math.random() * topCandidates.length);
  const selected = topCandidates[randomIndex];

  const newCoveredMuscles = [
    ...(selected.exercise.primary_muscles || []),
    ...(selected.exercise.secondary_muscles || [])
  ];

  return {
    exercise: selected.exercise,
    isFallback: fallbackReason !== null,
    fallbackReason,
    newCoveredMuscles,
    selectionScore: selected.totalScore
  };
};

/**
 * Main exercise selection with safe fallback hierarchy
 * 
 * F0: Normal selection (strict equipment, strict injuries, check repetition)
 * F1: Relax anti-repetition only
 * F2: Expand equipment types (still gym-available only)
 * F3: Role alias substitution
 * F4: Bodyweight fallback
 * F5: Skip slot
 */
export const selectExerciseWithFallbacks = async (
  role: string,
  context: SelectionContext,
  history: Map<string, Date[]>
): Promise<AssignedExercise> => {
  const targetMuscles = await fetchTargetMuscles(role);
  
  console.log(`[SelectionAlgorithm] === Selecting for role: ${role} (occurrence: ${context.roleOccurrence}) ===`);

  // F0: Normal selection
  let candidates = await getCandidates(role, context, {
    strictEquipment: true,
    strictInjuries: true,
    checkRepetition: true
  }, targetMuscles, history);

  if (candidates.length > 0) {
    console.log(`[SelectionAlgorithm] F0: Found ${candidates.length} candidates`);
    return selectFromTop(candidates, 10);
  }

  // F1: Relax anti-repetition ONLY
  candidates = await getCandidates(role, context, {
    strictEquipment: true,
    strictInjuries: true,
    checkRepetition: false
  }, targetMuscles, history);

  if (candidates.length > 0) {
    console.log(`[SelectionAlgorithm] F1: Found ${candidates.length} candidates (repetition relaxed)`);
    return selectFromTop(candidates, 3, 'repetition_relaxed');
  }

  // F2: Expand equipment types within available
  candidates = await getCandidates(role, context, {
    strictEquipment: true,
    expandEquipmentTypes: true,
    strictInjuries: true,
    checkRepetition: false
  }, targetMuscles, history);

  if (candidates.length > 0) {
    console.log(`[SelectionAlgorithm] F2: Found ${candidates.length} candidates (equipment expanded)`);
    return selectFromTop(candidates, 3, 'equipment_expanded');
  }

  // F3: Role alias substitution
  const aliases = await fetchRoleAliases(role);
  for (const alias of aliases) {
    candidates = await getCandidates(alias.id, context, {
      strictEquipment: true,
      strictInjuries: true,
      checkRepetition: false
    }, targetMuscles, history);

    if (candidates.length > 0) {
      console.log(`[SelectionAlgorithm] F3: Found ${candidates.length} candidates via alias ${alias.id}`);
      return selectFromTop(candidates, 3, `role_alias:${alias.id}`);
    }
  }

  // F4: Bodyweight fallback
  const roleInfo = await fetchRoleInfo(role);
  if (roleInfo.has_bodyweight_variant) {
    candidates = await getCandidates(role, context, {
      strictEquipment: false,
      bodyweightOnly: true,
      strictInjuries: true,
      checkRepetition: false
    }, targetMuscles, history);

    if (candidates.length > 0) {
      console.log(`[SelectionAlgorithm] F4: Found ${candidates.length} bodyweight candidates`);
      return selectFromTop(candidates, 3, 'bodyweight');
    }
  }

  // F5: Skip slot
  console.warn(`[SelectionAlgorithm] F5: No exercises found for role ${role} - skipping slot`);
  return { 
    exercise: null, 
    isFallback: true, 
    fallbackReason: 'skipped', 
    newCoveredMuscles: [],
    selectionScore: null
  };
};

/**
 * Generate random selection seed for reproducibility
 */
export const generateSelectionSeed = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
};
