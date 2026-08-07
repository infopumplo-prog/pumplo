// Onboarding answers survive the registration window.
//
// The questionnaire lives in browser memory for seven steps and is written to
// the profile only AFTER the account exists. Anything that interrupts that
// window — a stalled signup, a killed webview, a failed profile write — used to
// destroy all seven steps of answers silently: the account was created, the
// profile stayed empty, and the person was told registration had failed. They
// never logged in again (why would they?), so the in-app "finish onboarding"
// banner never reached them.
//
// The draft is written before the account is created and cleared only once the
// profile is confirmed, so the answers outlive every failure in between.

import { TrainingGoalId, UserLevel, SplitType } from '@/lib/trainingGoals';

const KEY = 'pumplo:onboarding-draft';

export interface OnboardingDraft {
  firstName: string;
  lastName: string;
  regEmail: string;
  primaryGoal: TrainingGoalId | null;
  userLevel: UserLevel | null;
  trainingDays: string[];
  preferredTime: string | null;
  trainingDuration: number;
  gender: string | null;
  age: string;
  height: string;
  weight: string;
  injuries: string[];
  equipmentPreference: string | null;
  selectedGymId: string | null;
  splitOverride?: SplitType | null;
}

// Never persisted: the password. A draft is recoverable input, not a credential.
export const saveOnboardingDraft = (draft: OnboardingDraft): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // A full or blocked storage must never stop someone from registering.
  }
};

export const loadOnboardingDraft = (): OnboardingDraft | null => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OnboardingDraft;
    // A draft without a goal cannot rebuild a plan — treat it as absent.
    return parsed && typeof parsed === 'object' && parsed.primaryGoal ? parsed : null;
  } catch {
    return null;
  }
};

export const clearOnboardingDraft = (): void => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // noop
  }
};
