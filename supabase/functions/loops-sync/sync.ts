// Čistá logika synchronizace do Loops (19. 10. 2026) — bez Deno importů, aby ji šlo
// testovat vitestem z appky (src/lib/loopsSync.test.ts).
//
// Rozdělení práce:
//  - Supabase = zdroj pravdy: kdo smí dostat obchodní e-mail (právní brána), odhlášení,
//    suppressions, interní účty (view email_eligible_users).
//  - Loops = e-maily, editor, časování journeys. Každá obchodní journey v Loops MUSÍ mít
//    audience filtr marketingAllowed = true (docs/email/loops-journeys.md), udržovací
//    M6–M8 navíc retentionEmailsAllowed = true.
//  - Minimalizace dat: do Loops jde JEN kontakt s marketingAllowed = true. Kdo ho ztratí
//    (odmítnutí, odhlášení, stažený souhlas, bounce, smazaný účet), je z Loops smazán.
//
// Do Loops jde jen allowlist vlastností z buildContact(). NIKDY zranění, váha, výška,
// věk, pohlaví ani jiné tělesné/zdravotní údaje.

export const LOOPS_API_BASE = 'https://app.loops.so/api/v1';

/** Události, které loops-sync posílá (názvy = triggery journeys v Loops). */
export const LOOPS_EVENTS = [
  'signed_up',
  'onboarding_completed',
  'plan_ready',
  'first_workout_completed',
  'workout_completed',
  'inactive_21d',
  'plan_slowing',
] as const;
export type LoopsEventName = (typeof LOOPS_EVENTS)[number];

/** Okamžikové události (registrace, dotazník, plán, trénink) jen do 48 h zpět — žádný hromadný backfill historie. */
export const EVENT_LOOKBACK_HOURS = 48;
/** inactive_21d: pražský den 21–24 od posledního tréninku (okno = i když cron pár hodin vynechá). */
export const INACTIVE_DAY_FROM = 21;
export const INACTIVE_DAY_TO = 24;
/** inactive_21d nejvýš 2× za 90 dní (strop M8 z návrhu 1. 10.). */
export const INACTIVE_MAX_PER_90_DAYS = 2;
/** plan_slowing nejvýš jednou za 21 dní. */
export const PLAN_SLOWING_REPEAT_DAYS = 21;
export const SLOWING_MIN_WORKOUTS = 3;
export const SLOWING_MIN_DAYS_SINCE_FIRST = 14;
export const SLOWING_MAX_DAYS_SINCE_LAST = 13;

/** Rate limit Loops: 10 req/s na tým → držíme ~8 req/s a strop na běh. */
export const REQUEST_SPACING_MS = 125;
export const MAX_REQUESTS_PER_RUN = 400;
export const MAX_RETRIES_429 = 3;

/** Vlastnosti kontaktu, které smí do Loops odejít. Nic jiného. */
export const ALLOWED_CONTACT_KEYS = [
  'email',
  'userId',
  'firstName',
  'language',
  'gymName',
  'workoutsCompleted',
  'lastWorkoutAt',
  'signupAt',
  'onboardingCompleted',
  'hasPlan',
  'marketingAllowed',
  'retentionEmailsAllowed',
  'userGroup',
  'subscribed',
] as const;

/** Pole, která do Loops nesmí NIKDY (kontroluje test i CI skript). */
export const FORBIDDEN_FIELDS = [
  'injuries', 'injury', 'injury_note', 'weight', 'weight_kg', 'height', 'height_cm', 'age', 'gender',
  'body', 'bmi', 'health', 'motivations',
] as const;

/**
 * LOOPS_DRY_RUN: výchozí je dry run (jen log, nic do Loops, nic do DB).
 * Naostro jen při výslovném 'false' / '0' / 'no' / 'off'.
 */
export function isLoopsDryRun(envValue: string | null | undefined): boolean {
  if (envValue === null || envValue === undefined) return true;
  return !['false', '0', 'no', 'off'].includes(envValue.trim().toLowerCase());
}

// ─── Pražský kalendář ────────────────────────────────────────────────────────

export function pragueDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

