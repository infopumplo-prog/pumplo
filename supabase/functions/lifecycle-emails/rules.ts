// Čistá pravidla lifecycle e-mailů (F0: jen M2-A) — bez Deno importů, aby je šlo
// testovat vitestem z appky (src/lib/lifecycleEmailRules.test.ts).
//
// M2-A (servisní, čl. 6/1/b GDPR): účet existuje, dotazník nedokončený
// (onboarding_completed = false), od registrace 2–72 h, interní účty / suppressions /
// odhlášení vyřazuje view email_eligible_users (a znovu tady), M2-A ještě neodešel.
// Odesílá se jen v pražském okně 8–20 h a jen podle SCHVÁLENÉ verze šablony.

export const M2A_KEY = 'M2A';
export const M2A_EPISODE = 'life';
export const M2A_MIN_HOURS = 2;
export const M2A_MAX_HOURS = 72;
/** Pražské hodiny, kdy smí M2-A odejít: [od, do). */
export const SEND_WINDOW_START_HOUR = 8;
export const SEND_WINDOW_END_HOUR = 20;
/** Globální strop e-mailů na jeden běh (Resend Free sdílí kvótu s Auth SMTP). */
export const MAX_EMAILS_PER_RUN = 40;

export const COMPANY_LINE = 'GynTools CZ s.r.o., IČ 27804461';
/** CTA: na mobilu otevře appku (universal link), Home ukáže výzvu k dotazníku. */
export const M2A_CTA_URL = 'https://app.pumplo.com/';

export type Locale = 'cs' | 'en';

/**
 * EMAIL_DRY_RUN: výchozí je dry run. Naostro jen při výslovném 'false' / '0' / 'no' / 'off'.
 * Překlep nebo chybějící hodnota tak nikdy nespustí odesílání.
 */
export function isDryRun(envValue: string | null | undefined): boolean {
  if (envValue === null || envValue === undefined) return true;
  return !['false', '0', 'no', 'off'].includes(envValue.trim().toLowerCase());
}

/** Dry run píše do email_sends pod vlastní epizodou, aby po přepnutí naostro nikoho neblokoval. */
export const episodeKeyFor = (episode: string, dryRun: boolean): string =>
  dryRun ? `dry_run:${episode}` : episode;

/** Hodina 0–23 v Europe/Prague. */
export function pragueHour(now: Date): number {
  const h = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Prague',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(now);
  return Number(h) % 24;
}

export const inSendWindow = (now: Date): boolean => {
  const h = pragueHour(now);
  return h >= SEND_WINDOW_START_HOUR && h < SEND_WINDOW_END_HOUR;
};

export interface M2ACandidate {
  userId: string;
  email: string | null;
  signedUpAt: string | null;
  onboardingCompleted: boolean;
  emailUnsubscribedAt?: string | null;
  suppressed?: boolean;
  internal?: boolean;
  /** Už existuje řádek email_sends pro (user, M2A, epizoda tohoto režimu). */
  alreadySent: boolean;
}

export type M2ADecision =
  | { send: true }
  | {
      send: false;
      reason:
        | 'no_email'
        | 'internal'
        | 'suppressed'
        | 'unsubscribed'
        | 'onboarding_done'
        | 'already_sent'
        | 'no_signup_time'
        | 'too_early'
        | 'too_late'
        | 'outside_send_window';
    };

export function decideM2A(c: M2ACandidate, now: Date): M2ADecision {
  if (!c.email || !c.email.includes('@')) return { send: false, reason: 'no_email' };
  if (c.internal) return { send: false, reason: 'internal' };
  if (c.suppressed) return { send: false, reason: 'suppressed' };
  if (c.emailUnsubscribedAt) return { send: false, reason: 'unsubscribed' };
  if (c.onboardingCompleted) return { send: false, reason: 'onboarding_done' };
  if (c.alreadySent) return { send: false, reason: 'already_sent' };
  const signed = c.signedUpAt ? Date.parse(c.signedUpAt) : NaN;
  if (!Number.isFinite(signed)) return { send: false, reason: 'no_signup_time' };
  const hours = (now.getTime() - signed) / 3_600_000;
  if (hours < M2A_MIN_HOURS) return { send: false, reason: 'too_early' };
  if (hours > M2A_MAX_HOURS) return { send: false, reason: 'too_late' };
  if (!inSendWindow(now)) return { send: false, reason: 'outside_send_window' };
  return { send: true };
}

