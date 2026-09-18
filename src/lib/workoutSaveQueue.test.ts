import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Fake Supabase: records what actually reached the "database" so the tests can
// assert on rows rather than on call counts.
interface Row { [key: string]: unknown }
const db = { sessions: [] as Row[], sets: [] as Row[] };

type Mode = 'ok' | 'hang' | 'error';
const net = { mode: 'ok' as Mode, queueDepthAtFirstCall: -1, failSetsAfterGroups: -1 };

let peek: () => { sessionId: string }[];

const respond = <T>(work: () => T): PromiseLike<T> => {
  if (net.queueDepthAtFirstCall === -1) net.queueDepthAtFirstCall = peek().length;
  if (net.mode === 'hang') return new Promise<T>(() => { /* never settles */ });
  if (net.mode === 'error') return Promise.resolve({ error: { message: 'offline' } } as T);
  return Promise.resolve(work());
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      upsert: (row: Row) => respond(() => {
        const i = db.sessions.findIndex((s) => s.id === row.id);
        if (i >= 0) db.sessions[i] = row; else db.sessions.push(row);
        return { error: null };
      }),
      insert: (rows: Row[]) => respond(() => {
        if (net.failSetsAfterGroups === 0) return { error: { message: 'cut off' } };
        if (net.failSetsAfterGroups > 0) net.failSetsAfterGroups--;
        db.sets.push(...rows);
        return { error: null };
      }),
      delete: () => ({
        eq: (col: string, val: unknown) => respond(() => {
          db.sets = db.sets.filter((s) => s[col] !== val);
          return { error: null };
        }),
      }),
    }),
  },
}));

const {
  enqueueWorkoutSave, dequeueWorkoutSave, peekQueuedWorkoutSaves,
  flushWorkoutSaveQueue, saveWorkoutWriteAhead, newSessionId, withTimeout,
} = await import('./workoutSaveQueue');

peek = peekQueuedWorkoutSaves;

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  db.sessions = [];
  db.sets = [];
  net.mode = 'ok';
  net.queueDepthAtFirstCall = -1;
  net.failSetsAfterGroups = -1;
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

const workout = (sessionId = 'sess-1') => ({
  sessionId,
  session: {
    id: sessionId,
    user_id: 'user-1',
    plan_id: null,
    gym_id: 'gym-1',
    day_letter: 'A',
    goal_id: 'goal-1',
    started_at: '2026-09-06T08:00:00.000Z',
    completed_at: '2026-09-06T09:00:00.000Z',
    duration_seconds: 3600,
    total_sets: 3,
    total_reps: 24,
    total_weight_kg: 1920,
    is_bonus: false,
  },
  setGroups: [
    [{ exercise_id: 'e1', exercise_name: 'Bench press', set_number: 1, weight_kg: 80, reps: 8, completed: true }],
    [{ exercise_id: 'e2', exercise_name: 'Dřep', set_number: 1, weight_kg: 100, reps: 8, completed: true }],
  ],
});

describe('write-ahead', () => {
  it('queues the workout before the first network call', async () => {
    await saveWorkoutWriteAhead(workout());
    // Recorded inside the mock at the moment Supabase was first touched.
    expect(net.queueDepthAtFirstCall).toBe(1);
  });

  it('keeps the workout queued when the save errors out', async () => {
    net.mode = 'error';
    const saved = await saveWorkoutWriteAhead(workout());
    expect(saved).toBe(false);
    expect(peekQueuedWorkoutSaves().map((i) => i.sessionId)).toEqual(['sess-1']);
  });
});

describe('timeout', () => {
  it('rejects a request that never settles', async () => {
    vi.useFakeTimers();
    const hung = withTimeout(new Promise(() => { /* hangs */ }), 10_000, 'session');
    const assertion = expect(hung).rejects.toThrow('timeout:session');
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
  });

  it('leaves a hung workout in the queue instead of losing it', async () => {
    vi.useFakeTimers();
    net.mode = 'hang';
    const pending = saveWorkoutWriteAhead(workout());
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toBe(false);
    expect(peekQueuedWorkoutSaves().map((i) => i.sessionId)).toEqual(['sess-1']);
    expect(db.sessions).toHaveLength(0);
  });
});

describe('dequeue', () => {
  it('empties the queue after a confirmed save', async () => {
    const saved = await saveWorkoutWriteAhead(workout());
    expect(saved).toBe(true);
    expect(peekQueuedWorkoutSaves()).toHaveLength(0);
    expect(db.sessions).toHaveLength(1);
    expect(db.sets).toHaveLength(2);
  });

  it('removes only the confirmed workout and leaves the others queued', () => {
    enqueueWorkoutSave(workout('sess-1'));
    enqueueWorkoutSave(workout('sess-2'));
    dequeueWorkoutSave('sess-1');
    expect(peekQueuedWorkoutSaves().map((i) => i.sessionId)).toEqual(['sess-2']);
  });
});

describe('idempotence', () => {
  it('flushing a workout twice leaves one session and one set per exercise', async () => {
    enqueueWorkoutSave(workout());
    await flushWorkoutSaveQueue();
    // Simulate the app dying before the queue was cleared: re-queue the same workout.
    enqueueWorkoutSave(workout());
    await flushWorkoutSaveQueue();

    expect(db.sessions).toHaveLength(1);
    expect(db.sets).toHaveLength(2);
    expect(db.sets.map((s) => s.exercise_name).sort()).toEqual(['Bench press', 'Dřep']);
  });

  it('does not duplicate sets when an earlier attempt was cut off mid-way', async () => {
    // First attempt writes group 1, then the connection drops on group 2.
    net.failSetsAfterGroups = 1;
    enqueueWorkoutSave(workout());
    await flushWorkoutSaveQueue();
    expect(db.sets).toHaveLength(1);
    expect(peekQueuedWorkoutSaves()).toHaveLength(1);

    net.failSetsAfterGroups = -1;
    await flushWorkoutSaveQueue();
    expect(db.sets).toHaveLength(2);
    expect(peekQueuedWorkoutSaves()).toHaveLength(0);
  });

  it('enqueueing the same workout twice keeps a single queue entry', () => {
    enqueueWorkoutSave(workout());
    enqueueWorkoutSave(workout());
    expect(peekQueuedWorkoutSaves()).toHaveLength(1);
  });
});

describe('legacy queue items', () => {
  it('still saves a workout queued by the previous build', async () => {
    const legacy = [{
      type: 'full',
      session: { ...workout().session, id: 'legacy-1' },
      setGroups: workout().setGroups,
      queuedAt: '2026-09-01T10:00:00.000Z',
    }];
    store.set('pumplo_unsaved_sessions', JSON.stringify(legacy));

    expect(await flushWorkoutSaveQueue()).toBe(1);
    expect(db.sessions.map((s) => s.id)).toEqual(['legacy-1']);
    expect(peekQueuedWorkoutSaves()).toHaveLength(0);
  });

  it('drops an unusable entry instead of throwing', () => {
    store.set('pumplo_unsaved_sessions', JSON.stringify([null, { nonsense: true }]));
    expect(peekQueuedWorkoutSaves()).toHaveLength(0);
  });
});

describe('newSessionId', () => {
  it('produces distinct v4-shaped ids', () => {
    const a = newSessionId();
    const b = newSessionId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
  });
});
