import { describe, it, expect } from 'vitest';
import { APP_CONSENT_VERSION, isConsentBlockedPath, isConsentPromptPending, parseAppConsent, readAppConsent, writeAppConsent } from './appConsent';

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } };
};

describe('parseAppConsent', () => {
  it('null when nothing stored', () => expect(parseAppConsent(null)).toBeNull());
  it('reads the current version', () =>
    expect(parseAppConsent(JSON.stringify({ v: APP_CONSENT_VERSION, analytics: true, marketing: false }))).toEqual({ analytics: true, marketing: false }));
  it('other version asks again', () =>
    expect(parseAppConsent(JSON.stringify({ v: APP_CONSENT_VERSION + 1, analytics: true, marketing: true }))).toBeNull());
  it('corrupt value asks again', () => expect(parseAppConsent('{nope')).toBeNull());
  it('coerces to booleans', () =>
    expect(parseAppConsent(JSON.stringify({ v: APP_CONSENT_VERSION, analytics: 1, marketing: 0 }))).toEqual({ analytics: true, marketing: false }));
});

describe('read/write', () => {
  it('round-trips through storage with version and timestamp', () => {
    const s = memory();
    expect(readAppConsent(s)).toBeNull();
    writeAppConsent({ analytics: false, marketing: true }, s);
    expect(readAppConsent(s)).toEqual({ analytics: false, marketing: true });
    const raw = JSON.parse(s.getItem('pumplo_app_consent')!);
    expect(raw.v).toBe(APP_CONSENT_VERSION);
    expect(typeof raw.ts).toBe('string');
  });
  it('blocked storage reads as undecided and write does not throw', () => {
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(readAppConsent(broken)).toBeNull();
    expect(() => writeAppConsent({ analytics: true, marketing: true }, broken)).not.toThrow();
  });
});

describe('isConsentPromptPending', () => {
  const pending = { hasUser: true, consent: null, pathname: '/', workoutActive: false };
  it('new user without an answer on a normal screen → tour must wait', () =>
    expect(isConsentPromptPending(pending)).toBe(true));
  it('answered (either way) → tour may start, existing users unchanged', () => {
    expect(isConsentPromptPending({ ...pending, consent: { analytics: false, marketing: false } })).toBe(false);
    expect(isConsentPromptPending({ ...pending, consent: { analytics: true, marketing: true } })).toBe(false);
  });
  it('sheet is not shown → tour may start', () => {
    expect(isConsentPromptPending({ ...pending, hasUser: false })).toBe(false);
    expect(isConsentPromptPending({ ...pending, workoutActive: true })).toBe(false);
    expect(isConsentPromptPending({ ...pending, pathname: '/custom-workout/p1' })).toBe(false);
  });
  it('blocked paths match prefixes only', () => {
    expect(isConsentBlockedPath('/auth/callback')).toBe(true);
    expect(isConsentBlockedPath('/map')).toBe(false);
  });
});