export interface TemplateRow {
  key: string;
  version: number;
  locale: string;
  status: string;
  kind: string;
  subject: string;
  preheader?: string | null;
  html: string;
  text: string;
}

/**
 * Nejnovější SCHVÁLENÁ verze v jazyce uživatele, jinak schválená česká.
 * Draft ani paused se nikdy nepoužijí; bez schválené verze → null (nic se neposílá).
 */
export function pickApprovedTemplate<T extends TemplateRow>(rows: T[], key: string, locale: string): T | null {
  const approved = rows
    .filter((r) => r.key === key && r.status === 'approved')
    .sort((a, b) => b.version - a.version);
  return approved.find((r) => r.locale === locale) ?? approved.find((r) => r.locale === 'cs') ?? null;
}

export const normalizeLocale = (lang: string | null | undefined): Locale => (lang === 'en' ? 'en' : 'cs');

export const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Oslovení. Česky bez jména — 5. pád z křestního jména automaticky spolehlivě nevytvoříme. */
export function greeting(locale: Locale, firstName: string | null | undefined): string {
  if (locale === 'en') {
    const name = (firstName ?? '').trim().split(/\s+/)[0];
    return name ? `Hi ${name},` : 'Hi,';
  }
  return 'Ahoj,';
}

/** Věta podle rozpracovanosti dotazníku (krok 0 vs. 4+), podle návrhu M2 z 1. 10. */
export function stepLine(locale: Locale, currentStep: number | null | undefined): string {
  const advanced = (currentStep ?? 0) >= 4;
  if (locale === 'en') {
    return advanced ? 'You are part of the way there, only the last few questions are left.' : 'It starts with your goal and then just a few questions.';
  }
  return advanced ? 'Kus máš za sebou, zbývá posledních pár otázek.' : 'Začíná se cílem a pak už jen pár otázek.';
}

export interface FooterInput {
  locale: Locale;
  kind: 'service' | 'marketing';
  unsubscribeUrl: string;
}

/** Patička: proč e-mail přišel, firma + IČ, odhlášení; obchodní sdělení navíc označit (§ 7 odst. 4). */
export function buildFooter(f: FooterInput): { html: string; text: string } {
  const cs = f.locale === 'cs';
  const why = f.kind === 'service'
    ? (cs ? 'Tenhle e-mail se týká nastavení tvého účtu v Pumplu, proto ti přišel.' : 'You are getting this e-mail because it is about setting up your Pumplo account.')
    : (cs ? 'Obchodní sdělení. Přišlo ti, protože máš účet v Pumplu a zasílání tipů jsi neodmítl(a).' : 'Commercial message. You are getting it because you have a Pumplo account and did not opt out of tips.');
  const unsubLabel = cs ? 'Odhlásit e-maily' : 'Unsubscribe';
  const url = escapeHtml(f.unsubscribeUrl);
  const html =
    `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px">` +
    `<p style="margin:0;font-size:12px;color:#6b7280;line-height:1.6">${escapeHtml(why)}<br>` +
    `${escapeHtml(COMPANY_LINE)} · <a href="${url}" style="color:#6b7280">${unsubLabel}</a></p>`;
  const text = `\n\n--\n${why}\n${COMPANY_LINE} · ${unsubLabel}: ${f.unsubscribeUrl}`;
  return { html, text };
}

export interface RenderInput {
  template: TemplateRow;
  locale: Locale;
  firstName: string | null | undefined;
  currentStep: number | null | undefined;
  ctaUrl: string;
  unsubscribeUrl: string;
  /** F1: další proměnné šablony (gym_name, next_day_line, …); do HTML jdou escapované. */
  extraVars?: Record<string, string>;
}

