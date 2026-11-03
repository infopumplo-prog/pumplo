import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, p?: Record<string, unknown>) => (p ? `${k}${JSON.stringify(p)}` : k) }),
}));
vi.mock('@/assets/david-benisek.png', () => ({ default: 'david.png' }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import OnboardingProofStep from './OnboardingProofStep';

const proof = { exercisesWithVideo: 254, gyms: 3, members: 124, trainerWorkouts: 0, goalShare: { fat_loss: 0.379, strength: 0.121 } };
const base = { goal: 'fat_loss' as const, level: 'beginner' as const, trainingDays: ['monday', 'wednesday', 'friday'], durationMinutes: 60 };

describe('OnboardingProofStep', () => {
  it('goal: shows the real share for the chosen goal, floored', () => {
    const html = renderToString(createElement(OnboardingProofStep, { variant: 'goal', ...base, proof: proof }));
    expect(html).toMatch(/37(<!-- -->)? %/);
    expect(html).toContain('onboarding.proof_goal_share{&quot;percent&quot;:37');
    expect(html).toContain('onboarding.proof_goal_method_fat_loss');
  });

  it('goal: without data shows no number at all', () => {
    const html = renderToString(createElement(OnboardingProofStep, { variant: 'goal', ...base, proof: null }));
    expect(html).not.toMatch(/\d+(<!-- -->)? %/);
    expect(html).not.toContain('proof_goal_share');
  });

  it('level: trainer + floored exercise count + level line', () => {
    const html = renderToString(createElement(OnboardingProofStep, { variant: 'level', ...base, proof: proof }));
    expect(html).toContain('David Beníšek');
    expect(html).toContain('250+');
    expect(html).toContain('onboarding.proof_level_beginner');
  });

  it('plan: highlights the chosen days and uses their duration', () => {
    const html = renderToString(createElement(OnboardingProofStep, { variant: 'plan', ...base, proof: proof }));
    expect(html).toContain('onboarding.proof_plan_week{&quot;count&quot;:3,&quot;minutes&quot;:60}');
    expect(html).toContain('onboarding.proof_plan_exercises{&quot;n&quot;:&quot;250+&quot;}');
    expect((html.match(/bg-white text-primary/g) ?? []).length).toBe(3);
  });

  it('plan: without data falls back to the no-number line', () => {
    const html = renderToString(createElement(OnboardingProofStep, { variant: 'plan', ...base, proof: null }));
    expect(html).toContain('onboarding.proof_plan_exercises_nonumber');
    expect(html).not.toContain('250');
  });
});
