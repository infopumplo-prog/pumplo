/**
 * In-app review prompt — pure decision logic (no Capacitor, no storage), unit-tested.
 *
 * Rules (ASO audit 17. 10. 2026):
 * - ask after the 3rd, 10th and 25th completed workout,
 * - never for guests (pumplo_guest),
 * - at most once per 60 days,
 * - only right after a workout is finished — never on app launch / resume,
 * - only on native platforms (iOS / Android).
 *
 * Milestones are "reached" when the user's completed-workout count is >= the milestone,
 * so a queued save or an existing user who already has 40 workouts still gets asked once
 * (for the highest reached milestone) instead of never. Asking for a milestone also marks
 * all lower milestones as done, so one finished workout never produces two prompts.
 */

export const REVIEW_MILESTONES = [3, 10, 25] as const;
export const REVIEW_COOLDOWN_DAYS = 60;
export const REVIEW_STATE_KEY = 'pumplo_review_prompt';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ReviewState {
  /** Milestones already used (asked, or skipped because a higher one was asked). */
  askedMilestones: number[];
  /** ISO timestamp of the last time the system review dialog was requested. */
  lastAskedAt: string | null;
}

export interface ReviewContext {
  isNative: boolean;
  isGuest: boolean;
  /** True only when called from the finish-workout flow. */
  afterWorkoutCompleted: boolean;
  /** Completed workouts of the signed-in user (null = unknown / failed to load). */
  completedWorkouts: number | null;
  now: Date;
  state: ReviewState;
}

export type ReviewSkipReason =
  | 'not_native'
  | 'guest'
  | 'not_after_workout'
  | 'unknown_count'
  | 'no_milestone'
  | 'cooldown';

export type ReviewDecision =
  | { ask: true; milestone: number }
  | { ask: false; reason: ReviewSkipReason };

export const EMPTY_REVIEW_STATE: ReviewState = { askedMilestones: [], lastAskedAt: null };

export const parseReviewState = (raw: string | null | undefined): ReviewState => {
  if (!raw) return { ...EMPTY_REVIEW_STATE, askedMilestones: [] };
  try {
    const v = JSON.parse(raw) as Partial<ReviewState> | null;
    const asked = Array.isArray(v?.askedMilestones)
      ? v!.askedMilestones.filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
      : [];
    const last = typeof v?.lastAskedAt === 'string' && !Number.isNaN(Date.parse(v.lastAskedAt))
      ? v.lastAskedAt
      : null;
    return { askedMilestones: asked, lastAskedAt: last };
  } catch {
    return { ...EMPTY_REVIEW_STATE, askedMilestones: [] };
  }
};

/** Highest milestone the user has reached that hasn't been used yet. */
export const pendingMilestone = (completedWorkouts: number, state: ReviewState): number | null => {
  const reached = REVIEW_MILESTONES.filter(
    (m) => completedWorkouts >= m && !state.askedMilestones.includes(m),
  );
  return reached.length ? reached[reached.length - 1] : null;
};

export const isInCooldown = (state: ReviewState, now: Date): boolean => {
  if (!state.lastAskedAt) return false;
  const last = Date.parse(state.lastAskedAt);
  if (Number.isNaN(last)) return false;
  return now.getTime() - last < REVIEW_COOLDOWN_DAYS * DAY_MS;
};

export const decideReviewPrompt = (ctx: ReviewContext): ReviewDecision => {
  if (!ctx.isNative) return { ask: false, reason: 'not_native' };
  if (ctx.isGuest) return { ask: false, reason: 'guest' };
  if (!ctx.afterWorkoutCompleted) return { ask: false, reason: 'not_after_workout' };
  if (ctx.completedWorkouts === null || !Number.isFinite(ctx.completedWorkouts)) {
    return { ask: false, reason: 'unknown_count' };
  }
  const milestone = pendingMilestone(ctx.completedWorkouts, ctx.state);
  if (milestone === null) return { ask: false, reason: 'no_milestone' };
  if (isInCooldown(ctx.state, ctx.now)) return { ask: false, reason: 'cooldown' };
  return { ask: true, milestone };
};

/** State after the system dialog was requested for `milestone` (lower milestones are consumed too). */
export const markReviewAsked = (state: ReviewState, milestone: number, now: Date): ReviewState => {
  const consumed = REVIEW_MILESTONES.filter((m) => m <= milestone);
  return {
    askedMilestones: Array.from(new Set([...state.askedMilestones, ...consumed])).sort((a, b) => a - b),
    lastAskedAt: now.toISOString(),
  };
};
