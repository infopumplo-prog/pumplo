import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { enqueueWorkoutSave } from '@/lib/workoutSaveQueue';

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
  isBonus?: boolean;
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

    const sessionInsert = {
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
      total_weight_kg: totalWeight,
      is_bonus: data.isBonus || false
    };

    // One insert batch per exercise: each batch gets its own created_at, so
    // history reads (ordered by created_at) keep the exercises chronological.
    const setGroups = data.results.map(exercise =>
      exercise.sets.map((set, index) => ({
        exercise_id: exercise.exerciseId || null,
        exercise_name: exercise.exerciseName,
        set_number: index + 1,
        weight_kg: set.weight || null,
        reps: set.reps || null,
        completed: set.completed
      }))
    ).filter(g => g.length > 0);

    let sessionId: string | null = null;
    let groupsInserted = 0;

    try {
      // 1. Create workout session
      const { data: session, error: sessionError } = await supabase
        .from('workout_sessions')
        .insert(sessionInsert)
        .select()
        .single();

      if (sessionError) throw sessionError;
      sessionId = session.id;

      // 2. Create set records, batch per exercise
      for (const group of setGroups) {
        const { error: setsError } = await supabase
          .from('workout_session_sets')
          .insert(group.map(s => ({ ...s, session_id: session.id })));
        if (setsError) throw setsError;
        groupsInserted++;
      }

      return session.id;
    } catch (err) {
      console.error('Error saving workout session:', err);
      setError('Nepodařilo se uložit trénink');
      // Queue for a later retry (flushed on app start/resume) so the
      // workout is never lost to a network dead spot.
      if (sessionId) {
        // Session row exists — requeue only the set groups that didn't make it
        enqueueWorkoutSave({ type: 'sets', sessionId, setGroups: setGroups.slice(groupsInserted) });
      } else {
        enqueueWorkoutSave({ type: 'full', session: sessionInsert, setGroups });
      }
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
