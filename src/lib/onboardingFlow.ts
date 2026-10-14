// Onboarding 2.0 (fáze 1, 8. 10. 2026): pojmenované kroky místo čísel, kapitoly,
// reakce trenéra po volbách, otázky na motivaci a očekávání a volba plánu na konci.
// Čistá logika bez Reactu — pořadí a pravidla jdou otestovat bez UI.

import type { TrainingGoalId, UserLevel } from '@/lib/trainingGoals';

export type OnboardingStepId =
  | 'name'
  | 'goal'
  | 'proof_goal'
  | 'motivation'
  | 'level'
  | 'proof_level'
  | 'days'
  | 'time'
  | 'demographics'
  | 'injuries'
  | 'equipment'
  | 'expectations'
  | 'proof_plan'
  | 'register';

/** Pořadí kroků. Barva appky se volí hned u jména (David 8. 10.). Po 'expectations' přijde souhrn a volba plánu, pak registrace. */
export const ONBOARDING_STEPS: OnboardingStepId[] = [
  'name',
  'goal',
  'proof_goal',
  'motivation',
  'level',
  'proof_level',
  'days',
  'time',
  'demographics',
  'injuries',
  'equipment',
  'expectations',
  'proof_plan',
  'register',
];

export const REGISTER_STEP_INDEX = ONBOARDING_STEPS.indexOf('register');
export const LAST_QUESTION_INDEX = REGISTER_STEP_INDEX - 1;

/** Grafiky se social proof mezi kroky (David 8. 10.) — skutečná čísla, obsah podle jejich voleb. */
export const PROOF_STEPS: OnboardingStepId[] = ['proof_goal', 'proof_level', 'proof_plan'];
export const isProofStep = (id: OnboardingStepId): boolean => PROOF_STEPS.includes(id);

export type ChapterId = 'you' | 'training' | 'pumplo';

/** Kapitoly místo „Krok 7 z 11“ — dotazník nepůsobí dlouze. */
export const CHAPTERS: { id: ChapterId; steps: OnboardingStepId[] }[] = [
  { id: 'you', steps: ['name', 'goal', 'proof_goal', 'motivation'] },
  { id: 'training', steps: ['level', 'proof_level', 'days', 'time', 'demographics', 'injuries', 'equipment'] },
  { id: 'pumplo', steps: ['expectations', 'proof_plan', 'register'] },
];

export interface ChapterPosition {
  chapter: ChapterId;
  chapterIndex: number;
  chapterCount: number;
  stepInChapter: number;
  chapterSize: number;
  /** 0–100 přes celý dotazník. */
  progress: number;
}

export const chapterPosition = (stepIndex: number): ChapterPosition => {
  const clamped = Math.min(Math.max(stepIndex, 0), ONBOARDING_STEPS.length - 1);
  const id = ONBOARDING_STEPS[clamped];
  const chapterIndex = CHAPTERS.findIndex((c) => c.steps.includes(id));
  const chapter = CHAPTERS[chapterIndex];
  return {
    chapter: chapter.id,
    chapterIndex,
    chapterCount: CHAPTERS.length,
    stepInChapter: chapter.steps.indexOf(id),
    chapterSize: chapter.steps.length,
    progress: Math.round(((clamped + 1) / ONBOARDING_STEPS.length) * 100),
  };
};

// --- Nové otázky -----------------------------------------------------------------
export const MOTIVATIONS = ['feel_better', 'look_better', 'health', 'strength', 'confidence', 'sport'] as const;
// 'community' doplňuje prázdné šesté místo v mřížce (feedback 13. 10.).
export const EXPECTATIONS = ['custom_plan', 'guidance', 'progress', 'consistency', 'build_own', 'community'] as const;
export type Motivation = (typeof MOTIVATIONS)[number];
export type Expectation = (typeof EXPECTATIONS)[number];

/** Volné odpovědi: krátké, ať dotazník zůstane rychlý. Zranění volný text nemají (David 8. 10.). */
export const FREE_TEXT_MAX = 300;
export const clampFreeText = (s: string): string => s.slice(0, FREE_TEXT_MAX);

// --- Volba plánu na konci ------------------------------------------------------------
export type PlanChoice = 'pumplo' | 'trainer' | 'own';
export const PLAN_CHOICES: PlanChoice[] = ['pumplo', 'trainer', 'own'];

