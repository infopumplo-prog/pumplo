// F1 e-maily (19. 10.): in-app žádost o souhlas s tipy e-mailem.
import { describe, it, expect } from 'vitest';
import { consentUpdate, hasMarketingBasis, shouldAskEmailConsent, type EmailConsentAskInput } from './emailConsent';

const base: EmailConsentAskInput = {
  isSignedIn: true,
  isGuest: false,
  onboardingCompleted: true,
  profile: {},
  hasPausedWorkout: false,
  otherOverlayActive: false,
  alreadyAsked: false,
};

describe('shouldAskEmailConsent', () => {
  it('stávající uživatel bez souhlasu a bez nabídnutého odmítnutí → zeptat se', () => {
    expect(shouldAskEmailConsent(base)).toBe(true);
  });
  it('kdo už souhlasil, odmítl, má nabídku z registrace nebo je odhlášený → ne', () => {
    for (const p of [
      { marketing_consent_at: '2026-10-19T10:00:00Z' },
      { email_optout_offered_at: '2026-10-19T10:00:00Z' },
      { marketing_optout_at: '2026-10-19T10:00:00Z' },
      { email_unsubscribed_at: '2026-10-19T10:00:00Z' },
    ]) expect(shouldAskEmailConsent({ ...base, profile: p })).toBe(false);
  });
  it('jen jednou, ne s rozpracovaným tréninkem, ne přes jiné panely, ne hostům a před dotazníkem', () => {
    expect(shouldAskEmailConsent({ ...base, alreadyAsked: true })).toBe(false);
    expect(shouldAskEmailConsent({ ...base, hasPausedWorkout: true })).toBe(false);
    expect(shouldAskEmailConsent({ ...base, otherOverlayActive: true })).toBe(false);
    expect(shouldAskEmailConsent({ ...base, isGuest: true })).toBe(false);
    expect(shouldAskEmailConsent({ ...base, isSignedIn: false })).toBe(false);
    expect(shouldAskEmailConsent({ ...base, onboardingCompleted: false })).toBe(false);
    expect(shouldAskEmailConsent({ ...base, profile: null })).toBe(false);
  });
});

describe('consentUpdate', () => {
  const now = new Date('2026-10-19T10:00:00Z');
  it('Ano → marketing_consent_at, Ne → marketing_optout_at', () => {
    expect(consentUpdate('yes', now)).toEqual({ marketing_consent_at: '2026-10-19T10:00:00.000Z', marketing_optout_at: null });
    expect(consentUpdate('no', now)).toEqual({ marketing_optout_at: '2026-10-19T10:00:00.000Z' });
  });
  it('po Ano je právní základ, po Ne ne', () => {
    expect(hasMarketingBasis({ ...consentUpdate('yes', now) })).toBe(true);
    expect(hasMarketingBasis({ ...consentUpdate('no', now) })).toBe(false);
    expect(hasMarketingBasis({})).toBe(false);
  });
});