const keyToUtc = (key: string): number => {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

export const daysBetweenKeys = (fromKey: string, toKey: string): number =>
  Math.round((keyToUtc(toKey) - keyToUtc(fromKey)) / 86_400_000);

export const shiftKey = (key: string, days: number): string =>
  new Date(keyToUtc(key) + days * 86_400_000).toISOString().slice(0, 10);

// ─── Právní brána (stejná jako F1 / view email_lifecycle_facts.marketing_ok) ──

export type LegalGate = 'ok' | 'unsubscribed' | 'opted_out' | 'no_legal_basis';

export interface LegalFacts {
  marketingConsentAt: string | null;
  emailOptoutOfferedAt: string | null;
  marketingOptoutAt: string | null;
  emailUnsubscribedAt: string | null;
}

/**
 * § 7 odst. 3 zák. 480/2004 Sb.:
 * souhlas, NEBO (nabídnuté odmítnutí při registraci A neodmítl A neodhlásil se).
 * Odhlášení blokuje vždy; odmítnutí blokuje i souhlas starší než odmítnutí.
 */
export function legalGate(f: LegalFacts): LegalGate {
  if (f.emailUnsubscribedAt) return 'unsubscribed';
  const consent = f.marketingConsentAt ? Date.parse(f.marketingConsentAt) : NaN;
  const optout = f.marketingOptoutAt ? Date.parse(f.marketingOptoutAt) : NaN;
  if (Number.isFinite(consent)) {
    if (Number.isFinite(optout) && optout >= consent) return 'opted_out';
    return 'ok';
  }
  if (f.marketingOptoutAt) return 'opted_out';
  if (f.emailOptoutOfferedAt) return 'ok';
  return 'no_legal_basis';
}

export const marketingAllowed = (f: LegalFacts): boolean => legalGate(f) === 'ok';

// ─── Zpomalení plánu (M7, definice z 1. 10. 2026) ────────────────────────────

export function workoutWindows(dates: string[], todayKey: string): { n14: number; n14prev: number } {
  let n14 = 0;
  let n14prev = 0;
  for (const d of dates) {
    const ago = daysBetweenKeys(d, todayKey);
    if (ago >= 0 && ago <= 13) n14++;
    else if (ago >= 14 && ago <= 27) n14prev++;
  }
  return { n14, n14prev };
}

export const trainingsPerWeek = (planDays: string[] | null | undefined, profileDays: string[] | null | undefined): number | null => {
  const days = planDays?.length ? planDays : profileDays;
  return days?.length ? days.length : null;
};

/**
 * ≥ 3 tréninky, první před ≥ 14 dny, poslední nejvýš před 13 dny, a platí
 * A (n14 < tpw A dny od posledního > 14/tpw) nebo B (n14prev ≥ 2 A n14 ≤ 0,5 × n14prev).
 * workoutDates = pražská data dokončených tréninků vzestupně.
 */
export function isPlanSlowing(workoutDates: string[], tpw: number | null, todayKey: string): boolean {
  if (workoutDates.length < SLOWING_MIN_WORKOUTS) return false;
  const sinceFirst = daysBetweenKeys(workoutDates[0], todayKey);
  const sinceLast = daysBetweenKeys(workoutDates[workoutDates.length - 1], todayKey);
  if (sinceFirst < SLOWING_MIN_DAYS_SINCE_FIRST || sinceLast > SLOWING_MAX_DAYS_SINCE_LAST) return false;
  const { n14, n14prev } = workoutWindows(workoutDates, todayKey);
  const a = tpw !== null && n14 < tpw && sinceLast > 14 / tpw;
  const b = n14prev >= 2 && n14 <= 0.5 * n14prev;
  return a || b;
}

// ─── Řádek z view loops_contact_facts ────────────────────────────────────────

export interface RecentWorkout { id: string; at: string }

/** Řádek view public.loops_contact_facts (migrace 20261019b_loops.sql). Bez zdravotních údajů. */
export interface LoopsFactsRow {
  user_id: string;
  email: string | null;
  first_name: string | null;
  language: string | null;
  signed_up_at: string | null;
  onboarding_completed: boolean;
  selected_gym_id: string | null;
  selected_gym_name: string | null;
  marketing_consent_at: string | null;
  email_optout_offered_at: string | null;
  marketing_optout_at: string | null;
  email_unsubscribed_at: string | null;
  /** user_profiles.notification_comeback (null = výchozí true). */
  notification_comeback: boolean | null;
  completed_workouts: number;
  first_completed_at: string | null;
  last_completed_at: string | null;
  workout_dates: string[] | null;
  training_days: string[] | null;
  plan_training_days: string[] | null;
  first_plan_at: string | null;
  first_gym_plan_at: string | null;
  has_active_plan: boolean;
  recent_workouts: RecentWorkout[] | null;
}

export type LoopsContact = {
  email: string;
  userId: string;
  firstName?: string;
  language: 'cs' | 'en';
  gymName?: string;
  workoutsCompleted: number;
  lastWorkoutAt?: string;
  signupAt?: string;
  onboardingCompleted: boolean;
  hasPlan: boolean;
  marketingAllowed: boolean;
  /** false = uživatel vypnul comeback pushe → žádné udržovací e-maily M6–M8. */
  retentionEmailsAllowed: boolean;
  /** activation = 0 tréninků, retention = ≥ 1 (segmentace v Loops). */
  userGroup: 'activation' | 'retention';
};

const firstWord = (s: string | null | undefined): string | undefined => {
  const w = (s ?? '').trim().split(/\s+/)[0];
  return w ? w.slice(0, 60) : undefined;
};

const isoOrUndef = (s: string | null | undefined): string | undefined => {
  const t = s ? Date.parse(s) : NaN;
  return Number.isFinite(t) ? new Date(t).toISOString() : undefined;
};

/** Kontakt pro Loops — explicitní allowlist, nic se nekopíruje „hromadně“ z řádku. */
export function buildContact(r: LoopsFactsRow): LoopsContact | null {
  const email = (r.email ?? '').trim().toLowerCase();
  if (!email.includes('@')) return null;
  const c: LoopsContact = {
    email,
    userId: r.user_id,
    language: r.language === 'en' ? 'en' : 'cs',
    workoutsCompleted: Math.max(0, Number(r.completed_workouts) || 0),
    onboardingCompleted: r.onboarding_completed === true,
    hasPlan: r.has_active_plan === true,
    marketingAllowed: marketingAllowed({
      marketingConsentAt: r.marketing_consent_at,
      emailOptoutOfferedAt: r.email_optout_offered_at,
      marketingOptoutAt: r.marketing_optout_at,
      emailUnsubscribedAt: r.email_unsubscribed_at,
    }),
    retentionEmailsAllowed: r.notification_comeback !== false,
    userGroup: (Number(r.completed_workouts) || 0) > 0 ? 'retention' : 'activation',
  };
  const firstName = firstWord(r.first_name);
  if (firstName) c.firstName = firstName;
  const gym = (r.selected_gym_name ?? '').trim();
  if (gym) c.gymName = gym.slice(0, 120);
  const last = isoOrUndef(r.last_completed_at);
  if (last) c.lastWorkoutAt = last;
  const signup = isoOrUndef(r.signed_up_at);
  if (signup) c.signupAt = signup;
  return c;
}

/** Stabilní JSON (seřazené klíče) — základ otisku pro „změnilo se něco?“. */
export function stableJson(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableJson).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stableJson(o[k])}`).join(',')}}`;
}

