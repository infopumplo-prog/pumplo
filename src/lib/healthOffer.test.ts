import { describe, expect, it } from 'vitest';
import {
  dismissedHealthOffer,
  EMPTY_HEALTH_OFFER,
  HEALTH_OFFER_REOFFER_MS,
  parseHealthOffer,
  shouldShowHealthOffer,
  type HealthOfferInput,
} from './healthOffer';

const NOW = 1_800_000_000_000;
const base: HealthOfferInput = { platform: 'ios', connected: false, onboardingComplete: true, offer: EMPTY_HEALTH_OFFER, now: NOW };

describe('shouldShowHealthOffer', () => {
  it('offers on iOS and Android after onboarding when not connected', () => {
    expect(shouldShowHealthOffer(base)).toBe(true);
    expect(shouldShowHealthOffer({ ...base, platform: 'android' })).toBe(true);
  });
  it('never offers on web, when connected or before onboarding', () => {
    expect(shouldShowHealthOffer({ ...base, platform: null })).toBe(false);
    expect(shouldShowHealthOffer({ ...base, connected: true })).toBe(false);
    expect(shouldShowHealthOffer({ ...base, onboardingComplete: false })).toBe(false);
  });
  it('hides for 30 days after the first "not now", then offers once more', () => {
    const once = dismissedHealthOffer(EMPTY_HEALTH_OFFER, NOW);
    expect(shouldShowHealthOffer({ ...base, offer: once, now: NOW + 1000 })).toBe(false);
    expect(shouldShowHealthOffer({ ...base, offer: once, now: NOW + HEALTH_OFFER_REOFFER_MS - 1 })).toBe(false);
    expect(shouldShowHealthOffer({ ...base, offer: once, now: NOW + HEALTH_OFFER_REOFFER_MS })).toBe(true);
  });
  it('stops offering after the second "not now"', () => {
    const twice = dismissedHealthOffer(dismissedHealthOffer(EMPTY_HEALTH_OFFER, NOW), NOW + HEALTH_OFFER_REOFFER_MS);
    expect(twice.dismissCount).toBe(2);
    expect(shouldShowHealthOffer({ ...base, offer: twice, now: NOW + 10 * HEALTH_OFFER_REOFFER_MS })).toBe(false);
  });
  it('does not offer with a broken or future dismissal time', () => {
    expect(shouldShowHealthOffer({ ...base, offer: { dismissCount: 1, lastDismissedAt: null } })).toBe(false);
    expect(shouldShowHealthOffer({ ...base, offer: { dismissCount: 1, lastDismissedAt: NOW + 5000 } })).toBe(false);
  });
});

describe('parseHealthOffer', () => {
  it('reads a stored state', () => {
    expect(parseHealthOffer(JSON.stringify({ dismissCount: 1, lastDismissedAt: NOW }))).toEqual({ dismissCount: 1, lastDismissedAt: NOW });
  });
  it('falls back to empty on garbage', () => {
    expect(parseHealthOffer(null)).toEqual(EMPTY_HEALTH_OFFER);
    expect(parseHealthOffer('{nope')).toEqual(EMPTY_HEALTH_OFFER);
    expect(parseHealthOffer(JSON.stringify({ dismissCount: 'x', lastDismissedAt: 'y' }))).toEqual(EMPTY_HEALTH_OFFER);
    expect(parseHealthOffer(JSON.stringify({ dismissCount: -3 }))).toEqual(EMPTY_HEALTH_OFFER);
  });
});