const fill = (s: string, vars: Record<string, string>): string =>
  s.replace(/\{\{(\w+)\}\}/g, (m, k: string) => (k in vars ? vars[k] : m));

/** Vyplní šablonu a přidá patičku. Proměnné do HTML jdou escapované. */
export function renderEmail(r: RenderInput): { subject: string; html: string; text: string } {
  const g = greeting(r.locale, r.firstName);
  const line = stepLine(r.locale, r.currentStep);
  const kind = r.template.kind === 'marketing' ? 'marketing' : 'service';
  const footer = buildFooter({ locale: r.locale, kind, unsubscribeUrl: r.unsubscribeUrl });
  const extra = r.extraVars ?? {};
  const htmlVars: Record<string, string> = { greeting: escapeHtml(g), step_line: escapeHtml(line), cta_url: escapeHtml(r.ctaUrl) };
  const textVars: Record<string, string> = { greeting: g, step_line: line, cta_url: r.ctaUrl };
  for (const [k, v] of Object.entries(extra)) {
    if (k in textVars) continue; // základní proměnné F0 nejdou přepsat
    htmlVars[k] = escapeHtml(v);
    textVars[k] = v;
  }
  const pre = r.template.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(r.template.preheader)}</div>`
    : '';
  const html =
    `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">` +
    pre + fill(r.template.html, htmlVars) + footer.html + `</div>`;
  if (!r.extraVars) {
    return {
      subject: fill(r.template.subject, textVars),
      html,
      text: fill(r.template.text, textVars) + footer.text,
    };
  }
  // F1: prázdná volitelná věta (např. next_day_line) nesmí nechat prázdný odstavec.
  return {
    subject: fill(r.template.subject, textVars).replace(/\s{2,}/g, ' ').trim(),
    html: html.replace(/<p[^>]*>\s*<\/p>/g, ''),
    text: (fill(r.template.text, textVars).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()) + footer.text,
  };
}

/** Hlavičky pro Gmail/Yahoo bulk pravidla + RFC 8058 one-click. */
export const unsubscribeHeaders = (unsubscribeUrl: string): Record<string, string> => ({
  'List-Unsubscribe': `<${unsubscribeUrl}>, <mailto:info@pumplo.com?subject=unsubscribe>`,
  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
});

// ═════════════════════════════════════════════════════════════════════════════
// F1 (19. 10. 2026): retargeting M3–M8 — obchodní sdělení, jen SCHVÁLENÉ šablony.
// Spec: Vaults/pumplo/strategie/2026-10-01-retargeting-automatizace-skolni-zadani.md
//
//  - Jedna fáze najednou: 0 dokončených tréninků = aktivace (M2A > M4 > M3 > M5),
//    ≥ 1 = udržení (M6 > M8 > M7). Rozhoduje mail s nejvyšší prioritou, jehož
//    spouštěč platí; když ho zastaví brána (právo, strop, slot), mail nižší
//    priority se ten den NEPOŠLE — další běh vyhodnotí znovu.
//  - M2A (servisní) běží beze změny přes decideM2A výše; tady se jen respektuje,
//    že kdo má nedokončený dotazník, do M3–M5 nevstupuje.
//  - Všechna okna jsou pražská kalendářní data (jako getDaysSinceLastWorkout v push).
//  - Stropy: 1 kontakt / pražský den napříč kanály (contact_log + notification_logs),
//    e-mail max 1 / 48 h, max 3 / 7 dní v aktivaci, 2 / 7 dní v udržení, M8 max 2 / 90 dní.
//  - Právní brána (§ 7 odst. 3 zák. 480/2004 Sb.): souhlas, NEBO nabídnuté odmítnutí
//    při registraci a žádné odmítnutí/odhlášení. Build z obchodu bez zaškrtávátka
//    nemá email_optout_offered_at → bez souhlasu nedostane nic.
// ═════════════════════════════════════════════════════════════════════════════

