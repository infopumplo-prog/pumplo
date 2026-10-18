// Testy pravidel lifecycle e-mailů (F0: M2-A). Pravidla žijí v edge funkci
// lifecycle-emails/rules.ts bez Deno importů.
import { describe, it, expect } from 'vitest';
import {
  MAX_EMAILS_PER_RUN,
  buildFooter,
  decideM2A,
  episodeKeyFor,
  inSendWindow,
  isDryRun,
  pickApprovedTemplate,
  pragueHour,
  renderEmail,
  unsubscribeHeaders,
  type M2ACandidate,
  type TemplateRow,
} from '../../supabase/functions/lifecycle-emails/rules';

// 18. 10. 2026 je letní čas (UTC+2): 12:00 UTC = 14:00 v Praze.
const NOON = new Date('2026-10-18T12:00:00Z');
const hoursAgo = (h: number, from = NOON) => new Date(from.getTime() - h * 3_600_000).toISOString();

const base: M2ACandidate = {
  userId: 'u1',
  email: 'jana@example.com',
  signedUpAt: hoursAgo(5),
  onboardingCompleted: false,
  alreadySent: false,
};

describe('isDryRun', () => {
  it('výchozí je dry run, naostro jen výslovně', () => {
    expect(isDryRun(undefined)).toBe(true);
    expect(isDryRun(null)).toBe(true);
    expect(isDryRun('')).toBe(true);
    expect(isDryRun('true')).toBe(true);
    expect(isDryRun('flase')).toBe(true);
    expect(isDryRun('false')).toBe(false);
    expect(isDryRun(' FALSE ')).toBe(false);
    expect(isDryRun('0')).toBe(false);
  });
  it('dry run má vlastní epizodu', () => {
    expect(episodeKeyFor('life', true)).toBe('dry_run:life');
    expect(episodeKeyFor('life', false)).toBe('life');
  });
});

describe('pražský čas', () => {
  it('letní i zimní čas', () => {
    expect(pragueHour(NOON)).toBe(14);
    expect(pragueHour(new Date('2026-12-01T12:00:00Z'))).toBe(13);
    expect(pragueHour(new Date('2026-10-17T22:30:00Z'))).toBe(0);
  });
  it('okno 8–20 h', () => {
    expect(inSendWindow(new Date('2026-10-18T06:00:00Z'))).toBe(true); // 8:00
    expect(inSendWindow(new Date('2026-10-18T05:59:00Z'))).toBe(false); // 7:59
    expect(inSendWindow(new Date('2026-10-18T17:59:00Z'))).toBe(true); // 19:59
    expect(inSendWindow(new Date('2026-10-18T18:00:00Z'))).toBe(false); // 20:00
  });
});

describe('decideM2A', () => {
  it('pošle v okně 2–72 h po registraci', () => {
    expect(decideM2A(base, NOON)).toEqual({ send: true });
    expect(decideM2A({ ...base, signedUpAt: hoursAgo(2) }, NOON)).toEqual({ send: true });
    expect(decideM2A({ ...base, signedUpAt: hoursAgo(72) }, NOON)).toEqual({ send: true });
  });
  it('mimo okno ne', () => {
    expect(decideM2A({ ...base, signedUpAt: hoursAgo(1.9) }, NOON)).toEqual({ send: false, reason: 'too_early' });
    expect(decideM2A({ ...base, signedUpAt: hoursAgo(72.1) }, NOON)).toEqual({ send: false, reason: 'too_late' });
    expect(decideM2A({ ...base, signedUpAt: null }, NOON)).toEqual({ send: false, reason: 'no_signup_time' });
  });
  it('dokončený dotazník, už odeslaný M2A, interní, suppressed, odhlášený', () => {
    expect(decideM2A({ ...base, onboardingCompleted: true }, NOON)).toMatchObject({ send: false, reason: 'onboarding_done' });
    expect(decideM2A({ ...base, alreadySent: true }, NOON)).toMatchObject({ send: false, reason: 'already_sent' });
    expect(decideM2A({ ...base, internal: true }, NOON)).toMatchObject({ send: false, reason: 'internal' });
    expect(decideM2A({ ...base, suppressed: true }, NOON)).toMatchObject({ send: false, reason: 'suppressed' });
    expect(decideM2A({ ...base, emailUnsubscribedAt: hoursAgo(1) }, NOON)).toMatchObject({ send: false, reason: 'unsubscribed' });
    expect(decideM2A({ ...base, email: null }, NOON)).toMatchObject({ send: false, reason: 'no_email' });
  });
  it('v noci ne (Praha 23:00)', () => {
    const night = new Date('2026-10-18T21:00:00Z');
    expect(decideM2A({ ...base, signedUpAt: hoursAgo(5, night) }, night)).toEqual({ send: false, reason: 'outside_send_window' });
  });
  it('strop na běh je 40', () => {
    expect(MAX_EMAILS_PER_RUN).toBe(40);
  });
});

