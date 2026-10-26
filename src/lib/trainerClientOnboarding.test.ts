import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LIGHT_REGISTRATION_PATCH,
  LIGHT_SIGNUP_FLAG_KEY,
  LIGHT_SIGNUP_FLAG_TTL_MS,
  QUESTIONNAIRE_CARD_RESHOW_DAYS,
  authVariant,
  clearTrainerLightSignup,
  defaultHomeTab,
  dismissQuestionnaireCard,
  isQuestionnaireCardSnoozed,
  isQuestionnaireSkipped,
  markTrainerLightSignup,
  readQuestionnaireCardDismissedAt,
  readTrainerLightSignup,
  shouldApplyLightRegistration,
  shouldShowQuestionnaireCard,
  trainerClientHomeTourOrder,
  type QuestionnaireCardInput,
} from './trainerClientOnboarding';

const TOKEN = '91c3180a-909f-4d1d-8c03-193332e1c710';
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 26, 12, 0, 0);

const skipped = { onboarding_completed: true, primary_goal: null };
const onboarded = { onboarding_completed: true, primary_goal: 'muscle_gain' };
const notOnboarded = { onboarding_completed: false, primary_goal: null };

const makeStore = () => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => { data.set(k, String(v)); },
    removeItem: (k: string) => { data.delete(k); },
  };
};

describe('authVariant', () => {
  it('pending invite → short trainer registration', () => {
    expect(authVariant({ pendingInviteToken: TOKEN, hasOnboardingDraft: false })).toBe('trainer_light');
  });
  it('no invite → standard questionnaire flow', () => {
    expect(authVariant({ pendingInviteToken: null, hasOnboardingDraft: false })).toBe('standard');
  });
  it('an unfinished full registration (draft) wins over the invite', () => {
    expect(authVariant({ pendingInviteToken: TOKEN, hasOnboardingDraft: true })).toBe('standard');
  });
});

describe('isQuestionnaireSkipped', () => {
  it('completed onboarding without a goal = questionnaire skipped', () => {
    expect(isQuestionnaireSkipped(skipped)).toBe(true);
    expect(isQuestionnaireSkipped({ onboarding_completed: true, primary_goal: '' })).toBe(true);
  });
  it('normal onboarded users and unfinished users are not "skipped"', () => {
    expect(isQuestionnaireSkipped(onboarded)).toBe(false);
    expect(isQuestionnaireSkipped(notOnboarded)).toBe(false);
    expect(isQuestionnaireSkipped({ onboarding_completed: null, primary_goal: null })).toBe(false);
    expect(isQuestionnaireSkipped(null)).toBe(false);
    expect(isQuestionnaireSkipped(undefined)).toBe(false);
  });
  it('the light registration patch produces a skipped profile', () => {
    expect(isQuestionnaireSkipped({ ...notOnboarded, ...LIGHT_REGISTRATION_PATCH })).toBe(true);
  });
});

describe('shouldApplyLightRegistration', () => {
  it('only for a flagged sign-up whose profile has no onboarding yet', () => {
    expect(shouldApplyLightRegistration(true, notOnboarded)).toBe(true);
    expect(shouldApplyLightRegistration(false, notOnboarded)).toBe(false);
  });
  it('never touches an already onboarded account (existing user accepting an invite)', () => {
    expect(shouldApplyLightRegistration(true, onboarded)).toBe(false);
    expect(shouldApplyLightRegistration(true, skipped)).toBe(false);
  });
  it('waits for the profile row', () => {
    expect(shouldApplyLightRegistration(true, null)).toBe(false);
  });
});