export type MarketingKey = 'M3A' | 'M3B' | 'M4' | 'M5' | 'M6' | 'M7' | 'M8';
export const MARKETING_KEYS: readonly MarketingKey[] = ['M3A', 'M3B', 'M4', 'M5', 'M6', 'M7', 'M8'];
/** Pořadí vyhodnocení (M2A má v aktivaci přednost, ale řeší ho decideM2A). */
export const ACTIVATION_PRIORITY: readonly MarketingKey[] = ['M4', 'M3A', 'M3B', 'M5'];
export const RETENTION_PRIORITY: readonly MarketingKey[] = ['M6', 'M8', 'M7'];
/** Klíče, které musí mít schválenou šablonu, aby se vůbec vyhodnocovaly. */
export const LIFE_EPISODE = 'life';

/** Pražský slot obchodních e-mailů: běh v 16:30 (po pushi ve 14 h, před večerními tréninky). */
export const MARKETING_SLOT_HOUR = 16;

export const M3_MIN_HOURS = 18;
export const M3_DAY_FROM = 1;
export const M3_DAY_TO = 3;
export const M4_MIN_HOURS_AFTER_PLAN = 20;
export const M4_FALLBACK_HOURS_AFTER_PLAN = 72;
export const M4_MAX_DAYS_SINCE_SIGNUP = 7;
export const M5_DAY_FROM = 7;
export const M5_DAY_TO = 10;
export const M6_DAY_FROM = 2;
export const M6_DAY_TO = 3;
export const M7_MIN_WORKOUTS = 3;
export const M7_MIN_DAYS_SINCE_FIRST = 14;
export const M7_MAX_DAYS_SINCE_LAST = 13;
export const M7_REPEAT_DAYS = 21;
export const M8_DAY_FROM = 21;
export const M8_DAY_TO = 24;
export const M8_MAX_PER_90_DAYS = 2;
/** Den v okně M8, který obsadí comeback push (COMEBACK_STAGES v send-push-notifications). */
export const M8_COMEBACK_PUSH_DAYS: readonly number[] = [23];

export const EMAIL_MIN_GAP_HOURS = 48;
export const ACTIVATION_MAX_EMAILS_7D = 3;
export const RETENTION_MAX_EMAILS_7D = 2;

const RETENTION_KEYS: readonly MarketingKey[] = ['M6', 'M7', 'M8'];

/** Kalendářní datum YYYY-MM-DD v Praze. */
export function pragueDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

