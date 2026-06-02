import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { dbg } from '@/lib/debugOverlay';

const platform = (): 'ios' | 'android' | null => {
  const p = Capacitor.getPlatform();
  return p === 'ios' || p === 'android' ? p : null;
};

async function saveToken(userId: string, token: string) {
  const plat = platform();
  if (!plat) return;
  // device_tokens is newer than the generated Supabase types — cast the client.
  const { error } = await (supabase as unknown as { from: (t: string) => { upsert: (v: unknown, o: unknown) => Promise<{ error: unknown }> } })
    .from('device_tokens')
    .upsert(
      { user_id: userId, token, platform: plat, updated_at: new Date().toISOString() },
      { onConflict: 'token' },
    );
  console.log('[push] saveToken', plat, token.slice(0, 14), 'error:', error);
}

// Registers this device's FCM token while a user is logged in (native only).
export const usePushRegistration = () => {
  const { user } = useAuth();

  useEffect(() => {
    dbg('hook run — native=' + Capacitor.isNativePlatform() + ' user=' + !!user);
    if (!Capacitor.isNativePlatform() || !user) return;
    let removeRefresh: (() => void) | undefined;

    (async () => {
      try {
        dbg('requesting permission…');
        const perm = await FirebaseMessaging.requestPermissions();
        dbg('permission = ' + JSON.stringify(perm));
        if (perm.receive !== 'granted') { dbg('NOT granted — stopping'); return; }
        const { token } = await FirebaseMessaging.getToken();
        dbg('token = ' + (token ? token.slice(0, 16) + '…' : 'NULL'));
        if (token) await saveToken(user.id, token);
        dbg('saved to device_tokens ✅');

        const handle = await FirebaseMessaging.addListener('tokenReceived', async (e) => {
          if (e.token) await saveToken(user.id, e.token);
        });
        removeRefresh = () => { handle.remove(); };
      } catch (err) {
        dbg('ERROR: ' + (err instanceof Error ? err.message : String(err)));
      }
    })();

    return () => { removeRefresh?.(); };
  }, [user]);
};
