import { supabase } from '@/integrations/supabase/client';

// Offline-safe queue for finished workouts (N1).
//
// Write-ahead: a workout is written here *before* the save is attempted and
// removed only once the save is confirmed. The earlier version enqueued from
// the catch block, which never ran when a request hung instead of failing —
// on a bad signal the workout was lost silently.
//
// Every queued workout carries a client-generated session id, so a retry can
// never create a second session row for the same workout.

interface SessionInsert {
  id: string;
  user_id: string;
  plan_id: string | null;
  gym_id: string;
  day_letter: string;
  goal_id: string;
  started_at: string;
  completed_at: string;
  duration_seconds: number;
  total_sets: number;
  total_reps: number;
  total_weight_kg: number;
  is_bonus: boolean;
}

interface SetInsertNoSession {
  exercise_id: string | null;
  exercise_name: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  completed: boolean;
}

export interface QueuedWorkoutSave {
  sessionId: string;
  session: SessionInsert;
  // Sets grouped per exercise: one insert batch per exercise, so each batch gets
  // its own created_at and history stays chronological.
  setGroups: SetInsertNoSession[][];
  queuedAt: string;
}

const STORAGE_KEY = 'pumplo_unsaved_sessions';

/** Client-side id so a retried save targets the same row instead of making a new one. */
export const newSessionId = (): string => {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  // Older WebViews (and any non-secure context) have no randomUUID.
  if (c?.getRandomValues) {
    const b = c.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  throw new Error('no_crypto_available');
};

/** Reject after `ms` so a hung request falls through to the queue instead of waiting forever. */
export const withTimeout = <T>(work: PromiseLike<T>, ms: number, label: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout:${label}`)), ms);
    Promise.resolve(work).then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });

export const SAVE_TIMEOUT_MS = 10_000;

/**
 * Reads the queue, tolerating items written by an older build.
 * Pre-1.3.0 items were `{ type: 'full' | 'sets', session?, sessionId?, setGroups }`
 * with a server-generated id; dropping them here would lose exactly the workouts
 * this queue exists to protect.
 */
const readQueue = (): QueuedWorkoutSave[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((item): QueuedWorkoutSave[] => {
      if (!item || typeof item !== 'object') return [];
      const it = item as Partial<QueuedWorkoutSave> & { type?: string; session?: Partial<SessionInsert> };
      const setGroups = Array.isArray(it.setGroups) ? it.setGroups : [];
      const queuedAt = typeof it.queuedAt === 'string' ? it.queuedAt : new Date().toISOString();

      // Legacy 'sets' item: session row already exists, only its sets are missing.
      if (!it.session && typeof it.sessionId === 'string') {
        return [{
          sessionId: it.sessionId,
          session: { id: it.sessionId } as SessionInsert,
          setGroups,
          queuedAt,
        }];
      }
      if (!it.session) return [];

      const sessionId = it.sessionId ?? it.session.id;
      if (typeof sessionId !== 'string') return [];
      return [{
        sessionId,
        session: { ...it.session, id: sessionId } as SessionInsert,
        setGroups,
        queuedAt,
      }];
    });
  } catch {
    return [];
  }
};

const writeQueue = (items: QueuedWorkoutSave[]) => {
  try {
    if (items.length === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch { /* storage full/unavailable — nothing else we can do */ }
};

/** Store the workout before attempting the save. Idempotent per sessionId. */
export const enqueueWorkoutSave = (item: Omit<QueuedWorkoutSave, 'queuedAt'>) => {
  const queue = readQueue().filter((q) => q.sessionId !== item.sessionId);
  queue.push({ ...item, queuedAt: new Date().toISOString() });
  writeQueue(queue);
};

/** Drop a workout from the queue once its save is confirmed. */
export const dequeueWorkoutSave = (sessionId: string) => {
  writeQueue(readQueue().filter((item) => item.sessionId !== sessionId));
};

export const hasQueuedWorkoutSaves = () => readQueue().length > 0;

export const peekQueuedWorkoutSaves = (): QueuedWorkoutSave[] => readQueue();

let flushInFlight = false;

/**
 * Writes one queued workout. Safe to run again on a workout that partially
 * (or fully) landed earlier: the session row is upserted under its client id,
 * and its sets are replaced wholesale rather than appended.
 */
const persistWorkout = async (item: QueuedWorkoutSave): Promise<void> => {
  // `session.user_id` is absent only for legacy 'sets' items, whose row already exists.
  if (item.session?.user_id) {
    const { error } = await withTimeout(
      supabase.from('workout_sessions').upsert(item.session, { onConflict: 'id' }),
      SAVE_TIMEOUT_MS,
      'session',
    );
    if (error) throw error;
  }

  const groups = item.setGroups.filter((g) => g.length > 0);
  if (groups.length === 0) return;

  // Clear first: a previous attempt may have inserted some of these sets before
  // it was cut off, and re-inserting would double them up in history.
  const { error: clearError } = await withTimeout(
    supabase.from('workout_session_sets').delete().eq('session_id', item.sessionId),
    SAVE_TIMEOUT_MS,
    'clear-sets',
  );
  if (clearError) throw clearError;

  for (const group of groups) {
    const { error } = await withTimeout(
      supabase.from('workout_session_sets').insert(group.map((s) => ({ ...s, session_id: item.sessionId }))),
      SAVE_TIMEOUT_MS,
      'sets',
    );
    if (error) throw error;
  }
};

/** Re-attempt queued saves. Returns how many workouts were saved. */
export const flushWorkoutSaveQueue = async (): Promise<number> => {
  if (flushInFlight) return 0;
  const queue = readQueue();
  if (queue.length === 0) return 0;

  flushInFlight = true;
  let flushed = 0;

  try {
    for (const item of queue) {
      try {
        await persistWorkout(item);
        // Re-read through dequeue: the app may have queued another workout meanwhile.
        dequeueWorkoutSave(item.sessionId);
        flushed++;
      } catch (err) {
        console.error('[SaveQueue] flush failed, keeping workout in queue:', err);
      }
    }
  } finally {
    flushInFlight = false;
  }

  return flushed;
};

export const saveWorkoutNow = persistWorkout;

/**
 * The full save path used when a workout is finished: park it, write it, and
 * only drop it once the database confirms. Returns whether it landed; `false`
 * means the workout is safely queued for the next flush, not that it was lost.
 */
export const saveWorkoutWriteAhead = async (
  item: Omit<QueuedWorkoutSave, 'queuedAt'>,
): Promise<boolean> => {
  enqueueWorkoutSave(item);
  try {
    await persistWorkout({ ...item, queuedAt: new Date().toISOString() });
    dequeueWorkoutSave(item.sessionId);
    return true;
  } catch (err) {
    console.error('[SaveQueue] save failed, workout kept in queue:', err);
    return false;
  }
};
