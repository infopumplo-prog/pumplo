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
}

const fill = (s: string, vars: Record<string, string>): string =>
  s.replace(/\{\{(\w+)\}\}/g, (m, k: string) => (k in vars ? vars[k] : m));

/** Vyplní šablonu a přidá patičku. Proměnné do HTML jdou escapované. */
export function renderEmail(r: RenderInput): { subject: string; html: string; text: string } {
  const g = greeting(r.locale, r.firstName);
  const line = stepLine(r.locale, r.currentStep);
  const kind = r.template.kind === 'marketing' ? 'marketing' : 'service';
  const footer = buildFooter({ locale: r.locale, kind, unsubscribeUrl: r.unsubscribeUrl });
  const htmlVars = { greeting: escapeHtml(g), step_line: escapeHtml(line), cta_url: escapeHtml(r.ctaUrl) };
  const textVars = { greeting: g, step_line: line, cta_url: r.ctaUrl };
  const pre = r.template.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(r.template.preheader)}</div>`
    : '';
  const html =
    `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">` +
    pre + fill(r.template.html, htmlVars) + footer.html + `</div>`;
  return {
    subject: fill(r.template.subject, textVars),
    html,
    text: fill(r.template.text, textVars) + footer.text,
  };
}

/** Hlavičky pro Gmail/Yahoo bulk pravidla + RFC 8058 one-click. */
export const unsubscribeHeaders = (unsubscribeUrl: string): Record<string, string> => ({
  'List-Unsubscribe': `<${unsubscribeUrl}>, <mailto:info@pumplo.com?subject=unsubscribe>`,
  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
});
