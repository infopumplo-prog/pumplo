import { Capacitor } from '@capacitor/core';

/**
 * Web app gate — keeps the member web app from being used as a substitute for
 * the native/installed app. In a plain browser tab every route EXCEPT the
 * public allowlist funnels the user into the app (or the store). Native builds
 * and installed PWAs are always let through.
 */

// Paths that stay fully accessible in a plain browser tab (teasers + legal +
// auth callbacks). Everything else — including the sticker (/s/) and shared
// plan (/plan/) — is gated and funnels to the app/store. Only legal pages
// (required public for App Store / Play review) and the password-reset auth
// callback stay reachable in a plain browser.
const PUBLIC_PREFIXES: string[] = [];
const PUBLIC_EXACT = ['/privacy', '/terms', '/reset-password'];

/** True when running inside the native (Capacitor) shell. */
export const isNativeApp = (): boolean => Capacitor.isNativePlatform();

/** True when launched as an installed PWA (standalone display mode). */
export const isStandalonePWA = (): boolean => {
  if (typeof window === 'undefined') return false;
  const mql = window.matchMedia?.('(display-mode: standalone)')?.matches ?? false;
  // iOS Safari exposes navigator.standalone for home-screen web apps.
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return mql || iosStandalone;
};

/** True only for an ordinary browser tab — the case the gate targets. */
export const isPlainBrowser = (): boolean => !isNativeApp() && !isStandalonePWA();

/** True when the given path is allowed to render in a plain browser tab. */
export const isPublicWebPath = (pathname: string): boolean => {
  if (PUBLIC_EXACT.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
};