/** Kam po registraci. Vlastní plán potřebuje id nově založeného plánu. */
export const routeAfterRegistration = (choice: PlanChoice, ownPlanId?: string | null): string => {
  if (choice === 'trainer') return '/workouts';
  if (choice === 'own' && ownPlanId) return `/custom-plan/${ownPlanId}`;
  return '/';
};

// --- Reakce trenéra -------------------------------------------------------------------
export interface OnboardingAnswers {
  firstName: string;
  goal: TrainingGoalId | null;
  motivations: Motivation[];
  level: UserLevel | null;
  trainingDays: string[];
  expectations: Expectation[];
}

export interface Reaction {
  /** i18n klíč (onboarding.react_*) */
  key: string;
  params: Record<string, string | number>;
}

const firstWord = (s: string) => s.trim().split(/\s+/)[0] ?? '';

/**
 * Bublina od trenéra k odpovědi z předchozího kroku (ukazuje se nahoře na dalším kroku —
 * výběr cíle posune dotazník sám, reakce na stejném kroku by nebyla vidět).
 * Texty slibují, co uděláme my, nikdy konkrétní výsledek („−5 kg“).
 */
export const reactionFor = (step: OnboardingStepId, a: OnboardingAnswers): Reaction | null => {
  const name = firstWord(a.firstName);
  const withName = (key: string, params: Record<string, string | number> = {}): Reaction =>
    name ? { key: `${key}_named`, params: { name, ...params } } : { key, params };

  switch (step) {
    case 'name':
      return name.length >= 2 ? { key: 'onboarding.react_name', params: { name } } : null;
    case 'goal':
      return a.goal ? withName(`onboarding.react_goal_${a.goal}`) : null;
    case 'motivation':
      return a.motivations.length ? { key: `onboarding.react_motivation_${a.motivations[0]}`, params: {} } : null;
    case 'level':
      return a.level ? { key: `onboarding.react_level_${a.level}`, params: {} } : null;
    case 'days': {
      const n = a.trainingDays.length;
      if (!n) return null;
      return { key: n >= 5 ? 'onboarding.react_days_lots' : 'onboarding.react_days', params: { count: n } };
    }
    case 'expectations':
      if (!a.expectations.length) return null;
      return {
        key: a.expectations.includes('build_own') ? 'onboarding.react_expect_build_own' : 'onboarding.react_expect',
        params: {},
      };
    default:
      return null;
  }
};

/** Doporučená volba plánu podle očekávání: kdo chce stavět sám, má předvybraný vlastní plán. */
export const suggestedPlanChoice = (expectations: Expectation[]): PlanChoice =>
  expectations.includes('build_own') ? 'own' : 'pumplo';

// --- Nápověda podle volby plánu (David 8. 10.) ------------------------------------------------
const PLAN_CHOICE_KEY = 'pumplo:plan-choice';

/** Zapamatuje volbu z konce dotazníku — průvodci (CoachTour) podle ní řadí a formulují kroky. */
export const savePlanChoice = (choice: PlanChoice): void => {
  try { localStorage.setItem(PLAN_CHOICE_KEY, choice); } catch { /* bez úložiště jen výchozí průvodce */ }
};

export const readPlanChoice = (): PlanChoice | null => {
  try {
    const v = localStorage.getItem(PLAN_CHOICE_KEY);
    return v === 'pumplo' || v === 'trainer' || v === 'own' ? v : null;
  } catch {
    return null;
  }
};

export type HomeTourStep = 'today' | 'tab_pumplo' | 'tab_custom' | 'nav_workouts' | 'nav_map' | 'nav_stats' | 'nav_profile' | 'help';

/** Průvodce na Domů začne tím, co si člověk zvolil; obecné kroky (mapa, statistiky…) zůstávají na konci. */
export const homeTourOrder = (choice: PlanChoice | null): HomeTourStep[] => {
  const tail: HomeTourStep[] = ['nav_map', 'nav_stats', 'nav_profile', 'help'];
  if (choice === 'trainer') return ['nav_workouts', 'tab_custom', 'today', 'tab_pumplo', ...tail];
  if (choice === 'own') return ['tab_custom', 'nav_workouts', 'tab_pumplo', 'today', ...tail];
  return ['today', 'tab_pumplo', 'tab_custom', 'nav_workouts', ...tail];
};
