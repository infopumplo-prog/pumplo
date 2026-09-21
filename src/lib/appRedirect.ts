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

  // iOS: the custom scheme is unusable here. When the app isn't installed,
  // Safari answers `com.pumplo.app://…` with a blocking "address is invalid"
  // alert that fires instantly — before any timeout-based store fallback can
  // run — so the visitor sees an error instead of the app. Sending iOS to the
  // App Store costs installed users one extra tap ("Open" on the listing) and
  // shows everyone else exactly what they need. Universal Links are the real
  // fix and need an apple-app-site-association file plus an `applinks:`
  // entitlement in a new build; until that ships, the store is the safe route.
  // iOS (21. 9.): pokus o otevření appky přes skrytý iframe s custom schématem —
  // když je appka nainstalovaná, otevře se (a stránka se schová); když ne, iframe
  // tiše selže a po chvíli pošleme do App Storu. Universal Links na app.pumplo.com
  // navíc otevírají appku rovnou z odkazu ve WhatsAppu/SMS.
  const started = Date.now();
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = `com.pumplo.app://${path}`;
  document.body.appendChild(iframe);
  window.setTimeout(() => {
    iframe.remove();
    const stillHere = !document.hidden && Date.now() - started < 3000;
    if (stillHere) window.location.href = APP_STORE_URL;
  }, 1800);
  return true;
};

export { APP_STORE_URL, PLAY_STORE_URL };
