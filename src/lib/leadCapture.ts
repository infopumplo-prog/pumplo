// When the e-mail prompt on the machine page (/s/<code>) may appear.
// Once sent: never again on this device (localStorage + long cookie, either one blocks).
export const LEAD_PROMPT_DELAY_MS = 800; // right away, after the page layout settles
export const LEAD_DISMISS_DAYS = 7;
export const LEAD_THANKS_MS = 3_000;
export const LEAD_STORAGE_KEY = 'pumplo_lead_prompt';
const LEAD_COOKIE = 'pumplo_lead=1';

type Stored = { state: 'dismissed' | 'submitted'; at: number };
const parse = (raw: string | null): Stored | null => {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if ((v?.state === 'dismissed' || v?.state === 'submitted') && typeof v.at === 'number') return v;
  } catch { /* corrupted value counts as nothing stored */ }
  return null;
};

export const shouldAutoShowLeadPrompt = (raw: string | null, cookie: string, now: number): boolean => {
  if (cookie.split(';').some((c) => c.trim() === LEAD_COOKIE)) return false;
  const stored = parse(raw);
  if (!stored) return true;
  if (stored.state === 'submitted') return false;
  return now - stored.at > LEAD_DISMISS_DAYS * 86_400_000;
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
  if (state === 'submitted') {
    try { document.cookie = `${LEAD_COOKIE}; Max-Age=34560000; Path=/; SameSite=Lax`; } catch { /* blocked */ }
  }
};

// Card top in layout-viewport px: aligned with the exercise title, but kept inside the
// visible area (iOS scrolls the visual viewport by offsetTop when the keyboard opens).
export const leadCardTop = (titleTop: number | null, vvHeight: number, vvOffsetTop: number): number | null =>
  titleTop === null ? null : Math.max(vvOffsetTop + 72, Math.min(titleTop, vvOffsetTop + vvHeight - 200));
