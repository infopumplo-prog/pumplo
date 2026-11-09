// Automatická nabídka propojení se Zdravím / Health Connect na Home (David, 9. 11. 2026):
// „to propojení se má nabídnout automaticky v pumplo apce“.
//
// Nevtíravě: karta na Home jen v nativní appce, po onboardingu a jen dokud propojení není.
// „Teď ne“ ji schová na 30 dní, po druhém „Teď ne“ už se sama nenabízí (zůstává v Nastavení).
// Čistá logika nahoře → testy v healthOffer.test.ts; localStorage dole.
import type { HealthPlatform } from '@/lib/healthWeights';

export const HEALTH_OFFER_REOFFER_MS = 30 * 24 * 60 * 60 * 1000;
export const HEALTH_OFFER_MAX_DISMISSALS = 2;

export interface HealthOfferState {
  dismissCount: number;
  /** Okamžik posledního „Teď ne“ (ms). */
  lastDismissedAt: number | null;
}

export const EMPTY_HEALTH_OFFER: HealthOfferState = { dismissCount: 0, lastDismissedAt: null };

export interface HealthOfferInput {
  platform: HealthPlatform | null;
  connected: boolean;
  onboardingComplete: boolean;
  offer: HealthOfferState;
  now: number;
}

export const shouldShowHealthOffer = (i: HealthOfferInput): boolean => {
  if (!i.platform || i.connected || !i.onboardingComplete) return false;
  if (i.offer.dismissCount <= 0) return true;
  if (i.offer.dismissCount >= HEALTH_OFFER_MAX_DISMISSALS) return false;
  const last = i.offer.lastDismissedAt;
  // Bez času (poškozený zápis) nebo s časem v budoucnu raději nenabízet.
  if (last == null || !Number.isFinite(last) || i.now < last) return false;
  return i.now - last >= HEALTH_OFFER_REOFFER_MS;
};

export const dismissedHealthOffer = (offer: HealthOfferState, now: number): HealthOfferState => ({
  dismissCount: Math.max(0, offer.dismissCount) + 1,
  lastDismissedAt: now,
});

export const parseHealthOffer = (raw: string | null): HealthOfferState => {
  if (!raw) return { ...EMPTY_HEALTH_OFFER };
  try {
    const v = JSON.parse(raw) as Partial<HealthOfferState>;
    const count = typeof v.dismissCount === 'number' && Number.isFinite(v.dismissCount) ? Math.max(0, Math.floor(v.dismissCount)) : 0;
    const last = typeof v.lastDismissedAt === 'number' && Number.isFinite(v.lastDismissedAt) ? v.lastDismissedAt : null;
    return { dismissCount: count, lastDismissedAt: last };
  } catch {
    return { ...EMPTY_HEALTH_OFFER };
  }
};

const offerKey = (userId: string) => `pumplo_health_offer_${userId}`;

export const readHealthOffer = (userId: string): HealthOfferState => {
  try { return parseHealthOffer(localStorage.getItem(offerKey(userId))); } catch { return { ...EMPTY_HEALTH_OFFER }; }
};

export const dismissHealthOffer = (userId: string, now: number = Date.now()): HealthOfferState => {
  const next = dismissedHealthOffer(readHealthOffer(userId), now);
  try { localStorage.setItem(offerKey(userId), JSON.stringify(next)); } catch { /* noop */ }
  return next;
};