/** FNV-1a 32 bit (hex) — stačí na detekci změny, žádná kryptografie. */
export function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export const contactHash = (c: LoopsContact): string => fnv1a(stableJson(c));

export interface SyncedState {
  propsHash: string | null;
  removedAt: string | null;
}

export type ContactAction =
  | { kind: 'skip' }
  | { kind: 'upsert'; body: Record<string, unknown>; hash: string };

/**
 * Upsert jen při změně otisku. Návrat po vyřazení (removed_at) = výslovně subscribed:true,
 * jinak se `subscribed` neposílá (Loops doporučuje ho vynechat; nový kontakt je subscribed).
 */
export function planContact(c: LoopsContact, prev: SyncedState | undefined): ContactAction {
  const hash = contactHash(c);
  const returning = !!prev?.removedAt;
  if (prev && !returning && prev.propsHash === hash) return { kind: 'skip' };
  const body: Record<string, unknown> = { ...c };
  if (returning) body.subscribed = true;
  return { kind: 'upsert', body, hash };
}

// ─── Události ────────────────────────────────────────────────────────────────

export interface PlannedEvent {
  event: LoopsEventName;
  /** Epizoda pro unique(user_id, event, episode) v loops_event_log. */
  episode: string;
  eventProperties: Record<string, string | number | boolean>;
}

