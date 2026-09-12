import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { newSessionId, saveWorkoutWriteAhead } from '@/lib/workoutSaveQueue';

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

    const sessionId = newSessionId();

    const sessionInsert = {
      id: sessionId,
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

    // Write-ahead: park the workout before touching the network. A request that
    // hangs instead of failing never reaches a catch block, so enqueueing there
    // (as this used to) lost the workout on a bad signal.
    try {
      const saved = await saveWorkoutWriteAhead({ sessionId, session: sessionInsert, setGroups });
      if (saved) return sessionId;
      // Still queued; App.tsx flushes on start and on reconnect.
      setError('Trénink se zatím neuložil, zkusíme to znovu po připojení');
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
