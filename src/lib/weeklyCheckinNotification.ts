import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { CHECKIN_HOUR, OPEN_CHECKIN_EVENT } from './weeklyCheckin';

// Týdenní check-in (feedback 13. 10.): lokální notifikace každou neděli v 19:00
// (čas zařízení). Klepnutí otevře panel check-inu. O povolení se tu neptáme —
// plánujeme, jen když už ho appka má (iOS sdílí povolení s push notifikacemi).

const CHECKIN_NOTIFICATION_ID = 9920;
export const CHECKIN_NOTIFICATION_TYPE = 'weekly_checkin';
export const PENDING_CHECKIN_KEY = 'pendingWeeklyCheckin';

export async function scheduleWeeklyCheckinNotification(title: string, body: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const status = await LocalNotifications.checkPermissions();
    if (status.display !== 'granted') return;
    await LocalNotifications.cancel({ notifications: [{ id: CHECKIN_NOTIFICATION_ID }] });
    await LocalNotifications.schedule({
      notifications: [{
        id: CHECKIN_NOTIFICATION_ID,
        title,
        body,
        // Capacitor: weekday 1 = neděle; opakuje se každý týden
        schedule: { on: { weekday: 1, hour: CHECKIN_HOUR, minute: 0 }, allowWhileIdle: true },
        extra: { type: CHECKIN_NOTIFICATION_TYPE },
      }],
    });
  } catch (e) {
    console.error('[weeklyCheckin] schedule failed', e);
  }
}

export async function cancelWeeklyCheckinNotification(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: CHECKIN_NOTIFICATION_ID }] });
  } catch { /* noop */ }
}

// Klepnutí na notifikaci → otevřít check-in. Při studeném startu si to
// poznamenáme do sessionStorage, panel se otevře po načtení uživatele.
export async function listenWeeklyCheckinTap(): Promise<() => void> {
  if (!Capacitor.isNativePlatform()) return () => {};
  const handle = await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
    const extra = action?.notification?.extra as Record<string, unknown> | undefined;
    if (extra?.type !== CHECKIN_NOTIFICATION_TYPE) return;
    try { sessionStorage.setItem(PENDING_CHECKIN_KEY, '1'); } catch { /* noop */ }
    window.dispatchEvent(new CustomEvent(OPEN_CHECKIN_EVENT));
  });
  return () => { handle.remove(); };
}