describe('shouldShowQuestionnaireCard', () => {
  const base: QuestionnaireCardInput = {
    profile: skipped, hasActivePlan: false, planLoading: false, placement: 'custom_tab', dismissedAt: null, now: NOW,
  };

  it('shows for a trainer client who skipped the questionnaire', () => {
    expect(shouldShowQuestionnaireCard(base)).toBe(true);
    expect(shouldShowQuestionnaireCard({ ...base, placement: 'pumplo_tab' })).toBe(true);
  });
  it('never for normal users (onboarded or not)', () => {
    expect(shouldShowQuestionnaireCard({ ...base, profile: onboarded })).toBe(false);
    expect(shouldShowQuestionnaireCard({ ...base, profile: notOnboarded })).toBe(false);
    expect(shouldShowQuestionnaireCard({ ...base, profile: null })).toBe(false);
  });
  it('not once a generated Pumplo plan exists, nor while it is loading', () => {
    expect(shouldShowQuestionnaireCard({ ...base, hasActivePlan: true })).toBe(false);
    expect(shouldShowQuestionnaireCard({ ...base, hasActivePlan: true, placement: 'pumplo_tab' })).toBe(false);
    expect(shouldShowQuestionnaireCard({ ...base, planLoading: true })).toBe(false);
  });
  it('"Teď ne" hides the subtle card for 7 days, then it comes back', () => {
    expect(shouldShowQuestionnaireCard({ ...base, dismissedAt: NOW - DAY })).toBe(false);
    expect(shouldShowQuestionnaireCard({ ...base, dismissedAt: NOW - (QUESTIONNAIRE_CARD_RESHOW_DAYS * DAY - 1) })).toBe(false);
    expect(shouldShowQuestionnaireCard({ ...base, dismissedAt: NOW - QUESTIONNAIRE_CARD_RESHOW_DAYS * DAY })).toBe(true);
    expect(shouldShowQuestionnaireCard({ ...base, dismissedAt: NOW - 30 * DAY })).toBe(true);
  });
  it('the Pumplo tab content ignores dismissal (it would be empty otherwise)', () => {
    expect(shouldShowQuestionnaireCard({ ...base, placement: 'pumplo_tab', dismissedAt: NOW - DAY })).toBe(true);
  });
  it('a dismissal from the future (clock change) does not hide the card forever', () => {
    expect(isQuestionnaireCardSnoozed(NOW + DAY, NOW)).toBe(false);
    expect(isQuestionnaireCardSnoozed(Number.NaN, NOW)).toBe(false);
  });
});

describe('defaultHomeTab', () => {
  const tab = (o: Partial<Parameters<typeof defaultHomeTab>[0]>) => defaultHomeTab({
    storedFavorite: null, questionnaireSkipped: false, hasActivePlan: false, hasPausedCustomWorkout: false, ...o,
  });
  it('trainer client without stored favourite opens on trainer plans', () => {
    expect(tab({ questionnaireSkipped: true })).toBe('custom');
  });
  it('normal users keep the Pumplo tab default', () => {
    expect(tab({})).toBe('pumplo');
    expect(tab({ hasActivePlan: true })).toBe('pumplo');
  });
  it('a skipped-questionnaire profile that has a Pumplo plan keeps the Pumplo default', () => {
    expect(tab({ questionnaireSkipped: true, hasActivePlan: true })).toBe('pumplo');
  });
  it('stored favourite and paused custom workout win', () => {
    expect(tab({ storedFavorite: 'pumplo', questionnaireSkipped: true })).toBe('pumplo');
    expect(tab({ storedFavorite: 'custom' })).toBe('custom');
    expect(tab({ storedFavorite: 'pumplo', hasPausedCustomWorkout: true })).toBe('custom');
    expect(tab({ storedFavorite: 'garbage' })).toBe('pumplo');
  });
});

describe('trainerClientHomeTourOrder', () => {
  it('starts with trainer plans and skips the "today" step (no Pumplo plan)', () => {
    const order = trainerClientHomeTourOrder();
    expect(order[0]).toBe('tab_custom');
    expect(order).not.toContain('today');
  });
});

describe('storage helpers', () => {
  let store: ReturnType<typeof makeStore>;
  beforeEach(() => { store = makeStore(); vi.stubGlobal('localStorage', store); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('light sign-up flag is fresh for 24 h, then dropped', () => {
    markTrainerLightSignup(NOW);
    expect(readTrainerLightSignup(NOW + 1000)).toBe(true);
    expect(readTrainerLightSignup(NOW + LIGHT_SIGNUP_FLAG_TTL_MS)).toBe(false);
    expect(store.data.has(LIGHT_SIGNUP_FLAG_KEY)).toBe(false);
  });
  it('garbage flag is dropped, clear removes it', () => {
    store.setItem(LIGHT_SIGNUP_FLAG_KEY, 'x');
    expect(readTrainerLightSignup(NOW)).toBe(false);
    expect(store.data.has(LIGHT_SIGNUP_FLAG_KEY)).toBe(false);
    markTrainerLightSignup(NOW);
    clearTrainerLightSignup();
    expect(readTrainerLightSignup(NOW)).toBe(false);
  });
  it('card dismissal is stored per user', () => {
    expect(readQuestionnaireCardDismissedAt('u1')).toBeNull();
    dismissQuestionnaireCard('u1', NOW);
    expect(readQuestionnaireCardDismissedAt('u1')).toBe(NOW);
    expect(readQuestionnaireCardDismissedAt('u2')).toBeNull();
    expect(readQuestionnaireCardDismissedAt(null)).toBeNull();
  });
});