const keyToUtc = (key: string): number => {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

/** to − from v kalendářních dnech. */
export const daysBetweenKeys = (fromKey: string, toKey: string): number =>
  Math.round((keyToUtc(toKey) - keyToUtc(fromKey)) / 86_400_000);

export const shiftKey = (key: string, days: number): string =>
  new Date(keyToUtc(key) + days * 86_400_000).toISOString().slice(0, 10);

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
export const weekdayOfKey = (key: string): string => WEEKDAYS[new Date(keyToUtc(key)).getUTCDay()];

/** Za kolik dní je nejbližší tréninkový den (1–7, zítra = 1); null = dny neznáme. */
export function daysToNextTrainingDay(trainingDays: string[] | null | undefined, todayKey: string): number | null {
  const days = (trainingDays ?? []).map((d) => d.toLowerCase());
  if (!days.length) return null;
  for (let i = 1; i <= 7; i++) if (days.includes(weekdayOfKey(shiftKey(todayKey, i)))) return i;
  return null;
}

export interface LifecycleFacts {
  userId: string;
  email: string | null;
  signedUpAt: string | null;
  onboardingCompleted: boolean;
  selectedGymId: string | null;
  marketingConsentAt: string | null;
  emailOptoutOfferedAt: string | null;
  marketingOptoutAt: string | null;
  emailUnsubscribedAt: string | null;
  suppressed?: boolean;
  internal?: boolean;
  /** user_profiles.notification_comeback (null v DB = výchozí true). */
  notificationComeback: boolean;
  /** user_profiles.training_days (záloha). */
  trainingDays: string[] | null;
  /** training_days aktivního plánu (přednost). */
  planTrainingDays: string[] | null;
  /** Nejstarší user_workout_plans s gym_id = stisk Začít trénink. */
  firstGymPlanAt: string | null;
  /** Pražská data všech dokončených tréninků (jeden prvek = jeden trénink), vzestupně. */
  workoutDates: string[];
  hasDeviceToken: boolean;
}

export interface SentEmailRow {
  templateKey: string;
  /** Epizoda bez prefixu dry_run: (volající předává jen řádky aktuálního režimu). */
  episodeKey: string;
  sentAt: string;
  /** 'sent' / 'dry_run' se počítá do stropů; jakýkoli řádek blokuje stejnou epizodu. */
  status: string;
}

export interface ContactRow {
  channel: 'push' | 'email' | 'in_app';
  sentAt: string;
}

export interface LifecycleHistory {
  emails: SentEmailRow[];
  /** contact_log uživatele (stačí posledních 90 dní). */
  contacts: ContactRow[];
  /** notification_logs.date_key uživatele (push, než budou všechny pushe v contact_log). */
  pushDateKeys: string[];
}

export type LegalGate = 'ok' | 'unsubscribed' | 'opted_out' | 'no_legal_basis';

/**
 * Právní brána obchodních sdělení:
 * marketing_consent_at IS NOT NULL
 *   OR (email_optout_offered_at IS NOT NULL AND marketing_optout_at IS NULL AND email_unsubscribed_at IS NULL).
 * Odhlášení vždy blokuje; odmítnutí blokuje i souhlas starší než odmítnutí.
 */
export function legalGate(f: Pick<LifecycleFacts, 'marketingConsentAt' | 'emailOptoutOfferedAt' | 'marketingOptoutAt' | 'emailUnsubscribedAt'>): LegalGate {
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

export const isMarketingKey = (k: string): k is MarketingKey => (MARKETING_KEYS as readonly string[]).includes(k);
export const phaseOf = (completedWorkouts: number): 'activation' | 'retention' =>
  completedWorkouts > 0 ? 'retention' : 'activation';

const hoursSince = (iso: string | null, now: Date): number | null => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? (now.getTime() - t) / 3_600_000 : null;
};

const dayDiff = (iso: string | null, todayKey: string): number | null => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? daysBetweenKeys(pragueDateKey(new Date(t)), todayKey) : null;
};

const everSent = (h: LifecycleHistory, keys: string[]): boolean => h.emails.some((e) => keys.includes(e.templateKey));
const sentEpisode = (h: LifecycleHistory, key: string, episode: string): boolean =>
  h.emails.some((e) => e.templateKey === key && e.episodeKey === episode);
const countedEmails = (h: LifecycleHistory): SentEmailRow[] =>
  h.emails.filter((e) => e.status === 'sent' || e.status === 'dry_run');

export interface Trigger { key: MarketingKey; episode: string }

/** n14 = tréninky dnes a 13 dní zpět; n14prev = dny 14–27 zpět. */
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

export const tpwOf = (f: Pick<LifecycleFacts, 'planTrainingDays' | 'trainingDays'>): number | null => {
  const days = f.planTrainingDays?.length ? f.planTrainingDays : f.trainingDays;
  return days?.length ? days.length : null;
};

/**
 * Zpomalení plánu (M7, definice z 1. 10.): ≥ 3 tréninky, první před ≥ 14 dny, poslední
 * nejvýš před 13 dny, a platí A (n14 < tpw A dny od posledního > 14/tpw)
 * nebo B (n14prev ≥ 2 A n14 ≤ 0,5 × n14prev).
 */
