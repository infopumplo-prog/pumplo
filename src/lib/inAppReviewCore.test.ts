import { describe, it, expect } from 'vitest';
import {
  EMPTY_REVIEW_STATE,
  REVIEW_COOLDOWN_DAYS,
  decideReviewPrompt,
  isInCooldown,
  markReviewAsked,
  parseReviewState,
  pendingMilestone,
  type ReviewContext,
} from './inAppReviewCore';

const NOW = new Date('2026-10-17T12:00:00Z');
const daysBefore = (d: number) => new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000).toISOString();

const ctx = (over: Partial<ReviewContext> = {}): ReviewContext => ({
  isNative: true,
  isGuest: false,
  afterWorkoutCompleted: true,
  completedWorkouts: 3,
  now: NOW,
  state: { askedMilestones: [], lastAskedAt: null },
  ...over,
});

describe('decideReviewPrompt — gates', () => {
  it('asks after the 3rd completed workout on native', () => {
    expect(decideReviewPrompt(ctx())).toEqual({ ask: true, milestone: 3 });
  });

  it('never on web / PWA', () => {
    expect(decideReviewPrompt(ctx({ isNative: false }))).toEqual({ ask: false, reason: 'not_native' });
  });

  it('never for guests', () => {
    expect(decideReviewPrompt(ctx({ isGuest: true }))).toEqual({ ask: false, reason: 'guest' });
  });

  it('never outside the finish-workout flow (app launch / resume)', () => {
    expect(decideReviewPrompt(ctx({ afterWorkoutCompleted: false }))).toEqual({ ask: false, reason: 'not_after_workout' });
  });

  it('skips when the workout count is unknown', () => {
    expect(decideReviewPrompt(ctx({ completedWorkouts: null }))).toEqual({ ask: false, reason: 'unknown_count' });
    expect(decideReviewPrompt(ctx({ completedWorkouts: Number.NaN }))).toEqual({ ask: false, reason: 'unknown_count' });
  });
});

describe('decideReviewPrompt — milestones 3 / 10 / 25', () => {
  it.each([0, 1, 2])('no prompt after %i workouts', (n) => {
    expect(decideReviewPrompt(ctx({ completedWorkouts: n }))).toEqual({ ask: false, reason: 'no_milestone' });
  });

  it('no prompt between milestones once the lower one was used', () => {
    const state = { askedMilestones: [3], lastAskedAt: daysBefore(90) };
    for (const n of [4, 5, 9]) {
      expect(decideReviewPrompt(ctx({ completedWorkouts: n, state }))).toEqual({ ask: false, reason: 'no_milestone' });
    }
  });

  it('asks at 10 and 25 when the cooldown has passed', () => {
    expect(decideReviewPrompt(ctx({ completedWorkouts: 10, state: { askedMilestones: [3], lastAskedAt: daysBefore(61) } })))
      .toEqual({ ask: true, milestone: 10 });
    expect(decideReviewPrompt(ctx({ completedWorkouts: 25, state: { askedMilestones: [3, 10], lastAskedAt: daysBefore(61) } })))
      .toEqual({ ask: true, milestone: 25 });
  });

  it('existing user past several milestones is asked once, for the highest one', () => {
    expect(decideReviewPrompt(ctx({ completedWorkouts: 40 }))).toEqual({ ask: true, milestone: 25 });
  });

  it('never again after all milestones are used', () => {
    const state = { askedMilestones: [3, 10, 25], lastAskedAt: daysBefore(400) };
    expect(decideReviewPrompt(ctx({ completedWorkouts: 100, state }))).toEqual({ ask: false, reason: 'no_milestone' });
  });
});

describe('cooldown (max once per 60 days)', () => {
  it('blocks a pending milestone inside 60 days', () => {
    const state = { askedMilestones: [3], lastAskedAt: daysBefore(REVIEW_COOLDOWN_DAYS - 1) };
    expect(decideReviewPrompt(ctx({ completedWorkouts: 10, state }))).toEqual({ ask: false, reason: 'cooldown' });
  });

  it('allows exactly at 60 days', () => {
    const state = { askedMilestones: [3], lastAskedAt: daysBefore(REVIEW_COOLDOWN_DAYS) };
    expect(decideReviewPrompt(ctx({ completedWorkouts: 10, state }))).toEqual({ ask: true, milestone: 10 });
  });

  it('isInCooldown ignores missing or broken timestamps', () => {
    expect(isInCooldown({ askedMilestones: [], lastAskedAt: null }, NOW)).toBe(false);
    expect(isInCooldown({ askedMilestones: [], lastAskedAt: 'nope' }, NOW)).toBe(false);
  });
});

describe('state helpers', () => {
  it('markReviewAsked consumes the milestone and all lower ones', () => {
    const next = markReviewAsked(EMPTY_REVIEW_STATE, 25, NOW);
    expect(next).toEqual({ askedMilestones: [3, 10, 25], lastAskedAt: NOW.toISOString() });
    expect(pendingMilestone(30, next)).toBeNull();
  });

  it('markReviewAsked keeps earlier milestones without duplicates', () => {
    const next = markReviewAsked({ askedMilestones: [3], lastAskedAt: daysBefore(70) }, 10, NOW);
    expect(next.askedMilestones).toEqual([3, 10]);
  });

  it('parseReviewState survives empty, invalid and partial JSON', () => {
    expect(parseReviewState(null)).toEqual({ askedMilestones: [], lastAskedAt: null });
    expect(parseReviewState('{oops')).toEqual({ askedMilestones: [], lastAskedAt: null });
    expect(parseReviewState('null')).toEqual({ askedMilestones: [], lastAskedAt: null });
    expect(parseReviewState('{"askedMilestones":[3,"x"],"lastAskedAt":"bad"}')).toEqual({ askedMilestones: [3], lastAskedAt: null });
    const ok = JSON.stringify({ askedMilestones: [3, 10], lastAskedAt: NOW.toISOString() });
    expect(parseReviewState(ok)).toEqual({ askedMilestones: [3, 10], lastAskedAt: NOW.toISOString() });
  });
});
