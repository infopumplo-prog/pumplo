import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const PENDING_ROUTE_KEY = 'pendingPushRoute';

// Pull a route string out of whatever shape the notification data arrives in.
const extractRoute = (data: unknown): string | null => {
  if (!data || typeof data !== 'object') return null;
  const r = (data as Record<string, unknown>).route;
  return typeof r === 'string' && r.startsWith('/') ? r : null;
};

// On notification tap, navigate to the route in the payload. The tap may cold-
// start the app, so we stash the route and apply it once the user is loaded —
// that way it isn't overwritten by the app's startup redirect to home.
export const usePushNavigation = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Capture the tapped route.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let remove: (() => void) | undefined;
    (async () => {
      const handle = await FirebaseMessaging.addListener('notificationActionPerformed', (e) => {
        const route = extractRoute(e?.notification?.data);
        if (route) {
          try { sessionStorage.setItem(PENDING_ROUTE_KEY, route); } catch { /* noop */ }
          navigate(route);
        }
      });
      remove = () => { handle.remove(); };
    })();
    return () => { remove?.(); };
  }, [navigate]);

  // Once authenticated, apply any pending route (survives the startup redirect).
  useEffect(() => {
    if (!user) return;
    let pending: string | null = null;
    try { pending = sessionStorage.getItem(PENDING_ROUTE_KEY); } catch { /* noop */ }
    if (pending) {
      try { sessionStorage.removeItem(PENDING_ROUTE_KEY); } catch { /* noop */ }
      const target = pending;
      setTimeout(() => navigate(target), 150);
    }
  }, [user, navigate]);
};
