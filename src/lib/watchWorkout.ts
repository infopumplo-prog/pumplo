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

import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export type WatchAction =
  | { type: 'logSet'; weight: number | null; reps: number }
  | { type: 'goPrevSet' } | { type: 'goNextSet' }
  | { type: 'skipRest' } | { type: 'addRest15' };

interface WatchWorkoutPlugin {
  updateState(state: WatchWorkoutState): Promise<void>;
  endState(): Promise<void>;
  addListener(event: 'watchAction', cb: (a: WatchAction) => void): Promise<PluginListenerHandle>;
}
const WatchWorkout = registerPlugin<WatchWorkoutPlugin>('WatchWorkout');

export async function updateWatchState(state: WatchWorkoutState): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try { await WatchWorkout.updateState(state); } catch { /* plugin missing → noop */ }
}
export async function endWatchState(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try { await WatchWorkout.endState(); } catch { /* noop */ }
}
export function addWatchActionListener(cb: (a: WatchAction) => void): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};
  const handle = WatchWorkout.addListener('watchAction', cb);
  return () => { handle.then(h => h.remove()).catch(() => {}); };
}

// Jedny hodiny pauzy pro snapshot na hodinky. Countdown na hodinkách běží z
// restEndsAt lokálně — kdyby web posílal pokaždé nově dopočítaný čas, odpočet
// by při každém rerenderu skočil zpět na plnou hodnotu.
export interface RestClockInput {
  sessionResting: boolean;
  sessionRestEndsAt: number;
  playerResting: boolean;
  playerRestEndsAt: number;
}

export function resolveWatchRestEndsAt(i: RestClockInput): number | null {
  if (i.sessionResting && i.sessionRestEndsAt > 0) return i.sessionRestEndsAt;
  if (i.playerResting && i.playerRestEndsAt > 0) return i.playerRestEndsAt;
  return null;
}
