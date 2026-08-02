export interface WatchWorkoutState {
  phase: 'set' | 'rest' | 'cardio' | 'summary' | 'idle';
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
  // Kardio cvik (jen vlastní trénink). Časy jsou razítka v ms, ne zbývající
  // sekundy — dopočet na hodinkách je pak stabilní i mezi rendery telefonu.
  cardioTotalSeconds: number;
  cardioEndsAt: number | null;   // null = ještě nespuštěno
  cardioPausedAt: number | null; // null = běží
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
  // Volitelné — plánový trénink kardio nemá a nemá důvod je vyplňovat.
  cardioTotalSeconds?: number;
  cardioEndsAt?: number | null;
  cardioPausedAt?: number | null;
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
    cardioTotalSeconds: i.cardioTotalSeconds ?? 0,
    cardioEndsAt: i.cardioEndsAt ?? null,
    cardioPausedAt: i.cardioPausedAt ?? null,
  };
}

import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export type WatchAction =
  | { type: 'logSet'; weight: number | null; reps: number }
  | { type: 'goPrevSet' } | { type: 'goNextSet' }
  | { type: 'skipRest' } | { type: 'addRest15' }
  | { type: 'cardioToggle' };

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

// Váha zapsaná sérií: co poslaly hodinky > předvyplněná váha zobrazeného
// cviku > nic (u cizího cviku nikdy nehádáme).
export interface LoggedWeightInput {
  actionWeight: number | null;
  sameExercise: boolean;
  currentExWeight: number | null;
}

export function resolveLoggedWeight(i: LoggedWeightInput): number | undefined {
  if (i.actionWeight != null) return i.actionWeight;
  if (i.sameExercise && i.currentExWeight != null) return i.currentExWeight;
  return undefined;
}

// Krok ‹ / › z hodinek: nejdřív po sériích uvnitř cviku, na kraji přeskoč na
// sousední cvik. Vrací null, když už není kam jít.
export interface SetStepInput {
  exerciseIndex: number;
  setIndex: number;
  totalSets: number;
  exerciseCount: number;
}
export interface SetStepResult { exerciseIndex: number; setIndex: number; }

export function resolveSetStep(i: SetStepInput, direction: 'prev' | 'next'): SetStepResult | null {
  if (direction === 'next') {
    if (i.setIndex + 1 < i.totalSets) return { exerciseIndex: i.exerciseIndex, setIndex: i.setIndex + 1 };
    if (i.exerciseIndex + 1 < i.exerciseCount) return { exerciseIndex: i.exerciseIndex + 1, setIndex: 0 };
    return null;
  }
  if (i.setIndex > 0) return { exerciseIndex: i.exerciseIndex, setIndex: i.setIndex - 1 };
  if (i.exerciseIndex > 0) return { exerciseIndex: i.exerciseIndex - 1, setIndex: 0 };
  return null;
}

// Vlastní trénink (CustomWorkoutPlayer) → snapshot pro hodinky. Čistá funkce,
// aby se dala testovat bez renderu komponenty.
//
// Vlastní plán nemá rozmezí opakování ani RIR, proto repMin === repMax a
// rir === null. Časy jsou razítka v ms; 0 znamená „nemáme".
export interface CustomWatchInput {
  playerState: 'select_gym' | 'select_day' | 'equipment_warning' | 'exercise' | 'rest' | 'completed';
  isCardio: boolean;
  exerciseName: string;
  currentSet: number; // 1-based, jak ho drží přehrávač
  totalSets: number;
  targetWeight: number | null;
  targetReps: number;
  prevWeight: number | null;
  prevReps: number | null;
  restEndsAt: number;
  cardioTotalSeconds: number;
  cardioEndsAt: number;
  cardioPausedAt: number;
  nextExerciseName: string | null;
}

export function buildCustomWatchState(i: CustomWatchInput): BuildInput | null {
  const blank = {
    exerciseName: '', slotCategory: null, setIndex: 0, totalSets: 0,
    targetWeight: null, repMin: 0, repMax: 0, rir: null,
    prevWeight: null, prevReps: null, resting: false, restEndsAt: null,
    nextSetLabel: null,
  };

  if (i.playerState === 'completed') return { phase: 'summary', ...blank };
  if (i.playerState !== 'exercise' && i.playerState !== 'rest') {
    // Výběr posilovny nebo dne — hodinky ať zatím ukazují nabídku.
    return { phase: 'idle', ...blank };
  }

  const common = {
    exerciseName: i.exerciseName,
    slotCategory: i.isCardio ? 'conditioning' : null,
    setIndex: Math.max(0, i.currentSet - 1),
    totalSets: i.totalSets,
    targetWeight: i.targetWeight,
    repMin: i.targetReps,
    repMax: i.targetReps,
    rir: null,
    prevWeight: i.prevWeight,
    prevReps: i.prevReps,
  };

  // Bez známého konce pauzy nemá smysl posílat fázi rest — hodinky by
  // ukazovaly odpočet bez času.
  if (i.playerState === 'rest' && i.restEndsAt > 0) {
    return {
      phase: 'rest', ...common,
      resting: true, restEndsAt: i.restEndsAt,
      nextSetLabel: i.nextExerciseName,
    };
  }

  if (i.isCardio) {
    return {
      phase: 'cardio', ...common,
      resting: false, restEndsAt: null, nextSetLabel: null,
      cardioTotalSeconds: i.cardioTotalSeconds,
      cardioEndsAt: i.cardioEndsAt > 0 ? i.cardioEndsAt : null,
      cardioPausedAt: i.cardioPausedAt > 0 ? i.cardioPausedAt : null,
    };
  }

  return { phase: 'set', ...common, resting: false, restEndsAt: null, nextSetLabel: null };
}
