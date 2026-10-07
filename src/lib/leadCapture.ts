// When the e-mail prompt on the machine page (/s/<code>) may appear.
// Once sent: never again on this device (localStorage + long cookie, either one blocks).
export const LEAD_PROMPT_DELAY_MS = 800; // right away, after the page layout settles
export const LEAD_DISMISS_DAYS = 7;
export const LEAD_THANKS_MS = 3_000;
export const LEAD_STORAGE_KEY = 'pumplo_lead_prompt';
// Cookies live on .pumplo.com, so app.pumplo.com/s/ and the website (flyer prompt) share them.
const LEAD_COOKIE = 'pumplo_lead=1';
const LEAD_DISMISSED_COOKIE = 'pumplo_lead_dismissed=1';
const hasCookie = (cookie: string, c: string) => cookie.split(';').some((x) => x.trim() === c);
export const leadCookieDomain = (hostname: string): string =>
  hostname === 'pumplo.com' || hostname.endsWith('.pumplo.com') ? '; Domain=pumplo.com' : '';

type Stored = { state: 'dismissed' | 'submitted'; at: number };
const parse = (raw: string | null): Stored | null => {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if ((v?.state === 'dismissed' || v?.state === 'submitted') && typeof v.at === 'number') return v;
  } catch { /* corrupted value counts as nothing stored */ }
  return null;
};

// Why the prompt stayed hidden on this device — logged as lead_prompt_skipped.reason.
export type LeadSkipReason = 'native_app' | 'logged_in' | 'already_submitted' | 'dismissed_recently';

const storedBlock = (raw: string | null, cookie: string, now: number): 'already_submitted' | 'dismissed_recently' | null => {
  if (hasCookie(cookie, LEAD_COOKIE)) return 'already_submitted';
  const stored = parse(raw);
  if (stored?.state === 'submitted') return 'already_submitted';
  if (hasCookie(cookie, LEAD_DISMISSED_COOKIE)) return 'dismissed_recently'; // expires after LEAD_DISMISS_DAYS
  if (!stored) return null;
  if (stored.state === 'submitted') return 'already_submitted';
  return now - stored.at > LEAD_DISMISS_DAYS * 86_400_000 ? null : 'dismissed_recently';
};

export const shouldAutoShowLeadPrompt = (raw: string | null, cookie: string, now: number): boolean =>
  storedBlock(raw, cookie, now) === null;

// null = show the prompt. Priority: native app, then this device's stored choice, then login.
export const leadPromptSkipReason = ({ native, raw, cookie, now, loggedIn }: {
  native: boolean; raw: string | null; cookie: string; now: number; loggedIn: boolean;
}): LeadSkipReason | null => {
  if (native) return 'native_app';
  return storedBlock(raw, cookie, now) ?? (loggedIn ? 'logged_in' : null);
};

export const leadPromptRecord = (state: Stored['state'], now: number): string => JSON.stringify({ state, at: now });

export const isValidLeadEmail = (raw: string): boolean => {
  const email = raw.trim().toLowerCase();
  return email.length >= 6 && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
};

export const readLeadPromptState = (): string | null => {
  try { return window.localStorage.getItem(LEAD_STORAGE_KEY); } catch { return null; }
};

export const writeLeadPromptState = (state: Stored['state']): void => {
  try { window.localStorage.setItem(LEAD_STORAGE_KEY, leadPromptRecord(state, Date.now())); } catch { /* private mode */ }
  try {
    const domain = leadCookieDomain(window.location.hostname);
    document.cookie = state === 'submitted'
      ? `${LEAD_COOKIE}; Max-Age=34560000; Path=/; SameSite=Lax${domain}`
      : `${LEAD_DISMISSED_COOKIE}; Max-Age=${LEAD_DISMISS_DAYS * 86_400}; Path=/; SameSite=Lax${domain}`;
  } catch { /* blocked */ }
};

// Card top in layout-viewport px: aligned with the exercise title, but kept inside the
// visible area (iOS scrolls the visual viewport by offsetTop when the keyboard opens).
export const leadCardTop = (titleTop: number | null, vvHeight: number, vvOffsetTop: number): number | null =>
  titleTop === null ? null : Math.max(vvOffsetTop + 72, Math.min(titleTop, vvOffsetTop + vvHeight - 200));
