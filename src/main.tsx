import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/capacitor";
import * as SentryReact from "@sentry/react";
import { registerSW } from "virtual:pwa-register";
import { Capacitor } from "@capacitor/core";
import App from "./App.tsx";

// On native, kill any service worker + caches left over from a previous build.
// An old SW persisting in the WKWebView would keep serving stale JS bundles.
if (Capacitor.isNativePlatform()) {
  (async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      }
    } catch (e) {
      console.error('[native cleanup]', e);
    }
  })();
}
import "./index.css";
import "./i18n";
import { 
  checkForVersionMismatch, 
  wasVersionCheckedThisSession, 
  forceAppRefresh,
  getBuildTimestamp 
} from "./lib/appVersion";

// Version check on startup (only if not already checked this session)
if (!wasVersionCheckedThisSession() && checkForVersionMismatch()) {
  console.log('[Main] Version mismatch detected, forcing refresh...');
  forceAppRefresh();
} else {
  console.log('[Main] App version:', getBuildTimestamp());
}

// Global state for update banner (will be consumed by App)
let showUpdateBannerCallback: (() => void) | null = null;

export function setUpdateBannerCallback(callback: () => void) {
  showUpdateBannerCallback = callback;
}

function triggerUpdateBanner() {
  if (showUpdateBannerCallback) {
    showUpdateBannerCallback();
  }
}

// Register service worker for PWA — web/PWA only. On native (Capacitor) the SW
// would cache and serve stale JS bundles inside the WKWebView, so we skip it.
const noopUpdateSW = async (_reloadPage?: boolean): Promise<void> => {};
const updateSW = Capacitor.isNativePlatform() ? noopUpdateSW : registerSW({
onNeedRefresh() {
    console.log('[Main] New version available, auto-updating...');
    triggerUpdateBanner();
    // Auto-update after 1.5s delay (banner shows countdown)
    setTimeout(() => {
      updateSW(true).catch(() => window.location.reload());
    }, 1500);
  },
  onOfflineReady() {
    console.log("[Main] Pumplo je připravená na offline použitie!");
  },
  onRegisteredSW(swUrl, registration) {
    console.log("[Main] Service worker registered:", swUrl);
    if (registration) {
      // Check for updates immediately on startup
      registration.update().catch(err => {
        console.warn('[Main] SW update check failed:', err);
      });
      
      // Check immediately when app becomes visible (e.g. user switches back)
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && registration) {
          console.log('[Main] App became visible, checking for updates...');
          registration.update().catch(err => {
            console.warn('[Main] SW update check failed:', err);
          });
        }
      });

      // Check every 5 minutes when app is active
      setInterval(() => {
        if (!document.hidden) {
          console.log('[Main] Checking for SW updates...');
          registration.update().catch(err => {
            console.warn('[Main] SW update check failed:', err);
          });
        }
      }, 5 * 60 * 1000);
    }
  },
  onRegisterError(error) {
    console.error("[Main] Service worker registration failed:", error);
  },
});

// Export updateSW for use in components
export { updateSW };

// Sběr chyb: bez DSN (lokální dev) se Sentry neinicializuje a nic neposílá.
// Projekt do 17. 9. 2026 žádný sběr chyb neměl — tichá selhání (ztráta tréninku
// 23. 8.) se nedala zpětně dohledat.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
if (sentryDsn) {
  Sentry.init(
    {
      dsn: sentryDsn,
      release: `pumplo@${import.meta.env.VITE_APP_VERSION ?? "1.3.0"}`,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
    },
    SentryReact.init,
  );
}

createRoot(document.getElementById("root")!).render(<App />);