export function isPlanSlowing(f: Pick<LifecycleFacts, 'workoutDates' | 'planTrainingDays' | 'trainingDays'>, todayKey: string): boolean {
  const dates = f.workoutDates;
  if (dates.length < M7_MIN_WORKOUTS) return false;
  const sinceFirst = daysBetweenKeys(dates[0], todayKey);
  const sinceLast = daysBetweenKeys(dates[dates.length - 1], todayKey);
  if (sinceFirst < M7_MIN_DAYS_SINCE_FIRST || sinceLast > M7_MAX_DAYS_SINCE_LAST) return false;
  const { n14, n14prev } = workoutWindows(dates, todayKey);
  const tpw = tpwOf(f);
  const a = tpw !== null && n14 < tpw && sinceLast > 14 / tpw;
  const b = n14prev >= 2 && n14 <= 0.5 * n14prev;
  return a || b;
}

/** Spouštěč s nejvyšší prioritou v aktuální fázi, nebo null. Nekontroluje brány. */
export function pickTrigger(f: LifecycleFacts, h: LifecycleHistory, now: Date): Trigger | null {
  const today = pragueDateKey(now);
  const workouts = f.workoutDates.length;

  if (phaseOf(workouts) === 'activation') {
    // M2A (nedokončený dotazník) má přednost a řeší ho decideM2A — M3–M5 jen po dotazníku.
    if (!f.onboardingCompleted) return null;
    if (everSent(h, ['M5'])) return null; // M5 uzavírá aktivační řetěz natrvalo
    const signupHours = hoursSince(f.signedUpAt, now);
    const signupDay = dayDiff(f.signedUpAt, today);
    if (signupHours === null || signupDay === null) return null;
    const days = f.planTrainingDays?.length ? f.planTrainingDays : f.trainingDays;

    // M4: spustil (vznikl plán s posilovnou), nedokončil.
    if (f.firstGymPlanAt && !everSent(h, ['M4'])) {
      const planHours = hoursSince(f.firstGymPlanAt, now);
      if (planHours !== null && planHours >= M4_MIN_HOURS_AFTER_PLAN && signupDay <= M4_MAX_DAYS_SINCE_SIGNUP) {
        const next = daysToNextTrainingDay(days, today);
        if (next === null || next === 1 || planHours >= M4_FALLBACK_HOURS_AFTER_PLAN) {
          return { key: 'M4', episode: LIFE_EPISODE };
        }
      }
    }
    // M3: dotazník hotový, trénink nikdy nespuštěný (A s posilovnou / B bez).
    if (!f.firstGymPlanAt && !everSent(h, ['M3A', 'M3B'])
      && signupHours >= M3_MIN_HOURS && signupDay >= M3_DAY_FROM && signupDay <= M3_DAY_TO) {
      return { key: f.selectedGymId ? 'M3A' : 'M3B', episode: LIFE_EPISODE };
    }
    // M5: den 7–10 bez tréninku, jednou.
    if (signupDay >= M5_DAY_FROM && signupDay <= M5_DAY_TO) {
      return { key: 'M5', episode: LIFE_EPISODE };
    }
    return null;
  }

  // Udržení.
  const first = f.workoutDates[0];
  const last = f.workoutDates[workouts - 1];
  const sinceFirst = daysBetweenKeys(first, today);
  const sinceLast = daysBetweenKeys(last, today);

  // M6: přesně 1 trénink, pražský den 2 (když je zítra tréninkový den nebo dny neznáme) nebo 3.
  if (workouts === 1 && !sentEpisode(h, 'M6', first)) {
    const days = f.planTrainingDays?.length ? f.planTrainingDays : f.trainingDays;
    const next = daysToNextTrainingDay(days, today);
    if ((sinceFirst === M6_DAY_FROM && (next === null || next === 1)) || sinceFirst === M6_DAY_TO) {
      return { key: 'M6', episode: first };
    }
  }
  // M8: 21–24 dní od posledního tréninku, jednou na epizodu, max 2 za 90 dní.
  if (sinceLast >= M8_DAY_FROM && sinceLast <= M8_DAY_TO && !sentEpisode(h, 'M8', last)) {
    const recentM8 = countedEmails(h).filter((e) => e.templateKey === 'M8' && (hoursSince(e.sentAt, now) ?? Infinity) < 90 * 24).length;
    if (recentM8 < M8_MAX_PER_90_DAYS) return { key: 'M8', episode: last };
  }
  // M7: zpomalení plánu, nejvýš jednou za 21 dní.
  if (isPlanSlowing(f, today)) {
    const recentM7 = h.emails.some((e) => e.templateKey === 'M7' && (hoursSince(e.sentAt, now) ?? Infinity) < M7_REPEAT_DAYS * 24);
    if (!recentM7) return { key: 'M7', episode: today };
  }
  return null;
}

