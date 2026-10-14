import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, p?: Record<string, unknown>) => (p ? `${k}${JSON.stringify(p)}` : k) }),
}));

import OnboardingPlanChoice from './OnboardingPlanChoice';

const base = { onChange: () => {}, level: 'beginner' as const, trainingDays: ['tuesday', 'thursday', 'saturday'], splitOverride: null, exercisesLabel: '250+' };

describe('OnboardingPlanChoice', () => {
  it('disables the trainer option when the catalog is empty', () => {
    const html = renderToString(createElement(OnboardingPlanChoice, { ...base, value: 'pumplo', trainerWorkouts: 0 }));
    expect(html).toContain('onboarding.plan_choice_soon');
    expect((html.match(/disabled=""/g) ?? []).length).toBe(1);
  });

  it('offers the trainer option when there are trainer workouts', () => {
    const html = renderToString(createElement(OnboardingPlanChoice, { ...base, value: 'trainer', trainerWorkouts: 4 }));
    expect(html).not.toContain('onboarding.plan_choice_soon');
    expect(html).toContain('onboarding.plan_choice_trainer_next{&quot;count&quot;:4}');
  });

  it('explains the Pumplo plan with split and the chosen days', () => {
    const html = renderToString(createElement(OnboardingPlanChoice, { ...base, value: 'pumplo', trainerWorkouts: 0 }));
    expect(html).toContain('onboarding.plan_choice_pumplo_next');
    expect(html).toContain('&quot;times&quot;:3');
    expect(html).toContain('onboarding.days_tuesday, onboarding.days_thursday, onboarding.days_saturday');
  });

  it('explains the own plan with the real exercise count', () => {
    const html = renderToString(createElement(OnboardingPlanChoice, { ...base, value: 'own', trainerWorkouts: 0 }));
    expect(html).toContain('onboarding.plan_choice_own_next{&quot;n&quot;:&quot;250+&quot;}');
  });
});
