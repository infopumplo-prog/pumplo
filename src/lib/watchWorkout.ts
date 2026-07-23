export interface WatchWorkoutState {
  phase: 'set' | 'rest' | 'summary' | 'idle';
  exerciseName: string;
  slotCategory: string | null;
  setIndex: number;
  totalSets: number;
  targetWeight: number | null;
  targetReps: number;
  repMin: number;
  repMax: number;
  rir: number | null;
  prevWeight: number | null;
  prevReps: number | null;
  weightStep: number;
  resting: boolean;
  restEndsAt: number | null;
  nextSetLabel: string | null;
}

export interface BuildInput {
  phase: WatchWorkoutState['phase'];
  exerciseName: string;
  slotCategory: string | null;
  setIndex: number;
  totalSets: number;
  targetWeight: number | null;
  repMin: number;
  repMax: number;
  rir: number | null;
  prevWeight: number | null;
  prevReps: number | null;
  resting: boolean;
  restEndsAt: number | null;
  nextSetLabel: string | null;
}

export function buildWatchWorkoutState(i: BuildInput): WatchWorkoutState {
  return {
    phase: i.phase,
    exerciseName: i.exerciseName,
    slotCategory: i.slotCategory,
    setIndex: i.setIndex,
    totalSets: i.totalSets,
    targetWeight: i.targetWeight,
    targetReps: i.repMax,
    repMin: i.repMin,
    repMax: i.repMax,
    rir: i.rir,
    prevWeight: i.prevWeight,
    prevReps: i.prevReps,
    weightStep: 0.5,
    resting: i.resting,
    restEndsAt: i.restEndsAt,
    nextSetLabel: i.nextSetLabel,
  };
}
