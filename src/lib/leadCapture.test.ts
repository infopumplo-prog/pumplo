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