export interface EventHistory {
  /** Už zalogované páry `${event}|${episode}`. */
  logged: ReadonlySet<string>;
  /** Kdy naposled odešel plan_slowing (ISO), nebo null. */
  lastPlanSlowingAt: string | null;
  /** Časy odeslaných inactive_21d (ISO) — strop 2 za 90 dní. */
  inactiveSentAt?: readonly string[];
}

const withinLookback = (iso: string | null | undefined, now: Date): boolean => {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return false;
  const h = (now.getTime() - t) / 3_600_000;
  return h >= 0 && h <= EVENT_LOOKBACK_HOURS;
};

export const eventKey = (event: string, episode: string): string => `${event}|${episode}`;

/**
 * Události pro jednoho uživatele, idempotentně (co je v logu, se neopakuje).
 * eventProperties nesou jen název posilovny, počty a dny — nic zdravotního.
 */
export function computeEvents(r: LoopsFactsRow, h: EventHistory, now: Date): PlannedEvent[] {
  const out: PlannedEvent[] = [];
  const add = (event: LoopsEventName, episode: string, eventProperties: PlannedEvent['eventProperties'] = {}) => {
    if (!h.logged.has(eventKey(event, episode))) out.push({ event, episode, eventProperties });
  };
  const gymName = (r.selected_gym_name ?? '').trim();
  const workouts = Math.max(0, Number(r.completed_workouts) || 0);
  const today = pragueDateKey(now);

  if (withinLookback(r.signed_up_at, now)) add('signed_up', 'life');

  // Dotazník dokončen = vznikl první plán (persistOnboarding ho zakládá s gym_id null).
  if (r.onboarding_completed && withinLookback(r.first_plan_at, now)) {
    add('onboarding_completed', 'life', { hasGym: !!r.selected_gym_id, gymName });
  }

  // plan_ready: plán postavený pro stroje posilovny (epizoda 'gym'), nebo po dotazníku
  // bez vybrané posilovny (epizoda 'nogym' — kdo si posilovnu vybere později, dostane i 'gym').
  if (withinLookback(r.first_gym_plan_at, now)) {
    add('plan_ready', 'gym', { gymName, noGym: false });
  } else if (r.onboarding_completed && !r.selected_gym_id && !r.first_gym_plan_at && withinLookback(r.first_plan_at, now)) {
    add('plan_ready', 'nogym', { gymName: '', noGym: true });
  }

  if (workouts >= 1 && withinLookback(r.first_completed_at, now)) {
    add('first_workout_completed', 'life', { gymName, workoutsCompleted: workouts });
  }

  // Každý dokončený trénink za posledních 48 h (epizoda = id workout_sessions).
  const recent = [...(r.recent_workouts ?? [])].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const olderCount = workouts - recent.length;
  recent.forEach((w, i) => {
    if (withinLookback(w.at, now)) add('workout_completed', w.id, { gymName, workoutNumber: olderCount + i + 1 });
  });

  const dates = [...(r.workout_dates ?? [])].sort();
  if (dates.length) {
    const last = dates[dates.length - 1];
    const sinceLast = daysBetweenKeys(last, today);
    // Epizoda = datum posledního tréninku: jednou na „výpadek“.
    const inactive90 = (h.inactiveSentAt ?? []).filter((t) => now.getTime() - Date.parse(t) < 90 * 86_400_000).length;
    if (sinceLast >= INACTIVE_DAY_FROM && sinceLast <= INACTIVE_DAY_TO && inactive90 < INACTIVE_MAX_PER_90_DAYS) {
      add('inactive_21d', last, { workoutsCompleted: workouts, daysSinceLastWorkout: sinceLast });
    }
    const tpw = trainingsPerWeek(r.plan_training_days, r.training_days);
    if (isPlanSlowing(dates, tpw, today)) {
      const lastT = h.lastPlanSlowingAt ? Date.parse(h.lastPlanSlowingAt) : NaN;
      const recentEnough = Number.isFinite(lastT) && now.getTime() - lastT < PLAN_SLOWING_REPEAT_DAYS * 86_400_000;
      if (!recentEnough) add('plan_slowing', today, { trainingsPerWeek: tpw ?? 0, workoutsLast14d: workoutWindows(dates, today).n14 });
    }
  }
  return out;
}