const tpl = (o: Partial<TemplateRow>): TemplateRow => ({
  key: 'M2A', version: 1, locale: 'cs', status: 'approved', kind: 'service',
  subject: 'Dokonči si plán v Pumplu', preheader: 'pre', html: '<p>{{greeting}}</p><p>{{step_line}}</p><a href="{{cta_url}}">x</a>',
  text: '{{greeting}} {{step_line}} {{cta_url}}', ...o,
});

describe('pickApprovedTemplate', () => {
  it('bez schválené verze nic', () => {
    expect(pickApprovedTemplate([tpl({ status: 'draft' }), tpl({ status: 'paused', version: 2 })], 'M2A', 'cs')).toBeNull();
  });
  it('nejnovější schválená v jazyce, jinak česká', () => {
    const rows = [
      tpl({ version: 1 }), tpl({ version: 2 }), tpl({ version: 3, status: 'draft' }),
      tpl({ version: 1, locale: 'en' }),
    ];
    expect(pickApprovedTemplate(rows, 'M2A', 'cs')?.version).toBe(2);
    expect(pickApprovedTemplate(rows, 'M2A', 'en')?.locale).toBe('en');
    expect(pickApprovedTemplate([tpl({ version: 2 })], 'M2A', 'en')?.locale).toBe('cs');
    expect(pickApprovedTemplate(rows, 'M3', 'cs')).toBeNull();
  });
});

describe('renderEmail + patička', () => {
  const url = 'https://x.supabase.co/functions/v1/email-unsubscribe?u=a&t=b';
  it('vyplní proměnné, escapuje jméno a přidá patičku s IČ a odhlášením', () => {
    const m = renderEmail({ template: tpl({ locale: 'en' }), locale: 'en', firstName: '<b>Jo</b> Doe', currentStep: 5, ctaUrl: 'https://app.pumplo.com/', unsubscribeUrl: url });
    expect(m.html).toContain('Hi &lt;b&gt;Jo&lt;/b&gt;,');
    expect(m.html).not.toContain('<b>Jo</b>');
    expect(m.html).toContain('only the last few questions');
    expect(m.html).toContain('GynTools CZ s.r.o., IČ 27804461');
    expect(m.html).toContain('email-unsubscribe?u=a&amp;t=b');
    expect(m.text).toContain(url);
    expect(m.html).not.toMatch(/\{\{\w+\}\}/);
  });
  it('česky bez jména, věta podle kroku 0', () => {
    const m = renderEmail({ template: tpl({}), locale: 'cs', firstName: 'Jana', currentStep: 0, ctaUrl: 'https://app.pumplo.com/', unsubscribeUrl: url });
    expect(m.text.startsWith('Ahoj, Začíná se cílem')).toBe(true);
    expect(m.text).toContain('Odhlásit e-maily');
    expect(m.text).not.toContain('Obchodní sdělení');
  });
  it('obchodní sdělení je označené', () => {
    expect(buildFooter({ locale: 'cs', kind: 'marketing', unsubscribeUrl: url }).text).toContain('Obchodní sdělení');
  });
  it('hlavičky List-Unsubscribe + one-click', () => {
    const h = unsubscribeHeaders(url);
    expect(h['List-Unsubscribe']).toContain(`<${url}>`);
    expect(h['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });
});
