import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface WorkoutSession {
  id: string;
  day_letter: string;
  goal_id: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  total_sets: number | null;
  total_reps: number | null;
  total_weight_kg: number | null;
  gym_id: string | null;
}

interface ExerciseStats {
  exerciseId: string;
  exerciseName: string;
  totalSets: number;
  totalReps: number;
  maxWeight: number;
  avgWeight: number;
  lastPerformed: string;
}

export const useWorkoutHistory = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [exerciseStats, setExerciseStats] = useState<ExerciseStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch all workout sessions
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false });

      if (sessionsError) throw sessionsError;

      setSessions(sessionsData || []);

      // Fetch all sets to calculate exercise stats
      const { data: setsData, error: setsError } = await supabase
        .from('workout_session_sets')
        .select(`
          *,
          workout_sessions!inner(user_id)
        `)
        .eq('workout_sessions.user_id', user.id)
        .eq('completed', true);

      if (setsError) throw setsError;

      // Calculate exercise statistics
      const exerciseMap = new Map<string, {
        exerciseId: string;
        exerciseName: string;
        totalSets: number;
        totalReps: number;
        weights: number[];
        lastPerformed: string;
      }>();

      (setsData || []).forEach(set => {
        const key = set.exercise_id || set.exercise_name;
        const existing = exerciseMap.get(key);
        
        if (existing) {
          existing.totalSets++;
          existing.totalReps += set.reps || 0;
          if (set.weight_kg) existing.weights.push(set.weight_kg);
          if (set.created_at > existing.lastPerformed) {
            existing.lastPerformed = set.created_at;
          }
        } else {
          exerciseMap.set(key, {
            exerciseId: set.exercise_id || key,
            exerciseName: set.exercise_name,
            totalSets: 1,
            totalReps: set.reps || 0,
            weights: set.weight_kg ? [set.weight_kg] : [],
            lastPerformed: set.created_at,
          });
        }
      });

      const stats: ExerciseStats[] = Array.from(exerciseMap.values())
        .map(e => ({
          exerciseId: e.exerciseId,
          exerciseName: e.exerciseName,
          totalSets: e.totalSets,
          totalReps: e.totalReps,
          maxWeight: e.weights.length > 0 ? Math.max(...e.weights) : 0,
          avgWeight: e.weights.length > 0 ? e.weights.reduce((a, b) => a + b, 0) / e.weights.length : 0,
          lastPerformed: e.lastPerformed,
        }))
        .sort((a, b) => new Date(b.lastPerformed).getTime() - new Date(a.lastPerformed).getTime());

      setExerciseStats(stats);
    } catch (err) {
      console.error('Error fetching workout history:', err);
      setError('Nepodařilo se načíst historii');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return {
    sessions,
    exerciseStats,
    isLoading,
    error,
    refetch: fetchHistory,
  };
};
