// Pumplo Service Worker for Push Notifications + Offline Caching
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// Precache static assets (Vite PWA injects manifest here)
precacheAndRoute(self.__WB_MANIFEST || []);

// ============================================
// HTML Navigation - ALWAYS NetworkFirst (never serve stale index.html)
// ============================================
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: 'navigation-cache',
    networkTimeoutSeconds: 3,
  })
);

// ============================================
// CRITICAL DATA - NetworkFirst (always try network, cache as fallback)
// ============================================

// User profiles - MUST be fresh
registerRoute(
  /^https:\/\/.*\.supabase\.co\/rest\/v1\/user_profiles.*/i,
  new NetworkFirst({
    cacheName: 'user-profile-cache',
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60 * 60 * 24, // 24 hours fallback
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// Workout plans - MUST be fresh
registerRoute(
  /^https:\/\/.*\.supabase\.co\/rest\/v1\/user_workout_plans.*/i,
  new NetworkFirst({
    cacheName: 'workout-plans-cache',
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days fallback
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// Workout exercises - MUST be fresh
registerRoute(
  /^https:\/\/.*\.supabase\.co\/rest\/v1\/user_workout_exercises.*/i,
  new NetworkFirst({
    cacheName: 'workout-exercises-cache',
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days fallback
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// Workout sessions/history - NetworkFirst for fresh data
registerRoute(
  /^https:\/\/.*\.supabase\.co\/rest\/v1\/workout_sessions.*/i,
  new NetworkFirst({
    cacheName: 'workout-history-cache',
    networkTimeoutSeconds: 3,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days fallback
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

registerRoute(
  /^https:\/\/.*\.supabase\.co\/rest\/v1\/workout_session_sets.*/i,
  new NetworkFirst({
    cacheName: 'workout-sets-cache',
    networkTimeoutSeconds: 3,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 500,
        maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days fallback
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// ============================================
// SEMI-STATIC DATA - StaleWhileRevalidate (show cache, update in background)
// ============================================

// Day templates - changes rarely
registerRoute(
  /^https:\/\/.*\.supabase\.co\/rest\/v1\/day_templates.*/i,
  new StaleWhileRevalidate({
    cacheName: 'day-templates-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// Exercises catalog - StaleWhileRevalidate instead of CacheFirst
registerRoute(
  /^https:\/\/.*\.supabase\.co\/rest\/v1\/exercises.*/i,
  new StaleWhileRevalidate({
    cacheName: 'exercises-catalog-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 500,
        maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days (was 30)
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// Training goals/roles - static reference data
registerRoute(
  /^https:\/\/.*\.supabase\.co\/rest\/v1\/(training_goals|training_roles).*/i,
  new CacheFirst({
    cacheName: 'training-reference-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24 * 14, // 14 days
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// Machines catalog
registerRoute(
  /^https:\/\/.*\.supabase\.co\/rest\/v1\/machines.*/i,
  new StaleWhileRevalidate({
    cacheName: 'machines-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// Gyms data
registerRoute(
  /^https:\/\/.*\.supabase\.co\/rest\/v1\/(gyms|public_gyms|gym_machines).*/i,
  new StaleWhileRevalidate({
    cacheName: 'gyms-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24, // 24 hours
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// ============================================
// Fallback for other Supabase requests
// ============================================
registerRoute(
  /^https:\/\/.*\.supabase\.co\/.*/i,
  new NetworkFirst({
    cacheName: 'supabase-cache',
    networkTimeoutSeconds: 10,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24, // 24 hours
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// ============================================
// Push Notification Handlers
// ============================================

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Service worker activated');
  event.waitUntil(clients.claim());
});

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);
  
  let data = {
    title: 'Pumplo',
    body: 'Máš novú notifikáciu',
    icon: '/pwa-192x192.png',
    badge: '/favicon.ico',
    data: { url: '/' }
  };
  
  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      console.error('[SW] Error parsing push data:', e);
      data.body = event.data.text();
    }
  }
  
  const options = {
    body: data.body,
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/favicon.ico',
    vibrate: [100, 50, 100],
    data: data.data || { url: '/' },
    actions: [
      { action: 'open', title: 'Otvoriť' },
      { action: 'close', title: 'Zavrieť' }
    ],
    requireInteraction: false,
    tag: 'pumplo-notification',
    renotify: true
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'close') {
    return;
  }
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Try to focus existing window
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        // Open new window if none exists
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed');
});
