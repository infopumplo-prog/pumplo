// Platform-free core of in-app analytics: consent gating, the pre-consent queue,
// the parameter whitelist (no personal data ever leaves) and the Meta mapping.
// Native wiring lives in appAnalytics.ts.
import type { AppConsent } from './appConsent';

export type AnalyticsEvent =
  | 'sign_up'
  | 'tutorial_complete'
  | 'select_gym'
  | 'workout_start'
  | 'workout_complete'
  | 'first_workout'
  | 'screen_view'
  | 'app_open_deeplink'
  | 'install_attributed';

export type EventParams = Record<string, string | number | boolean>;
export type PendingEvent = { name: AnalyticsEvent; params: EventParams };

const ALLOWED_PARAMS: Record<AnalyticsEvent, readonly string[]> = {
  sign_up: ['method'],
  tutorial_complete: [],
  select_gym: ['gym_id'],
  workout_start: ['resumed'],
  workout_complete: ['is_bonus'],
  first_workout: [],
  screen_view: ['screen_name', 'screen_class'],
  app_open_deeplink: ['path'],
  install_attributed: ['scan_id'],
};

export const META_EVENTS: Partial<Record<AnalyticsEvent, string>> = {
  sign_up: 'fb_mobile_complete_registration',
  tutorial_complete: 'TutorialComplete',
  workout_complete: 'WorkoutComplete',
  first_workout: 'FirstWorkout',
};

export const MAX_PENDING = 20;
const MAX_STRING = 100;
// Screen views are too noisy to hold for later and meaningless after the fact.
const NOT_QUEUED: ReadonlySet<AnalyticsEvent> = new Set(['screen_view']);

export const sanitizeParams = (name: AnalyticsEvent, params: Record<string, unknown> = {}): EventParams => {
  const out: EventParams = {};
  for (const key of ALLOWED_PARAMS[name]) {
    const v = params[key];
    if (typeof v === 'string') out[key] = v.slice(0, MAX_STRING);
    else if (typeof v === 'number' || typeof v === 'boolean') out[key] = v;
  }
  return out;
};

export interface AnalyticsCoreDeps {
  getConsent: () => AppConsent | null;
  isMetaReady: () => boolean;
  firebaseLog: (name: string, params: EventParams) => unknown;
  metaLog: (name: string, params: EventParams) => unknown;
  loadPending: () => PendingEvent[];
  savePending: (list: PendingEvent[]) => void;
}

const safely = (fn: () => unknown) => {
  try {
    const r = fn();
    if (r && typeof (r as Promise<unknown>).catch === 'function') (r as Promise<unknown>).catch(() => {});
  } catch { /* analytics must never break the app */ }
};

export const createAnalyticsCore = (deps: AnalyticsCoreDeps) => {
  const send = (name: AnalyticsEvent, params: EventParams, consent: AppConsent) => {
    if (consent.analytics) safely(() => deps.firebaseLog(name, params));
    const metaName = META_EVENTS[name];
    if (consent.marketing && metaName && deps.isMetaReady()) safely(() => deps.metaLog(metaName, params));
  };

  const track = (name: AnalyticsEvent, params?: Record<string, unknown>) => {
    const clean = sanitizeParams(name, params);
    const consent = deps.getConsent();
    if (consent === null) {
      if (NOT_QUEUED.has(name)) return;
      try { deps.savePending([...deps.loadPending(), { name, params: clean }].slice(-MAX_PENDING)); } catch { /* noop */ }
      return;
    }
    send(name, clean, consent);
  };

  /** After the first decision: replay held events if allowed, otherwise discard them. */
  const flushPending = () => {
    let held: PendingEvent[] = [];
    try { held = deps.loadPending(); deps.savePending([]); } catch { /* noop */ }
    const consent = deps.getConsent();
    if (!consent) return;
    for (const e of held) {
      if (ALLOWED_PARAMS[e.name]) send(e.name, sanitizeParams(e.name, e.params), consent);
    }
  };

  return { track, flushPending };
};

const ID_ROUTES = new Set(['plan', 'cvik', 's', 'go', 'custom-plan', 'custom-workout']);
const looksLikeId = (seg: string) => /^\d+$/.test(seg) || /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(seg);

/** Route pattern for screen_view / deeplink params: ids and share tokens become `:id`. */
export const screenNameFromPath = (path: string): string => {
  const clean = path.split(/[?#]/)[0] || '/';
  const segs = clean.split('/').filter(Boolean);
  const out = segs.map((seg, i) => {
    if (i === 1 && ID_ROUTES.has(segs[0])) return ':id';
    if (i === 2 && segs[0] === 'messages' && segs[1] === 'chat') return ':id';
    return looksLikeId(seg) ? ':id' : seg;
  });
  return `/${out.join('/')}`;
};

type MaybeOAuthUser = {
  app_metadata?: { provider?: string };
  created_at?: string;
  last_sign_in_at?: string;
};

/** 'google' | 'apple' when this SIGNED_IN belongs to an account created moments ago. */
export const newOAuthSignupMethod = (user: MaybeOAuthUser): 'google' | 'apple' | null => {
  const provider = user.app_metadata?.provider;
  if (provider !== 'google' && provider !== 'apple') return null;
  if (!user.created_at || !user.last_sign_in_at) return null;
  const gap = Math.abs(Date.parse(user.last_sign_in_at) - Date.parse(user.created_at));
  return Number.isFinite(gap) && gap <= 60_000 ? provider : null;
};
