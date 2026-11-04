// In-app measurement consent (native app only). Separate from the QR web pages'
// cookie consent in webAnalytics.ts. Bump the version to ask everyone again.
export const APP_CONSENT_KEY = 'pumplo_app_consent';
export const APP_CONSENT_VERSION = 1;

export type AppConsent = { analytics: boolean; marketing: boolean };

type ReadStorage = Pick<Storage, 'getItem'>;
type WriteStorage = Pick<Storage, 'setItem'>;

const defaultStorage = (): Storage | null => {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
};

export const parseAppConsent = (raw: string | null): AppConsent | null => {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (v?.v !== APP_CONSENT_VERSION) return null;
    return { analytics: !!v.analytics, marketing: !!v.marketing };
  } catch {
    return null;
  }
};

export const readAppConsent = (storage: ReadStorage | null = defaultStorage()): AppConsent | null => {
  try { return parseAppConsent(storage?.getItem(APP_CONSENT_KEY) ?? null); } catch { return null; }
};

export const writeAppConsent = (c: AppConsent, storage: WriteStorage | null = defaultStorage()): void => {
  try {
    storage?.setItem(APP_CONSENT_KEY, JSON.stringify({ v: APP_CONSENT_VERSION, analytics: c.analytics, marketing: c.marketing, ts: new Date().toISOString() }));
  } catch { /* storage blocked: the choice still applies for this session */ }
};

// Never interrupt sign-in, public share pages, the policy itself or a workout.
const CONSENT_BLOCKED_PREFIXES = ['/auth', '/reset-password', '/privacy', '/terms', '/install', '/plan/', '/cvik/', '/s/', '/go/', '/custom-workout/'];

export const isConsentBlockedPath = (pathname: string): boolean =>
  CONSENT_BLOCKED_PREFIXES.some((p) => pathname.startsWith(p));

/**
 * The first-run consent sheet is on screen or about to be, so nothing else may open
 * over it. `consent` stays null only in the native app (the web gets a fixed answer).
 */
export const isConsentPromptPending = ({ hasUser, consent, pathname, workoutActive }: {
  hasUser: boolean;
  consent: AppConsent | null;
  pathname: string;
  workoutActive: boolean;
}): boolean => hasUser && consent === null && !workoutActive && !isConsentBlockedPath(pathname);