/**
 * Tělo POST /v1/events/send. marketingAllowed jde i jako vlastnost kontaktu
 * (kořenový klíč aktualizuje kontakt), aby filtr journey nikdy nečetl starou hodnotu.
 */
export function eventBody(c: LoopsContact, e: PlannedEvent): Record<string, unknown> {
  return {
    email: c.email,
    userId: c.userId,
    eventName: e.event,
    eventProperties: e.eventProperties,
    marketingAllowed: c.marketingAllowed,
    retentionEmailsAllowed: c.retentionEmailsAllowed,
  };
}

/** Idempotency-Key pro Loops (max 100 znaků). */
export const idempotencyKey = (userId: string, e: Pick<PlannedEvent, 'event' | 'episode'>): string =>
  `${userId}:${e.event}:${e.episode}`.slice(0, 100);

// ─── Vyřazení z Loops ────────────────────────────────────────────────────────

export type DropoutReason = 'marketing_not_allowed' | 'not_eligible' | 'account_deleted';

/**
 * Kdo je v Loops a už tam být nemá → kontakt v Loops SMAZAT (POST /contacts/delete, jen userId):
 *  - marketing_not_allowed: je oslovitelný, ale ztratil právní základ (odmítl, stáhl souhlas),
 *  - not_eligible: vypadl z email_eligible_users (odhlásil se, bounce/spam, staff, role),
 *  - account_deleted: účet už neexistuje.
 * Náš záznam (odhlášení, suppressions) zůstává v Supabase, takže se do Loops nevrátí,
 * dokud znovu nesplní marketingAllowed.
 */
export function planDropout(userId: string, reason: DropoutReason): { kind: 'delete'; reason: DropoutReason; body: { userId: string } } {
  return { kind: 'delete', reason, body: { userId } };
}

/** Má kontakt být v Loops? Jen s e-mailem a marketingAllowed = true. */
export const belongsInLoops = (c: LoopsContact | null): c is LoopsContact => !!c && c.marketingAllowed === true;

// ─── HTTP s ohledem na rate limit ────────────────────────────────────────────

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) =>
  Promise<{ status: number; text: () => Promise<string> }>;

export type LoopsResult =
  | { ok: true; status: number; duplicate?: boolean }
  | { ok: false; status: number; error: string; rateLimited?: boolean };

