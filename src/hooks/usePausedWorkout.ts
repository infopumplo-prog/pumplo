import { useState, useEffect, useCallback } from 'react';
import { WorkoutExercise } from '@/lib/trainingGoals';
import { WarmupExercise } from '@/components/workout/WarmupPlayer';

export interface PausedWorkoutState {
  planId: string;
  gymId: string;
  dayLetter: string;
  goalId: string;
  exercises: WorkoutExercise[];
  warmupExercises?: WarmupExercise[];
  currentExerciseIndex: number;
  completedSets: Record<string, { weight?: number; reps?: number; completed: boolean }[]>;
  startedAt: string;
  pausedAt: string;
  isInWarmup: boolean;
  warmupIndex?: number;
}

const STORAGE_KEY = 'pumplo_paused_workout';

export const usePausedWorkout = () => {
  const [pausedWorkout, setPausedWorkout] = useState<PausedWorkoutState | null>(null);

  // Load paused workout from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setPausedWorkout(parsed);
      } catch (e) {
        console.error('Error parsing paused workout:', e);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  // Save paused workout
  const saveWorkout = useCallback((state: PausedWorkoutState) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setPausedWorkout(state);
  }, []);

  // Clear paused workout
  const clearPausedWorkout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setPausedWorkout(null);
  }, []);

  // Check if there's a paused workout for given plan
  const hasPausedWorkout = useCallback((planId?: string) => {
    if (!pausedWorkout) return false;
    if (planId) return pausedWorkout.planId === planId;
    return true;
  }, [pausedWorkout]);

  return {
    pausedWorkout,
    saveWorkout,
    clearPausedWorkout,
    hasPausedWorkout
  };
};
