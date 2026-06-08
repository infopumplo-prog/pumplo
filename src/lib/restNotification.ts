import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

// The rest timer's countdown beeps come from web audio, which iOS/Android
// suspend when the app is backgrounded. To still alert the user when their rest
// ends while they're in another app, we schedule a LOCAL NOTIFICATION at the
// rest-end time and cancel it if the rest finishes (or is skipped) in-app.

const REST_NOTIFICATION_ID = 9911;
let permissionAsked = false;

async function ensurePermission(): Promise<boolean> {
  try {
    const status = await LocalNotifications.checkPermissions();
    if (status.display === 'granted') return true;
    if (permissionAsked) return false;
    permissionAsked = true;
    const req = await LocalNotifications.requestPermissions();
    return req.display === 'granted';
  } catch {
    return false;
  }
}

// Schedule a notification `seconds` from now. No-op on web. Replaces any prior one.
export async function scheduleRestEndNotification(seconds: number, title: string, body: string): Promise<void> {
  if (!Capacitor.isNativePlatform() || seconds <= 0) return;
  if (!(await ensurePermission())) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIFICATION_ID }] });
    await LocalNotifications.schedule({
      notifications: [{
        id: REST_NOTIFICATION_ID,
        title,
        body,
        schedule: { at: new Date(Date.now() + seconds * 1000), allowWhileIdle: true },
        sound: undefined, // default system sound
      }],
    });
  } catch (e) {
    console.error('[restNotification] schedule failed', e);
  }
}

export async function cancelRestEndNotification(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIFICATION_ID }] });
  } catch { /* noop */ }
}
