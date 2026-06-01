import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { useNavigate } from 'react-router-dom';

// On notification tap, navigate to the route carried in the data payload.
export const usePushNavigation = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let remove: (() => void) | undefined;

    (async () => {
      const handle = await FirebaseMessaging.addListener('notificationActionPerformed', (e) => {
        const route = (e.notification?.data as Record<string, string> | undefined)?.route;
        if (route && route.startsWith('/')) navigate(route);
      });
      remove = () => { handle.remove(); };
    })();

    return () => { remove?.(); };
  }, [navigate]);
};
