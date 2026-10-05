import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parseConsent, CONSENT_VERSION } from './webAnalytics';

describe('parseConsent', () => {
  it('null when nothing stored', () => expect(parseConsent(null)).toBeNull());
  it('reads current version', () =>
    expect(parseConsent(JSON.stringify({ analytics: true, marketing: false, v: CONSENT_VERSION, ts: 'x' }))).toEqual({ analytics: true, marketing: false }));
  it('older version asks again', () =>
    expect(parseConsent(JSON.stringify({ analytics: true, marketing: true, v: CONSENT_VERSION - 1, ts: 'x' }))).toBeNull());
  it('corrupt value asks again', () => expect(parseConsent('{oops')).toBeNull());
  it('coerces truthy values to booleans', () =>
    expect(parseConsent(JSON.stringify({ analytics: 1, marketing: 0, v: CONSENT_VERSION }))).toEqual({ analytics: true, marketing: false }));
});
