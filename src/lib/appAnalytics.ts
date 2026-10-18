// In-app measurement (native only): Firebase Analytics + Meta App Events behind the
// user's consent. Every call is a no-op on the web build and without consent.
// Pure logic: appAnalyticsCore.ts; consent storage: appConsent.ts.
import { Capacitor } from '@capacitor/core';
import { FirebaseAnalytics, ConsentType, ConsentStatus } from '@capacitor-firebase/analytics';
import { AppTrackingTransparency } from '@capgo/capacitor-app-tracking-transparency';
import { FacebookAnalytics } from '@capgo/capacitor-facebook-analytics';
import { InstallReferrer } from '@capgo/capacitor-install-referrer';
import { META_ENABLED } from './analyticsConfig';
import { readAppConsent, writeAppConsent, type AppConsent } from './appConsent';
import { createAnalyticsCore, screenNameFromPath, type AnalyticsEvent, type PendingEvent } from './appAnalyticsCore';
import { parseInstallReferrer, type InstallAttribution } from './installReferrer';

const PENDING_KEY = 'pumplo_analytics_pending';
const REFERRER_KEY = 'pumplo_install_referrer';
const FIRST_WORKOUT_KEY = 'pumplo_first_workout_tracked';

const isNative = () => Capacitor.isNativePlatform();
const isIOS = () => Capacitor.getPlatform() === 'ios';

let metaReady = false;
let lastScreen: string | null = null;

// ── UI coordination (consent screen) ─────────────────────────────────────────
type UiListener = () => void;
const uiListeners = new Set<UiListener>();
let workoutActive = false;
let promptRequested: 'first' | 'settings' | null = null;
const notifyUi = () => uiListeners.forEach((l) => l());

export const onAnalyticsUiChange = (l: UiListener) => { uiListeners.add(l); return () => { uiListeners.delete(l); }; };
export const isWorkoutActive = () => workoutActive;
export const setWorkoutActive = (active: boolean) => { workoutActive = active; notifyUi(); };
/** 'first' = onboarding just finished; 'settings' = reopen from Settings. Consumed by the screen. */
export const takeConsentPromptRequest = () => { const r = promptRequested; promptRequested = null; return r; };
export const openAppConsentSettings = () => { promptRequested = 'settings'; notifyUi(); };

const storageGet = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const storageSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* noop */ } };

/** The stored choice; `null` = not decided yet. Always "nothing" off native. */
export const getAppConsent = (): AppConsent | null =>
  isNative() ? readAppConsent() : { analytics: false, marketing: false };

const core = createAnalyticsCore({
  getConsent: getAppConsent,
  isMetaReady: () => metaReady,
  firebaseLog: (name, params) => FirebaseAnalytics.logEvent({ name, params }),
  metaLog: (event, params) => FacebookAnalytics.logEvent({ event, params }),
  loadPending: () => {
    try { return (JSON.parse(storageGet(PENDING_KEY) ?? '[]') as PendingEvent[]) ?? []; } catch { return []; }
  },
  savePending: (list) => storageSet(PENDING_KEY, JSON.stringify(list)),
});

export const track = (name: AnalyticsEvent, params?: Record<string, unknown>) => {
  if (!isNative()) return;
  core.track(name, params);
};

const trackingAuthorized = async (requestIfUndetermined: boolean): Promise<boolean> => {
  if (!isIOS()) return true;
  try {
    let { status } = await AppTrackingTransparency.getStatus();
    if (status === 'notDetermined' && requestIfUndetermined) ({ status } = await AppTrackingTransparency.requestPermission());
    return status === 'authorized';
  } catch {
    return false;
  }
};

