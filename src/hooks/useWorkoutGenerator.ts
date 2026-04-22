/* eslint-disable @typescript-eslint/no-explicit-any */
// useWorkoutGenerator v2.0.0 - PUMPLO Training System Refactor
// 
// Key changes in v2.0:
// - New scoring system with proper weights (roleMatch: +100, primary: +3, secondary: +0.5)
// - Injury filtering with banned_injuries
// - Anti-repetition penalty (-10 to -30 for recent usage)
// - Safe fallback hierarchy (F0-F5)
// - Atomic database transactions via RPC
// - Full input snapshotting for audit
// - Pre-commit plan validation

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  TrainingGoalId,
  UserLevel,
  DayTemplate,
  DayTemplateSlot,
  SlotCategory,
  PlanInputsSnapshot,
  ValidationReport,
  SplitType,
  getSplitFromFrequency
} from '@/lib/trainingGoals';
import {
  SelectionContext,
  AssignedExercise,
  selectExerciseWithFallbacks,
  fetchExerciseHistory,
  generateSelectionSeed,
  getMaxDifficulty,
  GENERATOR_VERSION,
  METHODOLOGY_VERSION
} from '@/lib/selectionAlgorithm';
import {
  ExerciseInsert,
  ValidationContext,
  validatePlan,
  createValidationReport
} from '@/lib/planValidation';
import {
  getBmiFromProfile,
  getBmiScoringAdjustments,
  getCardioSlotsCount,
  CARDIO_SLOT_DEFAULTS,
  CARDIO_ROLE_IDS,
  getCardioDurationMinutes,
} from '@/lib/bmiUtils';

