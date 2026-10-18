// In-app žádost o souhlas s tipy e-mailem (F1 e-maily, 19. 10. 2026).
//
// Stávající uživatelé se registrovali bez možnosti odmítnout obchodní e-maily
// (§ 7 odst. 3 zák. 480/2004 Sb.), takže jim M3–M8 smí chodit jen se souhlasem.
// Jednou se jich zeptáme na Home: Ano → marketing_consent_at, Ne → marketing_optout_at.
// Nikdy během tréninku (jen Home, ne s rozpracovaným tréninkem) a ne přes jiné panely.
// Právní brána je sdílená s lifecycle-emails (legalGate) — jeden zdroj pravdy.
import { legalGate } from '../../supabase/functions/lifecycle-emails/rules';

export const EMAIL_CONSENT_SEEN_KEY = 'pumplo_email_consent_asked';

export interface ConsentProfile {
  marketing_consent_at?: string | null;
  email_optout_offered_at?: string | null;
  marketing_optout_at?: string | null;
  email_unsubscribed_at?: string | null;
}

/** Smí uživateli chodit obchodní e-maily (tipy)? Stejná brána jako lifecycle-emails. */
export const hasMarketingBasis = (p: ConsentProfile | null | undefined): boolean =>
  !!p && legalGate({
    marketingConsentAt: p.marketing_consent_at ?? null,
    emailOptoutOfferedAt: p.email_optout_offered_at ?? null,
    marketingOptoutAt: p.marketing_optout_at ?? null,
    emailUnsubscribedAt: p.email_unsubscribed_at ?? null,
  }) === 'ok';

export interface EmailConsentAskInput {
  isSignedIn: boolean;
  isGuest?: boolean;
  onboardingCompleted: boolean;
  profile: ConsentProfile | null | undefined;
  /** Rozpracovaný (pozastavený) trénink — teď se neptat. */
  hasPausedWorkout: boolean;
  /** Jiný panel / prohlídka / karta prvního tréninku je na obrazovce. */
  otherOverlayActive: boolean;
  /** Žádost už jednou byla ukázaná (localStorage). */
  alreadyAsked: boolean;
}

/**
 * Zeptat se jen lidí, kteří nemají ani souhlas, ani nabídnuté odmítnutí z registrace,
 * a sami už tipy neodmítli ani se neodhlásili. Jednou za život (alreadyAsked / odpověď).
 */
export function shouldAskEmailConsent(i: EmailConsentAskInput): boolean {
  if (!i.isSignedIn || i.isGuest || !i.onboardingCompleted || !i.profile) return false;
  if (i.alreadyAsked || i.hasPausedWorkout || i.otherOverlayActive) return false;
  const p = i.profile;
  if (p.marketing_consent_at || p.email_optout_offered_at) return false;
  if (p.marketing_optout_at || p.email_unsubscribed_at) return false;
  return true;
}

export type ConsentAnswer = 'yes' | 'no';

/** Co zapsat do user_profiles po odpovědi. */
export function consentUpdate(answer: ConsentAnswer, now: Date = new Date()): ConsentProfile {
  return answer === 'yes'
    ? { marketing_consent_at: now.toISOString(), marketing_optout_at: null }
    : { marketing_optout_at: now.toISOString() };
}

export const readEmailConsentAsked = (): boolean => {
  try {
    return localStorage.getItem(EMAIL_CONSENT_SEEN_KEY) !== null;
  } catch {
    // Bez localStorage se raději neptáme opakovaně.
    return true;
  }
};

export const markEmailConsentAsked = (): void => {
  try {
    localStorage.setItem(EMAIL_CONSENT_SEEN_KEY, new Date().toISOString());
  } catch {
    /* noop */
  }
};
