import { describe, it, expect } from 'vitest';
import { shouldAutoShowLeadPrompt, leadPromptRecord, isValidLeadEmail, LEAD_DISMISS_DAYS } from './leadCapture';
const NOW = 1_800_000_000_000; const DAY = 86_400_000;
describe('shouldAutoShowLeadPrompt', () => {
  it('shows when nothing stored', () => expect(shouldAutoShowLeadPrompt(null, '', NOW)).toBe(true));
  it('never after submit', () => expect(shouldAutoShowLeadPrompt(leadPromptRecord('submitted', NOW - 400 * DAY), '', NOW)).toBe(false));
  it('cookie alone blocks (localStorage wiped)', () => expect(shouldAutoShowLeadPrompt(null, 'a=1; pumplo_lead=1', NOW)).toBe(false));
  it('hidden within 7 days of dismiss', () => expect(shouldAutoShowLeadPrompt(leadPromptRecord('dismissed', NOW - 6 * DAY), '', NOW)).toBe(false));
  it('back after 7 days', () => expect(shouldAutoShowLeadPrompt(leadPromptRecord('dismissed', NOW - (LEAD_DISMISS_DAYS * DAY + 1)), '', NOW)).toBe(true));
  it('corrupt storage counts as nothing', () => expect(shouldAutoShowLeadPrompt('{oops', '', NOW)).toBe(true));
});
describe('isValidLeadEmail', () => {
  it('accepts', () => ['ana@gmail.com', ' Ana@Seznam.CZ '].forEach((e) => expect(isValidLeadEmail(e)).toBe(true)));
  it('rejects', () => ['', 'ana', 'ana@gmail', 'a na@x.cz'].forEach((e) => expect(isValidLeadEmail(e)).toBe(false)));
});

import { leadCardTop } from './leadCapture';
describe('leadCardTop', () => {
  it('aligns with title when it fits', () => expect(leadCardTop(600, 844, 0)).toBe(600));
  it('stays above keyboard (short visual viewport)', () => expect(leadCardTop(600, 400, 0)).toBe(200));
  it('adds visual viewport offset when iOS scrolls for the keyboard', () => expect(leadCardTop(600, 400, 250)).toBe(450));
  it('never under the top bar', () => expect(leadCardTop(20, 844, 0)).toBe(72));
  it('null title → null (fallback position)', () => expect(leadCardTop(null, 844, 0)).toBeNull());
});

import { leadPromptSkipReason } from './leadCapture';
describe('leadPromptSkipReason', () => {
  const base = { native: false, raw: null as string | null, cookie: '', now: NOW, loggedIn: false };
  it('new web visitor → show (null)', () => expect(leadPromptSkipReason(base)).toBeNull());
  it('native app wins over everything', () =>
    expect(leadPromptSkipReason({ ...base, native: true, loggedIn: true, raw: leadPromptRecord('submitted', NOW) })).toBe('native_app'));
  it('submitted (localStorage)', () => expect(leadPromptSkipReason({ ...base, raw: leadPromptRecord('submitted', NOW - 400 * DAY) })).toBe('already_submitted'));
  it('submitted (cookie only)', () => expect(leadPromptSkipReason({ ...base, cookie: 'pumplo_lead=1' })).toBe('already_submitted'));
  it('dismissed within 7 days', () => expect(leadPromptSkipReason({ ...base, raw: leadPromptRecord('dismissed', NOW - 6 * DAY) })).toBe('dismissed_recently'));
  it('dismissed long ago → show', () => expect(leadPromptSkipReason({ ...base, raw: leadPromptRecord('dismissed', NOW - 8 * DAY) })).toBeNull());
  it('logged-in member', () => expect(leadPromptSkipReason({ ...base, loggedIn: true })).toBe('logged_in'));
  it('stored state outranks login', () => expect(leadPromptSkipReason({ ...base, loggedIn: true, raw: leadPromptRecord('dismissed', NOW) })).toBe('dismissed_recently'));
  it('agrees with shouldAutoShowLeadPrompt for web visitors', () => {
    for (const raw of [null, '{oops', leadPromptRecord('submitted', NOW), leadPromptRecord('dismissed', NOW - DAY), leadPromptRecord('dismissed', NOW - 30 * DAY)])
      expect(leadPromptSkipReason({ ...base, raw }) === null).toBe(shouldAutoShowLeadPrompt(raw, '', NOW));
  });
});

import { leadCookieDomain } from './leadCapture';
describe('state shared with pumplo.com (cookies on .pumplo.com)', () => {
  const base = { native: false, raw: null as string | null, cookie: '', now: NOW, loggedIn: false };
  it('dismiss cookie from the website blocks for 7 days (cookie expiry does the timing)', () =>
    expect(leadPromptSkipReason({ ...base, cookie: 'x=1; pumplo_lead_dismissed=1' })).toBe('dismissed_recently'));
  it('submit cookie outranks dismiss cookie', () =>
    expect(leadPromptSkipReason({ ...base, cookie: 'pumplo_lead_dismissed=1; pumplo_lead=1' })).toBe('already_submitted'));
  it('cookie domain only on pumplo.com hosts', () => {
    expect(leadCookieDomain('app.pumplo.com')).toBe('; Domain=pumplo.com');
    expect(leadCookieDomain('pumplo.com')).toBe('; Domain=pumplo.com');
    expect(leadCookieDomain('localhost')).toBe('');
    expect(leadCookieDomain('evilpumplo.com')).toBe('');
  });
});
