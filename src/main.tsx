import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { Capacitor } from "@capacitor/core";
import { dbg } from "./lib/debugOverlay";
import App from "./App.tsx";

// TEMP: prove our bundle is the one running (paints before React mounts).
dbg('MAIN loaded — native=' + Capacitor.isNativePlatform() + ' platform=' + Capacitor.getPlatform());

// On native, kill any service worker + caches left over from a previous build.
// An old SW persisting in the WKWebView would keep serving stale JS bundles.
if (Capacitor.isNativePlatform()) {
  (async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        dbg('native cleanup — found ' + regs.length + ' service workers');
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const names = await caches.keys();
        dbg('native cleanup — found ' + names.length + ' caches');
        await Promise.all(names.map((n) => caches.delete(n)));
      }
    } catch (e) {
      dbg('native cleanup error: ' + String(e));
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

createRoot(document.getElementById("root")!).render(<App />);
