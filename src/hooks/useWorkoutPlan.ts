import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  TrainingGoalId, 
  WorkoutExercise, 
  DayTemplate,
  PlanInputsSnapshot,
  ValidationReport,
  WorkoutPlanV2
} from '@/lib/trainingGoals';
import { getCurrentDayLetter, getNextDayLetter, getAllDayLetters } from '@/lib/workoutRotation';
import { checkPlanEquipmentValidity } from '@/lib/planValidation';

interface WorkoutPlanData {
  id: string;
  gymId: string;
  goalId: TrainingGoalId;
  goalName: string;
  dayCount: number;
  currentDayIndex: number;
  currentDayLetter: string;
  exercises: WorkoutExercise[];
  allDays: DayTemplate[];
  startedAt: string | null;
  trainingDays: string[] | null;
  // v2.0 fields
  generatorVersion: string | null;
  methodologyVersion: string | null;
  needsRegeneration: boolean;
  inputsSnapshot: PlanInputsSnapshot | null;
  validationReport: ValidationReport | null;
}

export const useWorkoutPlan = () => {
  const { user } = useAuth();
  const [plan, setPlan] = useState<WorkoutPlanData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [equipmentWarning, setEquipmentWarning] = useState<string | null>(null);

  const fetchActivePlan = useCallback(async () => {
    if (!user) {
      setPlan(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setEquipmentWarning(null);

    try {
      // 1. Get active plan with v2.0 fields
      const { data: planData, error: planError } = await supabase
        .from('user_workout_plans')
        .select(`
          *,
          training_goals (day_count, name)
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (planError) {
        if (planError.code === 'PGRST116') {
          // No active plan
          setPlan(null);
          setIsLoading(false);
          return;
        }
        throw planError;
      }

      // 2. Get user's current day index
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('current_day_index')
        .eq('user_id', user.id)
        .single();

      const currentDayIndex = profileData?.current_day_index || 0;
      const dayCount = (planData.training_goals as any)?.day_count || 2;
      const goalName = (planData.training_goals as any)?.name || 'Trénink';
      const currentDayLetter = getCurrentDayLetter(dayCount, currentDayIndex);

      // 3. Get exercises for this plan with machine info
      const { data: exercisesData, error: exError } = await supabase
        .from('user_workout_exercises')
        .select(`
          *,
          exercises (id, name, video_path, machine_id, machines (name))
        `)
        .eq('plan_id', planData.id)
        .order('day_letter')
        .order('slot_order');

      // 4. Get day templates for day names
      const { data: dayTemplatesData } = await supabase
        .from('day_templates')
        .select('day_letter, day_name')
        .eq('goal_id', planData.goal_id);
      
      // Create a map of day_letter -> day_name
      const dayNameMap: Record<string, string> = {};
      if (dayTemplatesData) {
        dayTemplatesData.forEach(dt => {
          if (!dayNameMap[dt.day_letter]) {
            dayNameMap[dt.day_letter] = dt.day_name;
          }
        });
      }

      if (exError) throw exError;

      // 5. Transform exercises (strictly from DB, no random selection)
      const exercises: WorkoutExercise[] = (exercisesData || []).map(ex => ({
        id: ex.id,
        dayLetter: ex.day_letter,
        slotOrder: ex.slot_order,
        roleId: ex.role_id,
        exerciseId: ex.exercise_id,
        exerciseName: (ex.exercises as any)?.name || null,
        equipment: (ex.exercises as any)?.equipment || [],
        machineName: (ex.exercises as any)?.machines?.name || null,
        sets: ex.sets,
        repMin: ex.rep_min || 8,
        repMax: ex.rep_max || 12,
        isFallback: ex.is_fallback || false,
        fallbackReason: ex.fallback_reason,
        selectionScore: ex.selection_score
      }));

      // 6. Check if gym equipment has changed (needs_regeneration check)
      if (planData.gym_id && !planData.needs_regeneration) {
        const { data: currentMachines } = await supabase
          .from('gym_machines')
          .select('machine_id')
          .eq('gym_id', planData.gym_id);

        const currentMachineIds = new Set(
          currentMachines?.map(m => m.machine_id).filter(Boolean) || []
        );

        // Get machine_ids from exercises
        const exerciseMachines = (exercisesData || [])
          .filter(e => e.exercises && (e.exercises as any).machine_id)
          .map(e => ({
            exercise_id: e.exercise_id,
            machine_id: (e.exercises as any).machine_id
          }));

        const validity = await checkPlanEquipmentValidity(exerciseMachines, currentMachineIds);

        if (!validity.valid) {
          // Flag plan as needing regeneration
          await supabase
            .from('user_workout_plans')
            .update({ needs_regeneration: true })
            .eq('id', planData.id);
          
          setEquipmentWarning(`Některé cviky v plánu již nejsou dostupné v posilovně. Doporučujeme regenerovat plán.`);
        }
      }

      // 7. Parse v2.0 JSON fields
      let inputsSnapshot: PlanInputsSnapshot | null = null;
      let validationReport: ValidationReport | null = null;

      if (planData.inputs_snapshot_json) {
        try {
          inputsSnapshot = planData.inputs_snapshot_json as unknown as PlanInputsSnapshot;
        } catch (e) {
          console.warn('Failed to parse inputs_snapshot_json');
        }
      }

      if (planData.validation_report_json) {
        try {
          validationReport = planData.validation_report_json as unknown as ValidationReport;
        } catch (e) {
          console.warn('Failed to parse validation_report_json');
        }
      }

      // 8. Group exercises by day
      const dayLetters = getAllDayLetters(dayCount);
      const allDays: DayTemplate[] = dayLetters.map(letter => {
        const dayExercises = exercises.filter(e => e.dayLetter === letter);
        return {
          dayLetter: letter,
          dayName: dayNameMap[letter] || `Den ${letter}`,
          slots: dayExercises.map(e => ({
            id: e.id,
            slotOrder: e.slotOrder,
            roleId: e.roleId,
            beginnerSets: e.sets,
            intermediateSets: e.sets,
            advancedSets: e.sets,
            repMin: e.repMin,
            repMax: e.repMax
          }))
        };
      });

      setPlan({
        id: planData.id,
        gymId: planData.gym_id,
        goalId: planData.goal_id as TrainingGoalId,
        goalName,
        dayCount,
        currentDayIndex,
        currentDayLetter,
        exercises,
        allDays,
        startedAt: planData.started_at,
        trainingDays: planData.training_days,
        // v2.0 fields
        generatorVersion: planData.generator_version || null,
        methodologyVersion: planData.methodology_version || null,
        needsRegeneration: planData.needs_regeneration || false,
        inputsSnapshot,
        validationReport
      });
    } catch (err) {
      console.error('Error fetching workout plan:', err);
      setError('Nepodařilo se načíst tréninkový plán');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Move to next day in rotation
  const advanceToNextDay = useCallback(async () => {
    if (!user || !plan) return;

    const { nextIndex } = getNextDayLetter(plan.dayCount, plan.currentDayIndex);

    const { error } = await supabase
      .from('user_profiles')
      .update({ current_day_index: nextIndex })
      .eq('user_id', user.id);

    if (!error) {
      await fetchActivePlan();
    }
  }, [user, plan, fetchActivePlan]);

  // Get exercises for current day
  const getCurrentDayExercises = useCallback((): WorkoutExercise[] => {
    if (!plan) return [];
    return plan.exercises.filter(e => e.dayLetter === plan.currentDayLetter);
  }, [plan]);

  // Get exercises for specific day
  const getExercisesForDay = useCallback((dayLetter: string): WorkoutExercise[] => {
    if (!plan) return [];
    return plan.exercises.filter(e => e.dayLetter === dayLetter);
  }, [plan]);

  // Clear needs_regeneration flag after user regenerates
  const clearRegenerationFlag = useCallback(async () => {
    if (!plan) return;
    
    await supabase
      .from('user_workout_plans')
      .update({ needs_regeneration: false })
      .eq('id', plan.id);
    
    setEquipmentWarning(null);
  }, [plan]);

  useEffect(() => {
    fetchActivePlan();
  }, [fetchActivePlan]);

  return {
    plan,
    isLoading,
    error,
    equipmentWarning,
    refetch: fetchActivePlan,
    advanceToNextDay,
    getCurrentDayExercises,
    getExercisesForDay,
    clearRegenerationFlag
  };
};
