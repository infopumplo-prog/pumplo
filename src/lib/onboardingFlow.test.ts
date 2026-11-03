import { describe, expect, it } from 'vitest';
import {
  CHAPTERS,
  FREE_TEXT_MAX,
  ONBOARDING_STEPS,
  REGISTER_STEP_INDEX,
  LAST_QUESTION_INDEX,
  chapterPosition,
  clampFreeText,
  reactionFor,
  routeAfterRegistration,
  suggestedPlanChoice,
  type OnboardingAnswers,
} from './onboardingFlow';

const answers = (over: Partial<OnboardingAnswers> = {}): OnboardingAnswers => ({
  firstName: '',
  goal: null,
  motivations: [],
  level: null,
  trainingDays: [],
  expectations: [],
  ...over,
});

describe('step order and chapters', () => {
  it('asks the name first and ends with registration', () => {
    expect(ONBOARDING_STEPS[0]).toBe('name');
    expect(ONBOARDING_STEPS[REGISTER_STEP_INDEX]).toBe('register');
    expect(ONBOARDING_STEPS[LAST_QUESTION_INDEX]).toBe('proof_plan');
  });

  it('every step belongs to exactly one chapter, in the same order', () => {
    expect(CHAPTERS.flatMap((c) => c.steps)).toEqual(ONBOARDING_STEPS);
  });

  it('reports chapter position and progress', () => {
    expect(chapterPosition(0)).toMatchObject({ chapter: 'you', chapterIndex: 0, stepInChapter: 0, chapterSize: 4 });
    expect(chapterPosition(ONBOARDING_STEPS.indexOf('level'))).toMatchObject({ chapter: 'training', chapterIndex: 1, stepInChapter: 0 });
    expect(chapterPosition(REGISTER_STEP_INDEX)).toMatchObject({ chapter: 'pumplo', progress: 100 });
    expect(chapterPosition(99).progress).toBe(100);
  });
});

describe('reactions', () => {
  it('stays silent until the question is answered', () => {
    for (const step of ONBOARDING_STEPS) expect(reactionFor(step, answers())).toBeNull();
  });

  it('greets by first name only', () => {
    expect(reactionFor('name', answers({ firstName: '  Klára Nová ' }))).toEqual({ key: 'onboarding.react_name', params: { name: 'Klára' } });
    expect(reactionFor('name', answers({ firstName: 'K' }))).toBeNull();
  });

  it('uses the named variant of goal reactions when a name exists', () => {
    expect(reactionFor('goal', answers({ goal: 'fat_loss' }))?.key).toBe('onboarding.react_goal_fat_loss');
    expect(reactionFor('goal', answers({ goal: 'fat_loss', firstName: 'Klára' }))).toEqual({
      key: 'onboarding.react_goal_fat_loss_named',
      params: { name: 'Klára' },
    });
  });

  it('reacts to the number of training days', () => {
    expect(reactionFor('days', answers({ trainingDays: ['po', 'st', 'pa'] }))).toEqual({
      key: 'onboarding.react_days',
      params: { count: 3 },
    });
    expect(reactionFor('days', answers({ trainingDays: ['1', '2', '3', '4', '5'] }))?.key).toBe('onboarding.react_days_lots');
  });

  it('reacts to wanting an own plan', () => {
    expect(reactionFor('expectations', answers({ expectations: ['guidance', 'build_own'] }))?.key).toBe('onboarding.react_expect_build_own');
    expect(reactionFor('expectations', answers({ expectations: ['guidance'] }))?.key).toBe('onboarding.react_expect');
  });
});

describe('plan choice', () => {
  it('routes after registration', () => {
    expect(routeAfterRegistration('pumplo')).toBe('/');
    expect(routeAfterRegistration('trainer')).toBe('/workouts');
    expect(routeAfterRegistration('own', 'abc')).toBe('/custom-plan/abc');
    expect(routeAfterRegistration('own', null)).toBe('/');
  });

  it('suggests own plan to people who want to build it themselves', () => {
    expect(suggestedPlanChoice(['build_own'])).toBe('own');
    expect(suggestedPlanChoice(['guidance'])).toBe('pumplo');
  });

  it('clamps free text', () => {
    expect(clampFreeText('x'.repeat(FREE_TEXT_MAX + 50))).toHaveLength(FREE_TEXT_MAX);
  });
});

describe('social proof screens', () => {
  it('follow the goal, the level and the expectations', async () => {
    const { isProofStep } = await import('./onboardingFlow');
    expect(ONBOARDING_STEPS[ONBOARDING_STEPS.indexOf('goal') + 1]).toBe('proof_goal');
    expect(ONBOARDING_STEPS[ONBOARDING_STEPS.indexOf('level') + 1]).toBe('proof_level');
    expect(ONBOARDING_STEPS[ONBOARDING_STEPS.indexOf('expectations') + 1]).toBe('proof_plan');
    expect(isProofStep('proof_goal')).toBe(true);
    expect(isProofStep('goal')).toBe(false);
  });
});

describe('help tours follow the plan choice', () => {
  it('starts the home tour with what the person chose', async () => {
    const { homeTourOrder } = await import('./onboardingFlow');
    expect(homeTourOrder('pumplo')[0]).toBe('today');
    expect(homeTourOrder(null)[0]).toBe('today');
    expect(homeTourOrder('trainer')[0]).toBe('nav_workouts');
    expect(homeTourOrder('own')[0]).toBe('tab_custom');
  });

  it('always covers every step exactly once, help last', async () => {
    const { homeTourOrder } = await import('./onboardingFlow');
    for (const c of ['pumplo', 'trainer', 'own', null] as const) {
      const order = homeTourOrder(c);
      expect(new Set(order).size).toBe(order.length);
      expect(order).toHaveLength(8);
      expect(order[order.length - 1]).toBe('help');
    }
  });
});
