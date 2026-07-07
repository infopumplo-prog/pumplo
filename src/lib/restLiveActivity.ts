import { Capacitor, registerPlugin } from '@capacitor/core';

// Lock-screen rest widget: iOS Live Activity (16.2+) / Android ongoing
// notification with a system chronometer. The native side draws the countdown
// itself, so JS only calls start/update/end on rest lifecycle changes.
// All methods are silent no-ops on web and when the native plugin is missing
// or the user disabled Live Activities / notifications.
interface RestActivityPlugin {
  start(options: { exerciseName: string; nextSetText: string; endsAt: number; totalSeconds: number }): Promise<void>;
  update(options: { nextSetText?: string; endsAt: number; totalSeconds: number }): Promise<void>;
  end(): Promise<void>;
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
