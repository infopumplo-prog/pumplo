import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

// Lock-screen workout banner: iOS Live Activity (16.2+) / Android ongoing
// notification. Two modes — "idle" shows the upcoming set (thumb, kg × reps)
// with an empty-checkbox ✓ App Intent button (iOS 17+), "rest"/"work" show a
// system-drawn countdown with a Skip button. JS only pushes state changes.
// All methods are silent no-ops on web and when the native plugin is missing
// or the user disabled Live Activities / notifications.
export interface NextSetPayload {
  exerciseName: string;
  setText: string;
  detailText: string;
  restSeconds: number;
  thumbUrl?: string | null;
}

interface RestActivityPlugin {
  start(options: {
    exerciseName: string; nextSetText: string; endsAt: number; totalSeconds: number;
    thumbUrl?: string | null;
    nextExerciseName?: string; nextSetOfText?: string; nextDetailText?: string;
    nextRestSeconds?: number; nextThumbUrl?: string | null;
  }): Promise<void>;
  update(options: { nextSetText?: string; endsAt: number; totalSeconds: number }): Promise<void>;
  end(): Promise<void>;
  showSet(options: {
    exerciseName: string; setText: string; detailText: string;
    restSeconds: number; thumbUrl?: string | null; showButton?: boolean;
    restOverTitle?: string; restOverBody?: string;
  }): Promise<void>;
  consumePending(): Promise<{ completions: number[]; skips: number[] }>;
  addListener(eventName: 'setCompleted' | 'restSkipped', cb: () => void): Promise<PluginListenerHandle>;
}

const RestActivity = registerPlugin<RestActivityPlugin>('RestActivity');

export async function startRestActivity(options: {
  exerciseName: string; nextSetText: string; endsAt: number; totalSeconds: number;
  thumbUrl?: string | null; nextSet?: NextSetPayload | null;
}): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const { nextSet, ...rest } = options;
  try {
    await RestActivity.start({
      ...rest,
      nextExerciseName: nextSet?.exerciseName ?? '',
      nextSetOfText: nextSet?.setText ?? '',
      nextDetailText: nextSet?.detailText ?? '',
      nextRestSeconds: nextSet?.restSeconds ?? 0,
      nextThumbUrl: nextSet?.thumbUrl ?? null,
    });
  } catch { /* plugin missing / disabled → noop */ }
}

export async function updateRestActivity(options: { nextSetText?: string; endsAt: number; totalSeconds: number }): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try { await RestActivity.update(options); } catch { /* noop */ }
}

export async function endRestActivity(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try { await RestActivity.end(); } catch { /* noop */ }
}

// Upcoming-set card (idle mode) + payload for the lock-screen ✓ intent.
export async function showSetActivity(options: {
  exerciseName: string; setText: string; detailText: string;
  restSeconds: number; thumbUrl?: string | null; showButton?: boolean;
  restOverTitle?: string; restOverBody?: string;
}): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try { await RestActivity.showSet(options); } catch { /* noop */ }
}

// Lock-screen events queued while the webview slept, in the order the user
// tapped them. Both native queues store tap timestamps (ms) — merging and
// sorting restores the real ✓/Skip interleaving, which matters: replaying
// "all skips, then all completions" drops sets when a ✓ follows a Skip.
export type LockScreenEvent = 'complete' | 'skip';
export async function consumePendingEvents(): Promise<LockScreenEvent[]> {
  if (!Capacitor.isNativePlatform()) return [];
  try {
    const { completions, skips } = await RestActivity.consumePending();
    return [
      ...(completions ?? []).map(ts => ({ ts, ev: 'complete' as const })),
      ...(skips ?? []).map(ts => ({ ts, ev: 'skip' as const })),
    ].sort((a, b) => a.ts - b.ts).map(x => x.ev);
  } catch { return []; }
}

// Live notifications when a lock-screen intent fires while the app is awake.
export function addLockScreenListener(event: 'setCompleted' | 'restSkipped', cb: () => void): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};
  const handle = RestActivity.addListener(event, cb);
  return () => { handle.then(h => h.remove()).catch(() => {}); };
}