export type CapResult = 'ok' | 'contact_today' | 'email_48h' | 'email_7d_cap';

/** Frekvenční stropy pro daný mail (fáze podle klíče). */
export function checkCaps(key: MarketingKey, h: LifecycleHistory, now: Date): CapResult {
  const today = pragueDateKey(now);
  const contactToday =
    h.pushDateKeys.includes(today) ||
    h.contacts.some((c) => pragueDateKey(new Date(c.sentAt)) === today) ||
    countedEmails(h).some((e) => pragueDateKey(new Date(e.sentAt)) === today);
  if (contactToday) return 'contact_today';
  const emailTimes = [
    ...countedEmails(h).map((e) => Date.parse(e.sentAt)),
    ...h.contacts.filter((c) => c.channel === 'email').map((c) => Date.parse(c.sentAt)),
  ].filter(Number.isFinite);
  const ageH = (t: number) => (now.getTime() - t) / 3_600_000;
  if (emailTimes.some((t) => ageH(t) < EMAIL_MIN_GAP_HOURS)) return 'email_48h';
  // Stejný e-mail může být v email_sends i contact_log → počítat odeslání jen z email_sends.
  const last7 = countedEmails(h).filter((e) => {
    const t = Date.parse(e.sentAt);
    return Number.isFinite(t) && ageH(t) < 7 * 24;
  }).length;
  const cap = RETENTION_KEYS.includes(key) ? RETENTION_MAX_EMAILS_7D : ACTIVATION_MAX_EMAILS_7D;
  if (last7 >= cap) return 'email_7d_cap';
  return 'ok';
}

export type LifecycleDecision =
  | { send: true; key: MarketingKey; episode: string }
  | {
      send: false;
      key?: MarketingKey;
      reason:
        | 'no_email'
        | 'internal'
        | 'suppressed'
        | 'unsubscribed'
        | 'no_trigger'
        | 'not_approved'
        | 'opted_out'
        | 'no_legal_basis'
        | 'comeback_off'
        | 'outside_slot'
        | 'comeback_push_day'
        | CapResult;
    };

/**
 * Rozhodnutí o obchodním e-mailu M3–M8 pro jednoho uživatele.
 * approvedKeys = klíče se SCHVÁLENOU šablonou; bez ní se mail neposílá (ani dry run)
 * a mail nižší priority ho nenahradí.
 */
export function decideLifecycle(
  f: LifecycleFacts,
  h: LifecycleHistory,
  now: Date,
  approvedKeys: ReadonlySet<string>,
): LifecycleDecision {
  if (!f.email || !f.email.includes('@')) return { send: false, reason: 'no_email' };
  if (f.internal) return { send: false, reason: 'internal' };
  if (f.suppressed) return { send: false, reason: 'suppressed' };
  if (f.emailUnsubscribedAt) return { send: false, reason: 'unsubscribed' };

  const trigger = pickTrigger(f, h, now);
  if (!trigger) return { send: false, reason: 'no_trigger' };
  const key = trigger.key;
  if (!approvedKeys.has(key)) return { send: false, key, reason: 'not_approved' };

  const legal = legalGate(f);
  if (legal !== 'ok') return { send: false, key, reason: legal };
  if (RETENTION_KEYS.includes(key) && !f.notificationComeback) return { send: false, key, reason: 'comeback_off' };
  if (pragueHour(now) !== MARKETING_SLOT_HOUR) return { send: false, key, reason: 'outside_slot' };
  if (key === 'M8' && f.hasDeviceToken && f.notificationComeback) {
    const sinceLast = daysBetweenKeys(f.workoutDates[f.workoutDates.length - 1], pragueDateKey(now));
    if (M8_COMEBACK_PUSH_DAYS.includes(sinceLast)) return { send: false, key, reason: 'comeback_push_day' };
  }
  const caps = checkCaps(key, h, now);
  if (caps !== 'ok') return { send: false, key, reason: caps };
  return { send: true, key, episode: trigger.episode };
}

