import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";
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

// Register service worker for PWA with injectManifest strategy
const updateSW = registerSW({
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
