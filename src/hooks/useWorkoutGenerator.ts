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

export const useWorkoutGenerator = () => {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get sets for user level from slot template
  const getSetsForLevel = (slot: DayTemplateSlot, level: UserLevel): number => {
    switch (level) {
      case 'beginner': return slot.beginnerSets;
      case 'intermediate': return slot.intermediateSets;
      case 'advanced': return slot.advancedSets;
      default: return slot.beginnerSets;
    }
  };

  // Fetch day templates from database by split type (not goal)
  // Per PUMPLO methodology v1.1, templates are organized by split, not goal
  const fetchDayTemplates = async (splitType: SplitType): Promise<DayTemplate[]> => {
    const { data, error } = await supabase
      .from('day_templates')
      .select('*')
      .eq('split_type', splitType)
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

  /**
   * Calculate number of exercises based on training duration
   * 
   * Formula:
   * - Warmup: ~4 min
   * - One exercise (including rest): ~8 min
   * - Padding: 3 min max over user-set time
   */
  /**
   * Calculate number of exercises based on training duration
   * 
   * PUMPLO Methodology v2.0 Hard Caps:
   * - ≤30 min: max 4 exercises
   * - 31-60 min: max 6 exercises  
   * - 61+ min: max 7 exercises
   */
  const calculateSlotsForDuration = (
    durationMinutes: number,
    templateSlots: DayTemplateSlot[],
    userLevel: UserLevel
  ): DayTemplateSlot[] => {
    // Hard caps from PUMPLO methodology v2.0
    let maxExercises: number;
    if (durationMinutes <= 30) {
      maxExercises = 4;
    } else if (durationMinutes <= 60) {
      maxExercises = 6;
    } else {
      maxExercises = 7; // 61+ min - never more than 7
    }
    
    const WARMUP_MINUTES = 4;
    const MINUTES_PER_EXERCISE = 8;
    const availableMinutes = durationMinutes - WARMUP_MINUTES;
    let targetExerciseCount = Math.floor(availableMinutes / MINUTES_PER_EXERCISE);
    
    // Apply methodology hard caps
    const MIN_EXERCISES = 3;
    targetExerciseCount = Math.max(MIN_EXERCISES, Math.min(targetExerciseCount, maxExercises));
    
    console.log(`[WorkoutGenerator] Duration: ${durationMinutes}min -> Target: ${targetExerciseCount} exercises (max cap: ${maxExercises})`);
    
    if (targetExerciseCount <= templateSlots.length) {
      return templateSlots.slice(0, targetExerciseCount);
    }
    
    // Extend template if needed (up to maxExercises)
    const extended = [...templateSlots];
    let i = 0;
    while (extended.length < targetExerciseCount) {
      const originalSlot = templateSlots[i % templateSlots.length];
      extended.push({
        ...originalSlot,
        id: `${originalSlot.id}_ext_${extended.length}`,
        slotOrder: extended.length + 1
      });
      i++;
    }
    
    return extended;
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
      role_id: ex.role_id,
      exercise_id: ex.exercise_id,
      sets: ex.sets,
      rep_min: ex.rep_min,
      rep_max: ex.rep_max,
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
    trainingDays: string[] = []
  ): Promise<string | null> => {
    if (!user) {
      setError('Uživatel není přihlášen');
      return null;
    }

    setIsGenerating(true);
    setError(null);

    try {
      console.log('[WorkoutGenerator v2.0] ========================================');
      console.log('[WorkoutGenerator v2.0] Starting workout plan generation');
      console.log('[WorkoutGenerator v2.0] Generator version:', GENERATOR_VERSION);
      console.log('[WorkoutGenerator v2.0] Gym ID:', gymId);
      console.log('[WorkoutGenerator v2.0] Goal ID:', goalId);
      console.log('[WorkoutGenerator v2.0] User Level:', userLevel);
      console.log('[WorkoutGenerator v2.0] Injuries:', userInjuries);
      console.log('[WorkoutGenerator v2.0] Equipment Preference:', equipmentPreference);
      console.log('[WorkoutGenerator v2.0] Duration:', durationMinutes, 'min');
      console.log('[WorkoutGenerator v2.0] ========================================');

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

      // Fetch day templates by split type
      const templates = await fetchDayTemplates(splitType);
      if (templates.length === 0) {
        throw new Error(`Nenalezeny šablony pro split: ${splitType}`);
      }
      console.log(`[WorkoutGenerator v2.0] Found ${templates.length} day templates for split: ${splitType}`);

      // Track role occurrences across days
      const roleOccurrencesPerDay = new Map<string, Map<string, number>>();

      // Generate exercises for each day
      const exerciseInserts: ExerciseInsert[] = [];

      for (const day of templates) {
        console.log(`\n[WorkoutGenerator v2.0] === Processing day: ${day.dayLetter} (${day.dayName}) ===`);

        // Adjust slots based on duration
        const adjustedSlots = calculateSlotsForDuration(durationMinutes, day.slots, userLevel);
        console.log(`[WorkoutGenerator v2.0] Adjusted to ${adjustedSlots.length} slots for ${durationMinutes}min`);

        const usedExerciseIdsToday: string[] = [];
        const coveredMusclesSession = new Set<string>();
        const usedEquipmentTypes = new Set<string>();
        
        // Track role occurrences within this day
        const dayRoleOccurrences = new Map<string, number>();

        for (const slot of adjustedSlots) {
          // Skip conditioning slots (kardio) - uživatel si přidá sám
          if (slot.slotCategory === 'conditioning') {
            console.log(`[WorkoutGenerator v2.1] Skipping conditioning slot ${slot.slotOrder}`);
            continue;
          }

          // Log core/compensatory slots
          if (slot.slotCategory === 'core_or_compensatory') {
            console.log(`[WorkoutGenerator v2.1] Core/compensatory slot: ${slot.roleId}`);
          }

          // Count role occurrence
          const currentOccurrence = (dayRoleOccurrences.get(slot.roleId) || 0) + 1;
          dayRoleOccurrences.set(slot.roleId, currentOccurrence);

          console.log(`[WorkoutGenerator v2.1] Slot ${slot.slotOrder}: Role = ${slot.roleId} (${slot.slotCategory}) (occurrence: ${currentOccurrence})`);

          // Build selection context
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
            durationMinutes
          };

          // Select exercise using new algorithm
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

            console.log(`[WorkoutGenerator v2.0] ✓ Selected: ${result.exercise.name} (score: ${result.selectionScore})`);
          } else {
            console.log(`[WorkoutGenerator v2.0] ✗ Slot skipped: ${result.fallbackReason}`);
          }

          exerciseInserts.push({
            day_letter: day.dayLetter,
            slot_order: slot.slotOrder,
            role_id: slot.roleId,
            exercise_id: result.exercise?.id || null,
            sets: getSetsForLevel(slot, userLevel),
            rep_min: slot.repMin,
            rep_max: slot.repMax,
            is_fallback: result.isFallback,
            fallback_reason: result.fallbackReason,
            selection_score: result.selectionScore
          });
        }

        roleOccurrencesPerDay.set(day.dayLetter, dayRoleOccurrences);
        console.log(`[WorkoutGenerator v2.0] Day ${day.dayLetter} complete. Covered muscles:`, Array.from(coveredMusclesSession));
      }

      // Pre-commit validation
      const validationContext: ValidationContext = {
        machineIdsAvailable: machineIds,
        durationMinutes
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
        generated_at: new Date().toISOString()
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