export const useWorkoutGenerator = () => {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Per-category rest times (seconds) per goal
  // Trainer rules v3: main gets full rest, secondary reduced, isolation/core short
  // This allows more exercises to fit in shorter sessions (e.g. strength 45min)
  const getRestSecondsForCategory = (goalId: string, slotCategory: SlotCategory | string): number => {
    const cat = slotCategory || 'secondary';
    switch (goalId) {
      case 'strength':
        if (cat === 'main') return 300;              // 5 min
        if (cat === 'secondary') return 180;          // 3 min
        return 120;                                   // isolation/core/conditioning: 2 min
      case 'muscle_gain':
        if (cat === 'main') return 180;              // 3 min
        if (cat === 'secondary') return 120;          // 2 min
        return 90;                                    // isolation/core/conditioning: 1.5 min
      case 'fat_loss':
      case 'general_fitness':
      default:
        return 60;                                    // 1 min for all categories
    }
  };

  // Helper: get base sets for a slot based on user level
  const getBaseSetsForSlot = (s: DayTemplateSlot, level: UserLevel): number => {
    switch (level) {
      case 'beginner': return s.beginnerSets;
      case 'intermediate': return s.intermediateSets;
      case 'advanced': return s.advancedSets;
      default: return s.beginnerSets;
    }
  };

  // Get sets for user level from slot template, with bonus sets for longer durations
  // Trainer rules v3: extra time = more SETS, not more exercises
  const getSetsForLevel = (slot: DayTemplateSlot, level: UserLevel, durationMinutes?: number, goalId?: string, allSlots?: DayTemplateSlot[]): number => {
    // Cardio is always 1 set — duration is expressed in repMin/repMax (minutes)
    if (slot.slotCategory === 'conditioning') return 1;
    let baseSets = getBaseSetsForSlot(slot, level);

    // Max TOTAL sets per exercise by level (absolute ceiling)
    const maxTotalSetsByLevel: Record<string, number> = {
      beginner: 4,      // beginners: max 4 sets per exercise
      intermediate: 5,  // intermediate: max 5
      advanced: 7,      // advanced: max 7
    };
    const maxTotalSets = maxTotalSetsByLevel[level] || 4;

    // Greedy bonus sets: fill extra time by adding sets to cheapest exercises first
    // This ensures displayed duration stays close to target duration
    if (durationMinutes && allSlots && allSlots.length > 0) {
      const goal = goalId || 'general_fitness';
      // Calculate actual base time across ALL slots with their real rest times
      // Cardio: always 1 set, ~10 min estimated for time-budget purposes
      const CARDIO_SET_SECONDS = 10 * 60;
      const actualBaseTime = allSlots.reduce((sum, s) => {
        const sets = getBaseSetsForSlot(s, level);
        const rest = getRestSecondsForCategory(goal, s.slotCategory);
        if (s.slotCategory === 'conditioning') {
          return sum + (sets * CARDIO_SET_SECONDS) + rest;
        }
        return sum + (sets * 40) + ((sets - 1) * rest) + rest;
      }, 0);

      const extraSeconds = Math.max(0, (durationMinutes * 60) - actualBaseTime);
      if (extraSeconds > 0) {
        // Build bonus map: greedily assign bonus sets to cheapest slots first
        const bonusMap = new Map<number, number>();
        allSlots.forEach(s => bonusMap.set(s.slotOrder, 0));

        // Helper: cost of adding 1 bonus set to a slot
        const bonusCostForSlot = (s: DayTemplateSlot): number => {
          if (s.slotCategory === 'conditioning') {
            return CARDIO_SET_SECONDS; // 5 min per cardio set
          }
          return 40 + getRestSecondsForCategory(goal, s.slotCategory);
        };

        // Sort slots by bonus cost ascending (cheapest first)
        const sortedByBonusCost = [...allSlots].sort((a, b) => bonusCostForSlot(a) - bonusCostForSlot(b));

        let remaining = extraSeconds;
        // Keep adding rounds until no more time or all slots maxed out
        // Bonus per slot capped at: min(base sets, maxTotalSets - base) — at most double
        let round = 0;
        while (remaining > 0) {
          let addedAny = false;
          for (const s of sortedByBonusCost) {
            const currentBonus = bonusMap.get(s.slotOrder) || 0;
            if (currentBonus > round) continue;
            const sBase = getBaseSetsForSlot(s, level);
            const maxBonusForSlot = Math.min(sBase, maxTotalSets - sBase); // at most double
            if (currentBonus >= maxBonusForSlot) continue;
            const cost = bonusCostForSlot(s);
            if (remaining >= cost) {
              remaining -= cost;
              bonusMap.set(s.slotOrder, currentBonus + 1);
              addedAny = true;
            }
          }
          round++;
          if (!addedAny) break;
        }

        baseSets += bonusMap.get(slot.slotOrder) || 0;
      }
    }
    return baseSets;
  };

  // Goal-based rep range overrides (trainer rules v3)
  // Replaces template rep ranges with goal-specific values
  const getRepRangeForGoal = (goalId: string, slotCategory: SlotCategory): { repMin: number; repMax: number } => {
    // Core and isolation always use higher reps regardless of goal
    if (slotCategory === 'core_or_compensatory') return { repMin: 10, repMax: 15 };
    if (slotCategory === 'isolation') return { repMin: 8, repMax: 12 };
    switch (goalId) {
      case 'strength':
        return { repMin: 3, repMax: 5 };
      case 'muscle_gain':
        return { repMin: 5, repMax: 12 };
      case 'general_fitness':
        return { repMin: 12, repMax: 20 };
      case 'fat_loss':
        if (slotCategory === 'main') return { repMin: 5, repMax: 12 };
        return { repMin: 12, repMax: 20 };
      default:
        return { repMin: 8, repMax: 12 };
    }
  };

  // Goal-based RPE overrides (trainer rules v3)
  // Returns RPE range as RIR (Reps In Reserve) — lower RIR = higher RPE
  // RPE 7-9 ≈ RIR 1-3, RPE 6-8 ≈ RIR 2-4, RPE 4-6 ≈ RIR 4-6
  const getRpeForGoal = (goalId: string, slotCategory: SlotCategory): { rirMin: number; rirMax: number } => {
    switch (goalId) {
      case 'strength':
        return { rirMin: 1, rirMax: 3 }; // RPE 7-9
      case 'muscle_gain':
        return { rirMin: 2, rirMax: 4 }; // RPE 6-8
      case 'general_fitness':
        return { rirMin: 4, rirMax: 6 }; // RPE 4-6
      case 'fat_loss':
        // Main exercises: RPE 6-8, others: RPE 4-6
        if (slotCategory === 'main') {
          return { rirMin: 2, rirMax: 4 }; // RPE 6-8
        }
        return { rirMin: 4, rirMax: 6 }; // RPE 4-6
      default:
        return { rirMin: 2, rirMax: 4 };
    }
  };

  // Fetch day templates from database by split type and goal
  // Templates are per (split_type, goal_id) to allow different rep/set ranges per goal
  const fetchDayTemplates = async (splitType: SplitType, goalId?: string): Promise<DayTemplate[]> => {
    let query = supabase
      .from('day_templates')
      .select('*')
      .eq('split_type', splitType);

    if (goalId) {
      query = query.eq('goal_id', goalId);
    }

    const { data, error } = await query
      .order('day_letter')
      .order('slot_order');

    if (error || !data) {
      console.error('Error fetching day templates:', error);
      return [];
    }

    // Group by day_letter
    const grouped = data.reduce((acc, row) => {
      if (!acc[row.day_letter]) {
        acc[row.day_letter] = {
          dayLetter: row.day_letter,
          dayName: row.day_name,
          slots: []
        };
      }
     acc[row.day_letter].slots.push({
        id: row.id,
        slotOrder: row.slot_order,
        roleId: row.role_id,
        slotCategory: (row.slot_category || 'secondary') as SlotCategory,
        beginnerSets: row.beginner_sets,
        intermediateSets: row.intermediate_sets,
        advancedSets: row.advanced_sets,
        repMin: row.rep_min || 8,
        repMax: row.rep_max || 12,
        rirMin: row.rir_min ?? null,
        rirMax: row.rir_max ?? null,
        notes: row.notes ?? null,
      });
      return acc;
    }, {} as Record<string, DayTemplate>);

    return Object.values(grouped);
  };

  // Rest times now handled by getRestSecondsForCategory() above
  // Per-category rest: main gets full rest, secondary reduced, isolation/core short

  /**
   * Select slots from template based on training duration and goal.
   *
   * Slot priority (short sessions drop from bottom):
   *   1. main          — always included
   *   2. secondary     — always included
   *   3. isolation     — included if time allows
   *   4. core_or_compensatory — included if time allows
   *   5. conditioning  — only for long sessions
   *
   * For very long sessions, extends by duplicating main/secondary slots
   * (not isolation/core). Max 12 exercises.
   */
  const SLOT_PRIORITY: Record<string, number> = {
    main: 1,
    secondary: 2,
    isolation: 3,
    core_or_compensatory: 4,
    conditioning: 5,
  };

  /**
   * Select slots from template based on training duration.
   *
   * Trainer rules v3: NEVER add more exercises for longer sessions.
   * Extra time is filled with bonus SETS (handled by getSetsForLevel).
   * For very short sessions, drop low-priority slots.
   * Exercise count = template count (fixed), only trimmed if time is too short.
   */
  const calculateSlotsForDuration = (
    durationMinutes: number,
    templateSlots: DayTemplateSlot[],
    userLevel: UserLevel,
    goalId?: string
  ): DayTemplateSlot[] => {
    const MIN_EXERCISES = 3;
    const WORK_PER_SET_SEC = 40;

    const goal = goalId || 'general_fitness';

    // Estimate time per exercise using base sets
    const getBaseSets = (s: DayTemplateSlot): number => {
      switch (userLevel) {
        case 'beginner': return s.beginnerSets;
        case 'intermediate': return s.intermediateSets;
        case 'advanced': return s.advancedSets;
        default: return s.beginnerSets;
      }
    };

    // Sort by priority for potential trimming (main first, conditioning last)
    const sortedSlots = [...templateSlots].sort((a, b) => {
      const pa = SLOT_PRIORITY[a.slotCategory] || 3;
      const pb = SLOT_PRIORITY[b.slotCategory] || 3;
      return pa - pb;
    });

    // Calculate total time for all template slots
    const targetSec = durationMinutes * 60;
    const selected = [...sortedSlots];

    // Trim low-priority slots if they don't fit in the time budget
    while (selected.length > MIN_EXERCISES) {
      const totalTime = selected.reduce((sum, s) => {
        const sets = getBaseSets(s);
        const restSec = getRestSecondsForCategory(goal, s.slotCategory);
        return sum + (sets * WORK_PER_SET_SEC) + ((sets - 1) * restSec) + restSec;
      }, 0);

      if (totalTime <= targetSec) break;
      // Remove the lowest-priority slot (last in sorted order)
      selected.pop();
    }

    console.log(`[WorkoutGenerator] Duration: ${durationMinutes}min -> ${selected.length} exercises (template had ${templateSlots.length}, extra time → bonus sets)`);

    // Re-sort by original slot_order
    selected.sort((a, b) => a.slotOrder - b.slotOrder);
    return selected;
  };

  /**
   * Fetch gym equipment data including bench configurations
   */
  const fetchGymEquipment = async (gymId: string) => {
    const { data: gymMachines, error } = await supabase
      .from('gym_machines')
      .select('machine_id, bench_configs')
      .eq('gym_id', gymId);

    if (error) {
      console.error('[WorkoutGenerator] Error fetching gym machines:', error);
      return { 
        machineIds: new Set<string>(), 
        equipmentTypes: new Set<string>(),
        machineIdToBenchConfigs: new Map<string, string[]>()
      };
    }

    const machineIds = new Set(
      gymMachines?.map(m => m.machine_id).filter(Boolean) || []
    );

    // Build map of machine_id to bench_configs
    const machineIdToBenchConfigs = new Map<string, string[]>();
    for (const gm of gymMachines || []) {
      if (gm.bench_configs && gm.bench_configs.length > 0) {
        machineIdToBenchConfigs.set(gm.machine_id, gm.bench_configs);
      }
    }

    // For now, derive equipment types from available - this could be enhanced
    const equipmentTypes = new Set<string>(['machine', 'cable', 'bodyweight', 'free_weights']);

    return { machineIds, equipmentTypes, machineIdToBenchConfigs };
  };

  /**
   * Save plan atomically using database RPC function
   */
  const saveAtomicPlan = async (
    userId: string,
    gymId: string,
    goalId: string,
    exercises: ExerciseInsert[],
    inputsSnapshot: PlanInputsSnapshot,
    trainingDays: string[],
    selectionSeed: string,
    validationReport: ValidationReport
  ): Promise<string | null> => {
    // Convert exercises to JSONB format
    const exercisesJson = exercises.map(ex => ({
      day_letter: ex.day_letter,
      slot_order: ex.slot_order,
      slot_category: ex.slot_category ?? null,
      role_id: ex.role_id,
      exercise_id: ex.exercise_id,
      sets: ex.sets,
      rep_min: ex.rep_min,
      rep_max: ex.rep_max,
      rir_min: ex.rir_min ?? null,
      rir_max: ex.rir_max ?? null,
      is_fallback: ex.is_fallback,
      fallback_reason: ex.fallback_reason,
      selection_score: ex.selection_score
    }));

    // Extract split_type from inputs snapshot
    const splitType = (inputsSnapshot as any)?.split_type || null;
    
    const { data, error } = await supabase.rpc('generate_workout_plan_atomic', {
      p_user_id: userId,
      p_gym_id: gymId,
      p_goal_id: goalId,
      p_exercises: exercisesJson as any,
      p_inputs_snapshot: inputsSnapshot as any,
      p_training_days: trainingDays,
      p_generator_version: GENERATOR_VERSION,
      p_methodology_version: METHODOLOGY_VERSION,
      p_selection_seed: selectionSeed,
      p_validation_report: validationReport as any,
      p_split_type: splitType
    });

    if (error) {
      console.error('[WorkoutGenerator] Atomic save failed:', error);
      throw new Error('Nepodařilo se uložit tréninkový plán: ' + error.message);
    }

    return data as string;
  };

  /**
   * Generate complete workout plan - PUMPLO v2.0 algorithm
   * 
   * Key improvements:
   * - New scoring with injury filtering
   * - Anti-repetition tracking
   * - Safe fallback hierarchy
   * - Atomic database transactions
   * - Full input snapshotting
   * - Pre-commit validation
   */
  const generateWorkoutPlan = useCallback(async (
    gymId: string,
    goalId: TrainingGoalId,
    userLevel: UserLevel,
    userInjuries: string[],
    equipmentPreference: string | null,
    durationMinutes: number = 60,
    trainingDays: string[] = [],
    userHeightCm?: number | null,
    userWeightKg?: number | null
  ): Promise<string | null> => {
    if (!user) {
      setError('Uživatel není přihlášen');
      return null;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Calculate BMI for exercise restrictions
      const bmiResult = getBmiFromProfile(userHeightCm, userWeightKg);
      const bmiAdjustments = getBmiScoringAdjustments(bmiResult);
      const isFatLoss = goalId === 'fat_loss';

      console.log('[WorkoutGenerator v2.1] ========================================');
      console.log('[WorkoutGenerator v2.1] Starting workout plan generation');
      console.log('[WorkoutGenerator v2.1] Generator version:', GENERATOR_VERSION);
      console.log('[WorkoutGenerator v2.1] Gym ID:', gymId);
      console.log('[WorkoutGenerator v2.1] Goal ID:', goalId);
      console.log('[WorkoutGenerator v2.1] User Level:', userLevel);
      console.log('[WorkoutGenerator v2.1] Injuries:', userInjuries);
      console.log('[WorkoutGenerator v2.1] Equipment Preference:', equipmentPreference);
      console.log('[WorkoutGenerator v2.1] Duration:', durationMinutes, 'min');
      if (bmiResult) {
        console.log(`[WorkoutGenerator v2.1] BMI: ${bmiResult.bmi.toFixed(1)} (${bmiResult.category})`);
      }
      if (isFatLoss) {
        console.log('[WorkoutGenerator v2.1] Fat loss mode: 1/3 cardio slots will be injected');
      }
      console.log('[WorkoutGenerator v2.1] ========================================');

      // Generate selection seed for reproducibility
      const selectionSeed = generateSelectionSeed();
      console.log('[WorkoutGenerator v2.0] Selection seed:', selectionSeed);

      // Fetch gym equipment
      const { machineIds, equipmentTypes, machineIdToBenchConfigs } = await fetchGymEquipment(gymId);
      console.log('[WorkoutGenerator v2.0] Available machines:', machineIds.size);

      // Fetch exercise history for anti-repetition
      const exerciseHistory = await fetchExerciseHistory(user.id, 7);
      console.log('[WorkoutGenerator v2.0] Exercise history entries:', exerciseHistory.size);

      // Determine split type from frequency (not goal) per PUMPLO methodology
      const splitType = getSplitFromFrequency(
        trainingDays.length > 0 ? trainingDays.length : 3, // Default to 3 days if not specified
        userLevel
      );
      console.log('[WorkoutGenerator v2.0] Split type (from frequency):', splitType);

      // Fetch day templates by split type and goal
      const templates = await fetchDayTemplates(splitType, goalId);
      if (templates.length === 0) {
        throw new Error(`Nenalezeny šablony pro split: ${splitType}`);
      }
      console.log(`[WorkoutGenerator v2.0] Found ${templates.length} day templates for split: ${splitType}`);

      // Track role occurrences across days
      const roleOccurrencesPerDay = new Map<string, Map<string, number>>();

      // Generate exercises for each day
      const exerciseInserts: ExerciseInsert[] = [];

      for (const day of templates) {
        console.log(`\n[WorkoutGenerator v2.1] === Processing day: ${day.dayLetter} (${day.dayName}) ===`);

        // Adjust slots based on duration
        const adjustedSlots = calculateSlotsForDuration(durationMinutes, day.slots, userLevel, goalId);

        // Fat loss: enforce exactly 1/3 cardio (by exercise count)
        // Keep template conditioning + inject extra, then trim strength to get exact 1/3
        // Other goals: skip conditioning slots
        let finalSlots: DayTemplateSlot[];
        if (isFatLoss) {
          const nonCondSlots = adjustedSlots.filter(s => s.slotCategory !== 'conditioning');
          const condSlots = adjustedSlots.filter(s => s.slotCategory === 'conditioning');

          // Target: cardio = total / 3, so strength = 2 * cardio
          // e.g. 6 non-cond + 1 cond → target 2 cardio → need 4 strength + 2 cardio = 6 total
          const targetCardioCount = getCardioSlotsCount(adjustedSlots.length);
          const targetStrengthCount = targetCardioCount * 2; // exact 1/3 ratio
          const extraCardioNeeded = Math.max(0, targetCardioCount - condSlots.length);

          // Trim strength to target count (drop lowest priority = from end)
          const keepStrength = nonCondSlots.slice(0, Math.min(nonCondSlots.length, targetStrengthCount));

          // Create extra cardio slots if needed
          const newCardioSlots: DayTemplateSlot[] = [];
          for (let c = 0; c < extraCardioNeeded; c++) {
            newCardioSlots.push({
              id: `cardio_${day.dayLetter}_${c}`,
              slotOrder: keepStrength.length + condSlots.length + c + 1,
              roleId: CARDIO_ROLE_IDS[c % CARDIO_ROLE_IDS.length],
              slotCategory: 'conditioning' as SlotCategory,
              beginnerSets: CARDIO_SLOT_DEFAULTS.beginnerSets,
              intermediateSets: CARDIO_SLOT_DEFAULTS.intermediateSets,
              advancedSets: CARDIO_SLOT_DEFAULTS.advancedSets,
              repMin: CARDIO_SLOT_DEFAULTS.repMin,
              repMax: CARDIO_SLOT_DEFAULTS.repMax,
              rirMin: CARDIO_SLOT_DEFAULTS.rirMin,
              rirMax: CARDIO_SLOT_DEFAULTS.rirMax,
              notes: CARDIO_SLOT_DEFAULTS.notes,
            });
          }
          finalSlots = [...keepStrength, ...condSlots, ...newCardioSlots];
          const totalCardio = condSlots.length + newCardioSlots.length;
          console.log(`[WorkoutGenerator v2.1] Fat loss 1/3 rule: ${keepStrength.length} strength + ${totalCardio} cardio = ${finalSlots.length} total`);
        } else {
          finalSlots = adjustedSlots.filter(s => s.slotCategory !== 'conditioning');
        }

        console.log(`[WorkoutGenerator v2.1] Final: ${finalSlots.length} slots for ${durationMinutes}min`);

        const usedExerciseIdsToday: string[] = [];
        const coveredMusclesSession = new Set<string>();
        const usedEquipmentTypes = new Set<string>();

        // Track role occurrences within this day
        const dayRoleOccurrences = new Map<string, number>();

        for (const slot of finalSlots) {
          // Log core/compensatory slots
          if (slot.slotCategory === 'core_or_compensatory') {
            console.log(`[WorkoutGenerator v2.1] Core/compensatory slot: ${slot.roleId}`);
          }

          // Count role occurrence
          const currentOccurrence = (dayRoleOccurrences.get(slot.roleId) || 0) + 1;
          dayRoleOccurrences.set(slot.roleId, currentOccurrence);

          console.log(`[WorkoutGenerator v2.1] Slot ${slot.slotOrder}: Role = ${slot.roleId} (${slot.slotCategory}) (occurrence: ${currentOccurrence})`);

          // Build selection context with BMI adjustments
          const context: SelectionContext = {
            gymId,
            userLevel,
            injuries: userInjuries,
            equipmentPreference,
            equipmentAvailable: equipmentTypes,
            machineIdsAvailable: machineIds,
            machineIdToBenchConfigs,
            coveredMusclesSession,
            usedExerciseIdsToday,
            usedEquipmentTypes,
            roleOccurrence: currentOccurrence,
            durationMinutes,
            bmiPreferMachines: bmiAdjustments.preferMachines,
            bmiPenaltyHighImpact: bmiAdjustments.penaltyHighImpact,
            bmiMaxDifficultyOverride: bmiAdjustments.maxDifficultyOverride,
          };

          // Select exercise using algorithm
          const result = await selectExerciseWithFallbacks(
            slot.roleId,
            context,
            exerciseHistory
          );

          if (result.exercise) {
            usedExerciseIdsToday.push(result.exercise.id);
            result.newCoveredMuscles.forEach(m => coveredMusclesSession.add(m));
            if (result.exercise.equipment_type) {
              usedEquipmentTypes.add(result.exercise.equipment_type);
            }

            console.log(`[WorkoutGenerator v2.1] ✓ Selected: ${result.exercise.name} (score: ${result.selectionScore})`);
          } else {
            console.log(`[WorkoutGenerator v2.1] ✗ Slot skipped: ${result.fallbackReason}`);
          }

          // Apply goal-based rep range and RPE overrides (trainer rules v3)
          // Conditioning slots use dynamic cardio duration instead of goal rep ranges
          const isCardioSlot = slot.slotCategory === 'conditioning';
          let repRange: { repMin: number; repMax: number };
          let rpeRange: { rirMin: number | null; rirMax: number | null };
          if (isCardioSlot) {
            const numCardioSlots = finalSlots.filter(s => s.slotCategory === 'conditioning').length;
            repRange = getCardioDurationMinutes(durationMinutes, numCardioSlots, result.exercise?.difficulty ?? 2);
            rpeRange = { rirMin: null, rirMax: null };
          } else {
            repRange = getRepRangeForGoal(goalId, slot.slotCategory);
            rpeRange = getRpeForGoal(goalId, slot.slotCategory);
          }

          exerciseInserts.push({
            day_letter: day.dayLetter,
            slot_order: slot.slotOrder,
            slot_category: slot.slotCategory,
            role_id: slot.roleId,
            exercise_id: result.exercise?.id || null,
            sets: getSetsForLevel(slot, userLevel, durationMinutes, goalId, finalSlots),
            rep_min: repRange.repMin,
            rep_max: repRange.repMax,
            rir_min: rpeRange.rirMin,
            rir_max: rpeRange.rirMax,
            is_fallback: result.isFallback,
            fallback_reason: result.fallbackReason,
            selection_score: result.selectionScore
          });
        }

        roleOccurrencesPerDay.set(day.dayLetter, dayRoleOccurrences);
        console.log(`[WorkoutGenerator v2.1] Day ${day.dayLetter} complete. Covered muscles:`, Array.from(coveredMusclesSession));
      }

      // Pre-commit validation
      const validationContext: ValidationContext = {
        machineIdsAvailable: machineIds,
        durationMinutes,
        isFatLoss
      };

      const validationResult = validatePlan(exerciseInserts, validationContext, templates);
      const validationReport = createValidationReport(validationResult) as ValidationReport;

      console.log('\n[WorkoutGenerator v2.0] === Validation Report ===');
      console.log('[WorkoutGenerator v2.0] Valid:', validationResult.valid);
      if (validationResult.errors.length > 0) {
        console.error('[WorkoutGenerator v2.0] Errors:', validationResult.errors);
      }
      if (validationResult.warnings.length > 0) {
        console.warn('[WorkoutGenerator v2.0] Warnings:', validationResult.warnings);
      }

      // If validation fails critically, abort
      if (!validationResult.valid) {
        console.error('[WorkoutGenerator v2.0] Validation failed - aborting');
        // For now, proceed with warnings but log errors
        // In production, you might want to throw here
      }

      // Create inputs snapshot for audit
      const inputsSnapshot: PlanInputsSnapshot = {
        goal_id: goalId,
        user_level: userLevel,
        split_type: splitType,
        duration_minutes: durationMinutes,
        equipment_preference: equipmentPreference,
        injuries: userInjuries,
        gym_id: gymId,
        equipment_available_snapshot: Array.from(machineIds),
        training_days: trainingDays,
        generated_at: new Date().toISOString(),
        bmi: bmiResult?.bmi ?? null,
        bmi_category: bmiResult?.category ?? null,
      };

      // Filter out exercises without exercise_id (skipped slots)
      const validExercises = exerciseInserts.filter(e => e.exercise_id !== null);

      console.log(`\n[WorkoutGenerator v2.0] ========================================`);
      console.log(`[WorkoutGenerator v2.0] Saving plan with ${validExercises.length}/${exerciseInserts.length} exercises`);

      // Save atomically
      const planId = await saveAtomicPlan(
        user.id,
        gymId,
        goalId,
        exerciseInserts, // Include all slots, even skipped
        inputsSnapshot,
        trainingDays,
        selectionSeed,
        validationReport
      );

      console.log(`[WorkoutGenerator v2.0] Plan created successfully: ${planId}`);
      console.log(`[WorkoutGenerator v2.0] ========================================`);

      return planId;

    } catch (err) {
      console.error('[WorkoutGenerator v2.0] Error generating workout plan:', err);
      setError(err instanceof Error ? err.message : 'Neznámá chyba');
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [user]);

  return {
    generateWorkoutPlan,
    isGenerating,
    error,
    generatorVersion: GENERATOR_VERSION,
    methodologyVersion: METHODOLOGY_VERSION
  };
};
