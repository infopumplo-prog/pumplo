import { supabase } from '@/integrations/supabase/client';

// Offline-safe queue for workout sessions whose DB save failed (F1).
// A failed save is stored here and re-attempted on app start / resume,
// so a dead spot in the gym can't lose a finished workout.

interface SessionInsert {
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
  // 'full' = session row + sets; 'sets' = session row already exists, only sets failed
  type: 'full' | 'sets';
  session?: SessionInsert;
  sessionId?: string;
  // For 'full': sets grouped per exercise so the flush can insert one batch per
  // exercise (distinct created_at per exercise keeps history chronological).
  setGroups: SetInsertNoSession[][];
  queuedAt: string;
}

const STORAGE_KEY = 'pumplo_unsaved_sessions';

const readQueue = (): QueuedWorkoutSave[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
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

export const enqueueWorkoutSave = (item: Omit<QueuedWorkoutSave, 'queuedAt'>) => {
  const queue = readQueue();
  queue.push({ ...item, queuedAt: new Date().toISOString() });
  writeQueue(queue);
};

export const hasQueuedWorkoutSaves = () => readQueue().length > 0;

let flushInFlight = false;

/** Re-attempt queued saves. Returns how many items were flushed. */
export const flushWorkoutSaveQueue = async (): Promise<number> => {
  if (flushInFlight) return 0;
  const queue = readQueue();
  if (queue.length === 0) return 0;

  flushInFlight = true;
  const remaining: QueuedWorkoutSave[] = [];
  let flushed = 0;

  try {
    for (const item of queue) {
      try {
        let sessionId = item.sessionId;

        if (item.type === 'full' && item.session) {
          const { data: session, error } = await supabase
            .from('workout_sessions')
            .insert(item.session)
            .select()
            .single();
          if (error) throw error;
          sessionId = session.id;
        }

        if (sessionId) {
          for (let g = 0; g < item.setGroups.length; g++) {
            const group = item.setGroups[g];
            if (group.length === 0) continue;
            const { error: setsError } = await supabase
              .from('workout_session_sets')
              .insert(group.map(s => ({ ...s, session_id: sessionId })));
            if (setsError) {
              // Session row exists now — requeue only the groups not yet inserted
              remaining.push({ type: 'sets', sessionId, setGroups: item.setGroups.slice(g), queuedAt: item.queuedAt });
              throw setsError;
            }
          }
        }

        flushed++;
      } catch (err) {
        console.error('[SaveQueue] flush failed for item, keeping in queue:', err);
        if (item.type === 'full' && !remaining.some(r => r.queuedAt === item.queuedAt)) {
          remaining.push(item);
        }
      }
    }
  } finally {
    writeQueue(remaining);
    flushInFlight = false;
  }

  return flushed;
};