/** Jeden požadavek na Loops: 429 → exponenciální čekání (1 s, 2 s, 4 s), 409 u události = už zpracováno. */
export async function loopsRequest(
  deps: { fetch: FetchLike; sleep: (ms: number) => Promise<void>; apiKey: string },
  method: 'PUT' | 'POST',
  path: string,
  body: Record<string, unknown>,
  idemKey?: string,
): Promise<LoopsResult> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${deps.apiKey}`,
    'Content-Type': 'application/json',
  };
  if (idemKey) headers['Idempotency-Key'] = idemKey;
  for (let attempt = 0; ; attempt++) {
    const res = await deps.fetch(`${LOOPS_API_BASE}${path}`, { method, headers, body: JSON.stringify(body) });
    if (res.status === 429) {
      if (attempt >= MAX_RETRIES_429) return { ok: false, status: 429, error: 'rate_limited', rateLimited: true };
      await deps.sleep(1000 * 2 ** attempt);
      continue;
    }
    if (res.status >= 200 && res.status < 300) return { ok: true, status: res.status };
    if (res.status === 409 && idemKey) return { ok: true, status: 409, duplicate: true };
    const text = await res.text().catch(() => '');
    return { ok: false, status: res.status, error: text.slice(0, 300) };
  }
}

// ─── M0 Vítej — servisní transactional e-mail od zakladatelů (18. 10. 2026) ──
//
// Jde KAŽDÉMU novému členovi jednou (kdo za Pumplem stojí, jak začít; bez propagace),
// proto NEPOTŘEBUJE marketingAllowed (čl. 6 odst. 1 písm. b) GDPR) — ale respektuje
// odhlášení (email_unsubscribed_at) a blokované adresy (email_suppressions).
// Posílá se přes Loops transactional API s addToAudience: false → člověk se tím
// NEDOSTANE do audience obchodních e-mailů. Jednou za život: email_sends
// (template_key 'M0', episode_key 'life', unique) + Idempotency-Key.

export const WELCOME_TEMPLATE_KEY = 'M0';
export const WELCOME_TEMPLATE_VERSION = 1;
export const WELCOME_EPISODE = 'life';
/** M0 jen účtům založeným v posledních 72 h (po zapnutí žádné hromadné rozeslání starým účtům). */
export const WELCOME_WINDOW_HOURS = 72;
export const WELCOME_CONTACT_TYPE = 'welcome';

/** Data variables, které smí do Loops s M0 odejít. Nic jiného. */
export const WELCOME_DATA_KEYS = ['firstName', 'language'] as const;

export type WelcomeRow = Pick<LoopsFactsRow, 'user_id' | 'email' | 'first_name' | 'language' | 'signed_up_at' | 'email_unsubscribed_at'>;

export interface WelcomeHistory {
  /** user_id, kterým už M0 odešel (nebo je zamčený) v email_sends. */
  sentUserIds: ReadonlySet<string>;
  /** E-maily z email_suppressions (malými písmeny). */
  suppressedEmails: ReadonlySet<string>;
}

export type WelcomeSkipReason = 'no_email' | 'outside_window' | 'already_sent' | 'unsubscribed' | 'suppressed';

export type WelcomeBody = {
  transactionalId: string;
  email: string;
  addToAudience: false;
  dataVariables: { language: 'cs' | 'en'; firstName?: string };
};

export type WelcomePlan =
  | { kind: 'skip'; reason: WelcomeSkipReason }
  | { kind: 'send'; locale: 'cs' | 'en'; body: WelcomeBody; idemKey: string };

/** Účet založený nejvýš před 72 h (a ne v budoucnosti). */
export function isWithinWelcomeWindow(signedUpAt: string | null | undefined, now: Date): boolean {
  const t = signedUpAt ? Date.parse(signedUpAt) : NaN;
  if (!Number.isFinite(t)) return false;
  const h = (now.getTime() - t) / 3_600_000;
  return h >= 0 && h <= WELCOME_WINDOW_HOURS;
}

/**
 * Rozhodnutí o M0 pro jednoho člověka. ZÁMĚRNĚ nečte právní bránu obchodních e-mailů
 * (souhlas / odmítnutí tipů) — M0 je servisní. Odhlášení a suppression blokují vždy.
 */
export function planWelcome(r: WelcomeRow, h: WelcomeHistory, now: Date, transactionalId: string): WelcomePlan {
  const email = (r.email ?? '').trim().toLowerCase();
  if (!email.includes('@')) return { kind: 'skip', reason: 'no_email' };
  if (h.sentUserIds.has(r.user_id)) return { kind: 'skip', reason: 'already_sent' };
  if (r.email_unsubscribed_at) return { kind: 'skip', reason: 'unsubscribed' };
  if (h.suppressedEmails.has(email)) return { kind: 'skip', reason: 'suppressed' };
  if (!isWithinWelcomeWindow(r.signed_up_at, now)) return { kind: 'skip', reason: 'outside_window' };
  const locale: 'cs' | 'en' = r.language === 'en' ? 'en' : 'cs';
  const dataVariables: WelcomeBody['dataVariables'] = { language: locale };
  const firstName = firstWord(r.first_name);
  if (firstName) dataVariables.firstName = firstName; // volitelná proměnná — v Loops označit jako optional
  return {
    kind: 'send',
    locale,
    body: { transactionalId, email, addToAudience: false, dataVariables },
    idemKey: `${r.user_id}:${WELCOME_TEMPLATE_KEY}:${WELCOME_EPISODE}`.slice(0, 100),
  };
}
