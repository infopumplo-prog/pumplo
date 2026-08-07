import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const platform = (): 'ios' | 'android' | null => {
  const p = Capacitor.getPlatform();
  return p === 'ios' || p === 'android' ? p : null;
};

async function saveToken(userId: string, token: string) {
  const plat = platform();
  if (!plat) return;
  // Verze se posílá kvůli cílení zpráv: novinku smí dostat jen build, který ji
  // umí zobrazit. Když se ji nepodaří zjistit, zůstane null a zařízení se do
  // cílených zpráv nepočítá.
  let appVersion: string | null = null;
  try {
    appVersion = (await App.getInfo()).version ?? null;
  } catch {
    /* starší build nebo nepodporovaná platforma */
  }
  // device_tokens is newer than the generated Supabase types — cast the client.
  await (supabase as unknown as { from: (t: string) => { upsert: (v: unknown, o: unknown) => Promise<{ error: unknown }> } })
    .from('device_tokens')
    .upsert(
      { user_id: userId, token, platform: plat, app_version: appVersion, updated_at: new Date().toISOString() },
      { onConflict: 'token' },
    );
}

// Registers this device's FCM token while a user is logged in (native only).
export const usePushRegistration = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !user) return;
    let removeRefresh: (() => void) | undefined;

    (async () => {
      try {
        const perm = await FirebaseMessaging.requestPermissions();
        if (perm.receive !== 'granted') return;

        // Android 8+: notifications need a channel. Create a HIGH-importance one
        // so pushes appear as heads-up (pop-up + sound), not silently in the shade.
        // Idempotent — re-creating an existing channel is a no-op.
        if (platform() === 'android') {
          try {
            await FirebaseMessaging.createChannel({
              id: 'pumplo_default',
              name: 'Pumplo',
              description: 'Připomínky tréninků a zprávy',
              importance: 4, // Importance.High -> heads-up + sound
              visibility: 1, // Visibility.Public
              vibration: true,
              lights: true,
            });
          } catch (e) {
            console.error('[push] createChannel failed', e);
          }
        }

        const { token } = await FirebaseMessaging.getToken();
        if (token) await saveToken(user.id, token);

        const handle = await FirebaseMessaging.addListener('tokenReceived', async (e) => {
          if (e.token) await saveToken(user.id, e.token);
        });
        removeRefresh = () => { handle.remove(); };
      } catch (err) {
        console.error('[push] registration failed', err);
      }
    })();

    return () => { removeRefresh?.(); };
  }, [user]);
};
