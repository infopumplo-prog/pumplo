// Klient přes trenéra (26. 10. 2026, David): „Když jdu cvičit s trenérem, stačí
// registrační údaje. Dotazník až později, chytře a nevtíravě z Home.“
//
// Mechanismus bez migrace: krátká registrace zapíše user_profiles.onboarding_completed = true
// a primary_goal nechá null. Běžný dotazník (Auth i OnboardingDrawer) bez cíle nikdy nedokončí,
// takže „dokončeno + bez cíle“ = dotazník přeskočený. Platí na všech zařízeních (je to v profilu)
// a appka se chová jako po onboardingu (záložky, plány od trenéra), jen bez Pumplo plánu.
// Čistá logika bez Reactu a Supabase → testy v trainerClientOnboarding.test.ts.

import type { HomeTourStep } from '@/lib/onboardingFlow';

export type AuthVariant = 'trainer_light' | 'standard';

export interface AuthVariantInput {
  /** Odložený token pozvánky (readPendingTrainerInvite). */
  pendingInviteToken: string | null;
  /** Rozdělaná plná registrace (onboardingDraft) — má přednost, ať nepřijde o odpovědi. */
  hasOnboardingDraft: boolean;
}

/** Krátká registrace jen s platnou odloženou pozvánkou a bez rozdělaného dotazníku. */
export const authVariant = (i: AuthVariantInput): AuthVariant =>
  i.pendingInviteToken && !i.hasOnboardingDraft ? 'trainer_light' : 'standard';

export interface ProfileOnboardingState {
  onboarding_completed: boolean | null;
  primary_goal: string | null;
}

/** Krátká registrace přes trenéra: appka odemčená, dotazník (a Pumplo plán) zatím ne. */
export const isQuestionnaireSkipped = (profile: ProfileOnboardingState | null | undefined): boolean =>
  !!profile?.onboarding_completed && !profile.primary_goal;

/** Zápis do profilu po krátké registraci. current_step 0 = dotazník z Home začne od začátku. */
export const LIGHT_REGISTRATION_PATCH = {
  onboarding_completed: true,
  primary_goal: null,
  current_step: 0,
} as const;

/**
 * Dokončit krátkou registraci jen u profilu, který onboarding ještě nemá.
 * Hotový účet (i ten, kdo se při pozvánce jen přihlásil) zůstává beze změny.
 */
export const shouldApplyLightRegistration = (
  flagSet: boolean,
  profile: ProfileOnboardingState | null | undefined,
): boolean => flagSet && !!profile && !profile.onboarding_completed;

// --- Příznak „registrace přišla z pozvánky“ (Apple/Google odvedou z Auth dřív, než se zapíše profil) ---

export const LIGHT_SIGNUP_FLAG_KEY = 'pumplo_trainer_light_signup';
/** Starý příznak se nesmí uplatnit na pozdější, nesouvisející přihlášení. */
export const LIGHT_SIGNUP_FLAG_TTL_MS = 24 * 60 * 60 * 1000;

export const isLightSignupFlagFresh = (storedAt: number | null, now: number): boolean =>
  storedAt !== null && Number.isFinite(storedAt) && now - storedAt >= 0 && now - storedAt < LIGHT_SIGNUP_FLAG_TTL_MS;

export const markTrainerLightSignup = (now: number = Date.now()): void => {
  try { localStorage.setItem(LIGHT_SIGNUP_FLAG_KEY, String(now)); } catch { /* noop */ }
};

export const readTrainerLightSignup = (now: number = Date.now()): boolean => {
  let raw: string | null = null;
  try { raw = localStorage.getItem(LIGHT_SIGNUP_FLAG_KEY); } catch { return false; }
  if (raw === null) return false;
  const fresh = isLightSignupFlagFresh(Number(raw), now);
  if (!fresh) clearTrainerLightSignup();
  return fresh;
};

export const clearTrainerLightSignup = (): void => {
  try { localStorage.removeItem(LIGHT_SIGNUP_FLAG_KEY); } catch { /* noop */ }
};

// --- Karta „Chceš i vlastní plán od Pumpla?“ -------------------------------------------

export const QUESTIONNAIRE_CARD_RESHOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 'pumplo_tab' = obsah prázdné záložky Pumplo (bez odložení), 'custom_tab' = nenápadná karta pod plány od trenéra. */
export type QuestionnaireCardPlacement = 'pumplo_tab' | 'custom_tab';

export interface QuestionnaireCardInput {
  profile: ProfileOnboardingState | null | undefined;
  hasActivePlan: boolean;
  /** Plán se ještě načítá — nerozhodovat, ať karta neproblikne. */
  planLoading: boolean;
  placement: QuestionnaireCardPlacement;
  /** Kdy klient zmáčkl „Teď ne“ (ms), null = nikdy. */
  dismissedAt: number | null;
  now: number;
}

export const isQuestionnaireCardSnoozed = (dismissedAt: number | null, now: number): boolean =>
  dismissedAt !== null && Number.isFinite(dismissedAt) && now - dismissedAt >= 0
  && now - dismissedAt < QUESTIONNAIRE_CARD_RESHOW_DAYS * DAY_MS;

export const shouldShowQuestionnaireCard = (i: QuestionnaireCardInput): boolean => {
  if (!isQuestionnaireSkipped(i.profile)) return false;
  if (i.planLoading || i.hasActivePlan) return false;
  // Záložka Pumplo jinak nemá obsah → tam karta zůstává vždy; odložení platí jen pro tu nenápadnou.
  if (i.placement === 'pumplo_tab') return true;
  return !isQuestionnaireCardSnoozed(i.dismissedAt, i.now);
};

const dismissKey = (userId: string) => `pumplo_trainer_questionnaire_card_dismissed:${userId}`;

export const readQuestionnaireCardDismissedAt = (userId: string | null | undefined): number | null => {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(dismissKey(userId));
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
};

export const dismissQuestionnaireCard = (userId: string, now: number = Date.now()): void => {
  try { localStorage.setItem(dismissKey(userId), String(now)); } catch { /* bez úložiště se karta jen neodloží */ }
};

// --- Home ------------------------------------------------------------------------------

export type HomeTab = 'pumplo' | 'custom';

/**
 * Výchozí záložka Home: rozpracovaný vlastní trénink > uložená hvězdička > klient trenéra
 * bez dotazníku a bez Pumplo plánu → plány od trenéra. Kdo Pumplo plán má, zůstává na 'pumplo'.
 */
export const defaultHomeTab = (i: {
  storedFavorite: string | null;
  questionnaireSkipped: boolean;
  hasActivePlan: boolean;
  hasPausedCustomWorkout: boolean;
}): HomeTab => {
  if (i.hasPausedCustomWorkout) return 'custom';
  if (i.storedFavorite === 'pumplo' || i.storedFavorite === 'custom') return i.storedFavorite;
  return i.questionnaireSkipped && !i.hasActivePlan ? 'custom' : 'pumplo';
};

/** Průvodce Home pro klienta trenéra bez Pumplo plánu: krok „dnešní trénink“ by neměl na co ukázat. */
export const trainerClientHomeTourOrder = (): HomeTourStep[] =>
  ['tab_custom', 'tab_pumplo', 'nav_workouts', 'nav_map', 'nav_stats', 'nav_profile', 'help'];

/** Událost: profil se změnil mimo hook (dokončení krátké registrace) → useUserProfile se znovu načte. */
export const PROFILE_CHANGED_EVENT = 'pumplo:profile-changed';
export const notifyProfileChanged = (): void => {
  try { window.dispatchEvent(new Event(PROFILE_CHANGED_EVENT)); } catch { /* noop */ }
};
