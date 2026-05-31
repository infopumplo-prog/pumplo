import { useState, useEffect, useCallback } from 'react';

export interface PausedSetData {
  completed: boolean;
  weight: number | null;
  reps: number | null;
  durationSeconds: number | null;
}

export interface PausedCustomWorkoutState {
  planId: string;
  planName: string;
  dayId: string;
  dayName: string;
  currentExerciseIndex: number;
  currentSet: number;
  totalSetsCompleted: number;
  startedAt: string;
  pausedAt: string;
  completedSetsData?: Record<number, PausedSetData[]>;
}

const STORAGE_KEY = 'pumplo_paused_custom_workout';

export const usePausedCustomWorkout = () => {
  const [pausedWorkout, setPausedWorkout] = useState<PausedCustomWorkoutState | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setPausedWorkout(JSON.parse(stored));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const savePausedWorkout = useCallback((state: PausedCustomWorkoutState) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setPausedWorkout(state);
  }, []);

  const clearPausedWorkout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setPausedWorkout(null);
  }, []);

  return { pausedWorkout, savePausedWorkout, clearPausedWorkout };
};
