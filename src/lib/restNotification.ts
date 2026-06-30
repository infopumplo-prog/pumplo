import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

// The rest timer's countdown beeps come from web audio, which iOS/Android
// suspend when the app is backgrounded. To still alert the user when their rest
// ends while they're in another app, we schedule a LOCAL NOTIFICATION at the
// rest-end time and cancel it if the rest finishes (or is skipped) in-app.

const REST_NOTIFICATION_ID = 9911;
// Dedicated Android channel for the rest-end alert: HIGH importance + vibration +
// the bundled beep. On Android 8+ the sound/vibration come from the CHANNEL, not
// the notification, so the channel must carry them.
const REST_CHANNEL_ID = 'pumplo_rest';
let permissionAsked = false;
let channelEnsured = false;

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

// Android 8+: create the rest channel once (idempotent). No-op on iOS/web.
async function ensureRestChannel(): Promise<void> {
  if (channelEnsured || Capacitor.getPlatform() !== 'android') return;
  try {
    await LocalNotifications.createChannel({
      id: REST_CHANNEL_ID,
      name: 'Konec pauzy',
      description: 'Zvuk a vibrace na konci odpočinku mezi sériemi',
      importance: 5, // MAX -> heads-up + sound
      visibility: 1, // Public
      sound: 'rest_beep.wav',
      vibration: true,
      lights: true,
    });
    channelEnsured = true;
  } catch (e) {
    console.error('[restNotification] createChannel failed', e);
  }
}

// Schedule a notification `seconds` from now. No-op on web. Replaces any prior one.
export async function scheduleRestEndNotification(seconds: number, title: string, body: string): Promise<void> {
  if (!Capacitor.isNativePlatform() || seconds <= 0) return;
  if (!(await ensurePermission())) return;
  await ensureRestChannel();
  try {
    await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIFICATION_ID }] });
    await LocalNotifications.schedule({
      notifications: [{
        id: REST_NOTIFICATION_ID,
        title,
        body,
        schedule: { at: new Date(Date.now() + seconds * 1000), allowWhileIdle: true },
        // Bundled beep so the rest-end alert is audible when the app is
        // backgrounded / phone locked (iOS: rest_beep.wav in app bundle,
        // Android: res/raw/rest_beep via the channel above).
        sound: 'rest_beep.wav',
        // Android: route through the HIGH-importance vibrating channel.
        channelId: REST_CHANNEL_ID,
        // iOS: break through Focus/DND and light up the screen. When the ringer
        // switch is on silent iOS still suppresses the sound (only a Critical
        // Alert bypasses that), but the device vibrates and the banner shows.
        interruptionLevel: 'timeSensitive',
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
