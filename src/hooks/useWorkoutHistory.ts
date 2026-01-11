import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface SetData {
  completed: boolean;
  weight?: number;
  reps?: number;
}

interface ExerciseResult {
  exerciseId: string;
  exerciseName: string;
  sets: SetData[];
}

interface WorkoutSessionData {
  planId: string | null;
  gymId: string;
  dayLetter: string;
  goalId: string;
  startedAt: Date;
  results: ExerciseResult[];
}

export const useWorkoutHistory = () => {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveWorkoutSession = useCallback(async (data: WorkoutSessionData): Promise<string | null> => {
    if (!user) {
      setError('Uživatel není přihlášen');
      return null;
    }

    setIsSaving(true);
    setError(null);

    try {
      const completedAt = new Date();
      const durationSeconds = Math.floor((completedAt.getTime() - data.startedAt.getTime()) / 1000);
      
      // Calculate totals
      let totalSets = 0;
      let totalReps = 0;
      let totalWeight = 0;

      data.results.forEach(exercise => {
        exercise.sets.forEach(set => {
          if (set.completed) {
            totalSets++;
            totalReps += set.reps || 0;
            totalWeight += (set.weight || 0) * (set.reps || 0);
          }
        });
      });

      // 1. Create workout session
      const { data: session, error: sessionError } = await supabase
        .from('workout_sessions')
        .insert({
          user_id: user.id,
          plan_id: data.planId,
          gym_id: data.gymId,
          day_letter: data.dayLetter,
          goal_id: data.goalId,
          started_at: data.startedAt.toISOString(),
          completed_at: completedAt.toISOString(),
          duration_seconds: durationSeconds,
          total_sets: totalSets,
          total_reps: totalReps,
          total_weight_kg: totalWeight
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // 2. Create set records
      const setInserts: any[] = [];
      
      data.results.forEach(exercise => {
        exercise.sets.forEach((set, index) => {
          setInserts.push({
            session_id: session.id,
            exercise_id: exercise.exerciseId || null,
            exercise_name: exercise.exerciseName,
            set_number: index + 1,
            weight_kg: set.weight || null,
            reps: set.reps || null,
            completed: set.completed
          });
        });
      });

      if (setInserts.length > 0) {
        const { error: setsError } = await supabase
          .from('workout_session_sets')
          .insert(setInserts);

        if (setsError) throw setsError;
      }

      return session.id;
    } catch (err) {
      console.error('Error saving workout session:', err);
      setError('Nepodařilo se uložit trénink');
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [user]);

  return {
    saveWorkoutSession,
    isSaving,
    error
  };
};