/** Kanál: kdo nemá device token, je e-mailem osloven přednostně (řazení kandidátů před stropem běhu). */
export const byChannelPreference = <T extends { hasDeviceToken: boolean }>(a: T, b: T): number =>
  Number(a.hasDeviceToken) - Number(b.hasDeviceToken);

// ─── Personalizace (jen jméno, posilovna, dny v týdnu, počty tréninků) ───────────
// NIKDY zranění, váha, výška ani věk.

const CS_WEEKDAY_ON: Record<string, string> = {
  monday: 'v pondělí', tuesday: 'v úterý', wednesday: 've středu', thursday: 've čtvrtek',
  friday: 'v pátek', saturday: 'v sobotu', sunday: 'v neděli',
};
const EN_WEEKDAY: Record<string, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday',
  friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};

export function nextDayLine(locale: Locale, trainingDays: string[] | null | undefined, todayKey: string): string {
  const n = daysToNextTrainingDay(trainingDays, todayKey);
  if (n === null) return '';
  const wd = weekdayOfKey(shiftKey(todayKey, n));
  if (locale === 'en') return n === 1 ? 'Your next training day is tomorrow.' : `Your next training day is on ${EN_WEEKDAY[wd]}.`;
  return n === 1 ? 'Zítra máš v plánu tréninkový den.' : `Další tréninkový den máš v plánu ${CS_WEEKDAY_ON[wd]}.`;
}

export function planLine(locale: Locale, tpw: number | null): string {
  if (locale === 'en') return tpw ? `Your plan is set to ${tpw}× a week.` : 'Your plan counts on regular workouts.';
  return tpw ? `Tvůj plán je nastavený na ${tpw}× týdně.` : 'Tvůj plán počítá s pravidelnými tréninky.';
}

/** „1 trénink“ / „3 tréninky“ / „7 tréninků“ (4. pád) · „1 workout“ / „7 workouts“. */
export function workoutsLine(locale: Locale, n: number): string {
  if (locale === 'en') return n === 1 ? '1 workout' : `${n} workouts`;
  if (n === 1) return '1 trénink';
  if (n >= 2 && n <= 4) return `${n} tréninky`;
  return `${n} tréninků`;
}

export const gymNameOr = (locale: Locale, name: string | null | undefined): string => {
  const n = (name ?? '').trim();
  if (n) return n;
  return locale === 'en' ? 'your gym' : 'tvoji posilovnu';
};

/** Proměnné šablony pro M3–M8 (do renderEmail jako extraVars). */
export function marketingVars(
  key: MarketingKey,
  locale: Locale,
  f: Pick<LifecycleFacts, 'workoutDates' | 'planTrainingDays' | 'trainingDays'> & { selectedGymName?: string | null },
  now: Date,
): Record<string, string> {
  const today = pragueDateKey(now);
  const days = f.planTrainingDays?.length ? f.planTrainingDays : f.trainingDays;
  const vars: Record<string, string> = { gym_name: gymNameOr(locale, f.selectedGymName) };
  if (key === 'M4' || key === 'M6') vars.next_day_line = nextDayLine(locale, days, today);
  if (key === 'M7') vars.plan_line = planLine(locale, tpwOf(f));
  if (key === 'M8') vars.workouts_line = workoutsLine(locale, f.workoutDates.length);
  return vars;
}
