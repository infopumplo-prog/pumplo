// BUILD_TIMESTAMP is injected at build time via vite.config.ts
declare const __BUILD_TIMESTAMP__: number;

export const BUILD_TIMESTAMP = typeof __BUILD_TIMESTAMP__ !== 'undefined' 
  ? __BUILD_TIMESTAMP__ 
  : Date.now();

const LAST_VERSION_KEY = 'pumplo_last_version';
const VERSION_CHECK_KEY = 'pumplo_version_checked';

/**
 * Check if the current app version differs from the last known version.
 * Returns true if there's a version mismatch (new version available).
 */
export function checkForVersionMismatch(): boolean {
  try {
    const lastVersion = localStorage.getItem(LAST_VERSION_KEY);
    const currentVersion = BUILD_TIMESTAMP.toString();
    
    // First run - no mismatch, just store current version
    if (!lastVersion) {
      localStorage.setItem(LAST_VERSION_KEY, currentVersion);
      return false;
    }
    
    // Version mismatch detected
    if (lastVersion !== currentVersion) {
      console.log('[AppVersion] Version mismatch detected:', { lastVersion, currentVersion });
      return true;
    }
    
    return false;
  } catch (e) {
    console.error('[AppVersion] Error checking version:', e);
    return false;
  }
}

/**
 * Mark the current version as updated (after a successful refresh)
 */
export function markVersionUpdated(): void {
  try {
    localStorage.setItem(LAST_VERSION_KEY, BUILD_TIMESTAMP.toString());
    sessionStorage.setItem(VERSION_CHECK_KEY, 'true');
    console.log('[AppVersion] Version marked as updated:', BUILD_TIMESTAMP);
  } catch (e) {
    console.error('[AppVersion] Error marking version:', e);
  }
}

/**
 * Check if we already performed a version check in this session
 * (to prevent infinite reload loops)
 */
export function wasVersionCheckedThisSession(): boolean {
  try {
    return sessionStorage.getItem(VERSION_CHECK_KEY) === 'true';
  } catch (e) {
    return false;
  }
}

/**
 * Clear all caches and force reload the application
 */
export async function forceAppRefresh(): Promise<void> {
  console.log('[AppVersion] Forcing app refresh...');
  
  try {
    // Clear service worker caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      console.log('[AppVersion] Cleared', cacheNames.length, 'caches');
    }
    
    // Unregister service workers to force fresh install
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
      console.log('[AppVersion] Unregistered', registrations.length, 'service workers');
    }
    
    // Mark as updated before reload
    markVersionUpdated();
    
    // Force reload from server
    window.location.reload();
  } catch (e) {
    console.error('[AppVersion] Error during force refresh:', e);
    // Still try to reload even if cache clearing fails
    window.location.reload();
  }
}

/**
 * Get the current build timestamp for debugging
 */
export function getBuildTimestamp(): number {
  return BUILD_TIMESTAMP;
}
