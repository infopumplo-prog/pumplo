import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

// Lock-screen workout banner: iOS Live Activity (16.2+) / Android ongoing
// notification. Two modes — "idle" shows the upcoming set with a ✓ App Intent
// button (iOS 17+) that completes it straight from the lock screen; "rest"/
// "work" show a system-drawn countdown. JS only pushes state changes.
// All methods are silent no-ops on web and when the native plugin is missing
// or the user disabled Live Activities / notifications.
interface RestActivityPlugin {
  start(options: { exerciseName: string; nextSetText: string; endsAt: number; totalSeconds: number }): Promise<void>;
  update(options: { nextSetText?: string; endsAt: number; totalSeconds: number }): Promise<void>;
  end(): Promise<void>;
  showSet(options: {
    exerciseName: string; setText: string; detailText: string;
    restSeconds: number; restOverTitle?: string; restOverBody?: string;
  }): Promise<void>;
  consumePending(): Promise<{ completions: number[] }>;
  addListener(eventName: 'setCompleted', cb: () => void): Promise<PluginListenerHandle>;
}

const RestActivity = registerPlugin<RestActivityPlugin>('RestActivity');

export async function startRestActivity(options: { exerciseName: string; nextSetText: string; endsAt: number; totalSeconds: number }): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try { await RestActivity.start(options); } catch { /* plugin missing / disabled → noop */ }
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
  restSeconds: number; restOverTitle?: string; restOverBody?: string;
}): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try { await RestActivity.showSet(options); } catch { /* noop */ }
}

// Lock-screen completions queued while the webview slept. Returns the count.
export async function consumePendingCompletions(): Promise<number> {
  if (!Capacitor.isNativePlatform()) return 0;
  try {
    const { completions } = await RestActivity.consumePending();
    return completions?.length ?? 0;
  } catch { return 0; }
}

// Live notification when the ✓ intent fires while the app is awake.
export function addSetCompletedListener(cb: () => void): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};
  const handle = RestActivity.addListener('setCompleted', cb);
  return () => { handle.then(h => h.remove()).catch(() => {}); };
}
