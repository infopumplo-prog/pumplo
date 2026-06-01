const APP_STORE_URL = 'https://apps.apple.com/app/pumplo/id6768619318';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.pumplo.app';

/**
 * Opens the Pumplo native app at the given deep-link path, falling back to the
 * platform's app store when the app isn't installed.
 *
 * `path` is the part after `com.pumplo.app://` — e.g. "station" or
 * "plan/abc123". The custom scheme `com.pumplo.app` is registered in both the
 * iOS (CFBundleURLSchemes) and Android (intent-filter) builds.
 *
 * Returns `true` on mobile (an app-open was attempted), `false` on desktop —
 * where there is no app, so the caller decides what to do (e.g. send to the
 * store or keep a web flow).
 */
export const openAppOrStore = (path: string): boolean => {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);

  if (!isIOS && !isAndroid) {
    return false;
  }

  // Android: an intent URL lets the OS open the app, or fall back to Play
  // automatically when it isn't installed — no timing guesswork needed.
  if (isAndroid) {
    const fallback = encodeURIComponent(PLAY_STORE_URL);
    window.location.href =
      `intent://${path}#Intent;scheme=com.pumplo.app;package=com.pumplo.app;S.browser_fallback_url=${fallback};end`;
    return true;
  }

  // iOS: try the app scheme. If the page is still visible after a moment the
  // app didn't open (not installed), so fall back to the App Store.
  let appOpened = false;
  const markOpened = () => { appOpened = true; };
  document.addEventListener('visibilitychange', markOpened);
  window.addEventListener('pagehide', markOpened);
  window.addEventListener('blur', markOpened);

  window.location.href = `com.pumplo.app://${path}`;

  window.setTimeout(() => {
    document.removeEventListener('visibilitychange', markOpened);
    window.removeEventListener('pagehide', markOpened);
    window.removeEventListener('blur', markOpened);
    if (!appOpened && document.visibilityState === 'visible') {
      window.location.href = APP_STORE_URL;
    }
  }, 1500);
  return true;
};

export { APP_STORE_URL, PLAY_STORE_URL };