const applyConsent = async (c: AppConsent) => {
  // Ads signals only exist with Meta configured; without it we never ask for tracking (no ATT prompt, no ad storage).
  // Marketing on iOS needs the system tracking permission; asked only for this choice.
  const adsAllowed = META_ENABLED && c.marketing && (await trackingAuthorized(true));
  const status = (on: boolean) => (on ? ConsentStatus.Granted : ConsentStatus.Denied);
  try {
    await FirebaseAnalytics.setConsent({ type: ConsentType.AnalyticsStorage, status: status(c.analytics) });
    await FirebaseAnalytics.setConsent({ type: ConsentType.AdStorage, status: status(adsAllowed) });
    await FirebaseAnalytics.setConsent({ type: ConsentType.AdUserData, status: status(adsAllowed) });
    await FirebaseAnalytics.setConsent({ type: ConsentType.AdPersonalization, status: status(adsAllowed) });
    await FirebaseAnalytics.setEnabled({ enabled: c.analytics });
  } catch { /* Firebase unavailable: nothing is collected either */ }

  if (META_ENABLED && adsAllowed) {
    try {
      if (!metaReady) await FacebookAnalytics.initAppEvents();
      await FacebookAnalytics.enableAdvertiserTracking();
      metaReady = true;
    } catch { metaReady = false; }
  } else {
    if (metaReady) await FacebookAnalytics.disableAdvertiserTracking().catch(() => {});
    metaReady = false;
  }
};

type StoredReferrer = InstallAttribution & { reported: boolean };

/** Android: read the Play install referrer once; report it only with analytics consent. */
const processInstallReferrer = async () => {
  if (Capacitor.getPlatform() !== 'android') return;
  let stored: StoredReferrer | null = null;
  try { stored = JSON.parse(storageGet(REFERRER_KEY) ?? 'null'); } catch { stored = null; }
  if (!stored) {
    try {
      const { referrer } = await InstallReferrer.getReferrer();
      stored = { ...parseInstallReferrer(referrer), reported: false };
      storageSet(REFERRER_KEY, JSON.stringify(stored));
    } catch { return; /* Play services unavailable: try again next launch */ }
  }
  if (stored.reported || !stored.installSource || !getAppConsent()?.analytics) return;
  try {
    await FirebaseAnalytics.setUserProperty({ key: 'install_source', value: stored.installSource });
    if (stored.scanId) track('install_attributed', { scan_id: stored.scanId });
    storageSet(REFERRER_KEY, JSON.stringify({ ...stored, reported: true }));
  } catch { /* retried next launch */ }
};

/** App start: re-apply a stored choice (native defaults keep everything off otherwise). */
export const initAppAnalytics = () => {
  if (!isNative()) return;
  const c = readAppConsent();
  void (async () => {
    if (c) await applyConsent(c);
    await processInstallReferrer();
  })();
};

/** Stores the user's choice, applies it natively and releases or drops held events. */
export const saveAppConsent = async (c: AppConsent) => {
  if (!isNative()) return;
  writeAppConsent(c);
  await applyConsent(c);
  core.flushPending();
  notifyUi();
  await processInstallReferrer();
};

// ── Events ───────────────────────────────────────────────────────────────────
export const trackSignUp = (method: 'email' | 'google' | 'apple') => track('sign_up', { method });

export const trackTutorialComplete = () => {
  track('tutorial_complete');
  promptRequested = promptRequested ?? 'first';
  notifyUi();
};

export const trackSelectGym = (gymId: string) => track('select_gym', { gym_id: gymId });

export const trackWorkoutStart = (resumed: boolean) => track('workout_start', { resumed });

export const trackWorkoutComplete = (isBonus: boolean) => track('workout_complete', { is_bonus: isBonus });

/** first_workout once per device, when the user's stored history holds exactly this session. */
export const trackFirstWorkoutIfFirst = async (countSessions: () => Promise<number | null>) => {
  if (!isNative() || storageGet(FIRST_WORKOUT_KEY)) return;
  const c = getAppConsent();
  if (c && !c.analytics && !c.marketing) return;
  const count = await countSessions().catch(() => null);
  if (count === 1) {
    storageSet(FIRST_WORKOUT_KEY, '1');
    track('first_workout');
  }
};

export const trackScreen = (pathname: string) => {
  const name = screenNameFromPath(pathname);
  if (name === lastScreen) return;
  lastScreen = name;
  track('screen_view', { screen_name: name, screen_class: name });
};

/** Only app routes (plan / cvik) — never the raw URL, which can carry auth tokens. */
export const trackDeepLink = (route: string) => track('app_open_deeplink', { path: screenNameFromPath(route) });
