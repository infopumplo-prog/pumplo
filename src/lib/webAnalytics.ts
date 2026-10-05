// GA4 + Meta Pixel for the public web pages of app.pumplo.com (QR machine pages),
// behind per-category cookie consent (basic Consent Mode v2). Same IDs as pumplo.com,
// so both sites feed one GA4 property and one Pixel. Never runs in the native app.
import { Capacitor } from '@capacitor/core';

export const GA_MEASUREMENT_ID = 'G-HXXC0FX8SQ';
export const META_PIXEL_ID = '1577216264451707';

const CONSENT_KEY = 'pumplo_cookie_consent';
export const CONSENT_VERSION = 2;
export const COOKIE_SETTINGS_EVENT = 'pumplo:cookie-settings';

export type ConsentCategories = { analytics: boolean; marketing: boolean };

type Gtag = (...args: unknown[]) => void;
type Fbq = ((...args: unknown[]) => void) & {
  queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown; callMethod?: (...a: unknown[]) => void;
};
declare global {
  interface Window { dataLayer?: unknown[]; gtag?: Gtag; fbq?: Fbq; _fbq?: Fbq }
}

let gaLoaded = false;
let pixelLoaded = false;

/** Native app and the build-time headless browser never load trackers or show the banner. */
export const trackingDisabled = (): boolean =>
  Capacitor.isNativePlatform() || (typeof navigator !== 'undefined' && navigator.webdriver === true);

export const parseConsent = (raw: string | null): ConsentCategories | null => {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (v?.v !== CONSENT_VERSION) return null;
    return { analytics: !!v.analytics, marketing: !!v.marketing };
  } catch {
    return null;
  }
};

export const getConsent = (): ConsentCategories | null => {
  try { return parseConsent(window.localStorage.getItem(CONSENT_KEY)); } catch { return null; }
};

const saveConsent = (c: ConsentCategories) => {
  try {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify({ ...c, v: CONSENT_VERSION, ts: new Date().toISOString() }));
  } catch { /* storage blocked: the choice still applies for this page view */ }
};

const loadGA = (marketing: boolean) => {
  if (gaLoaded || trackingDisabled()) return;
  gaLoaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // gtag.js expects the arguments object, not an array.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  const ads = marketing ? 'granted' : 'denied';
  window.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: ads, ad_user_data: ads, ad_personalization: ads });
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID);
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(s);
};

const loadPixel = () => {
  if (pixelLoaded || trackingDisabled()) return;
  pixelLoaded = true;
  // Standard Meta Pixel bootstrap: queue calls until fbevents.js arrives.
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue!.push(args);
  } as Fbq;
  fbq.queue = []; fbq.loaded = true; fbq.version = '2.0'; fbq.push = fbq;
  window.fbq = fbq; window._fbq = fbq;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(s);
  fbq('init', META_PIXEL_ID);
  fbq('track', 'PageView');
};

const apply = (c: ConsentCategories) => {
  if (c.analytics) loadGA(c.marketing);
  if (c.marketing) loadPixel();
};

/** Loads only what the visitor accepted earlier. */
export const initWebAnalytics = () => {
  const c = getConsent();
  if (c) apply(c);
};

export const setConsent = (c: ConsentCategories) => {
  const previous = getConsent();
  saveConsent(c);
  apply(c);
  if (gaLoaded && window.gtag) {
    const ads = c.marketing ? 'granted' : 'denied';
    window.gtag('consent', 'update', { analytics_storage: c.analytics ? 'granted' : 'denied', ad_storage: ads, ad_user_data: ads, ad_personalization: ads });
  }
  if (pixelLoaded && window.fbq) window.fbq('consent', c.marketing ? 'grant' : 'revoke');
  const drop = (prefixes: string[]) =>
    document.cookie.split(';').forEach((ck) => {
      const name = ck.split('=')[0].trim();
      if (prefixes.some((p) => name.startsWith(p))) {
        document.cookie = `${name}=; Max-Age=0; path=/; domain=.${location.hostname.replace(/^www\./, '')}`;
        document.cookie = `${name}=; Max-Age=0; path=/`;
      }
    });
  if (previous?.analytics && !c.analytics) drop(['_ga']);
  if (previous?.marketing && !c.marketing) drop(['_fbp', '_fbc', '_gcl']);
};

/** GA4 event; no-op without analytics consent. */
export const trackEvent = (name: string, params: Record<string, unknown> = {}) => {
  if (gaLoaded && window.gtag) window.gtag('event', name, params);
};

/** Meta Pixel standard event; no-op without marketing consent. */
export const trackPixel = (name: string, params: Record<string, unknown> = {}) => {
  if (pixelLoaded && window.fbq) window.fbq('track', name, params);
};

export const openCookieSettings = () => window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT));
