import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
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
  // device_tokens is newer than the generated Supabase types — cast the client.
  await (supabase as unknown as { from: (t: string) => { upsert: (v: unknown, o: unknown) => Promise<unknown> } })
    .from('device_tokens')
    .upsert(
      { user_id: userId, token, platform: plat, updated_at: new Date().toISOString() },
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
