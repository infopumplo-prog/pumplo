import { describe, it, expect } from 'vitest';
import { buildWatchWorkoutState, resolveWatchRestEndsAt } from './watchWorkout';

const base = {
  phase: 'set' as const,
  exerciseName: 'Šikmý tlak na prsa',
  slotCategory: 'main',
  setIndex: 1,
  totalSets: 3,
  targetWeight: 40,
  repMin: 8,
  repMax: 12,
  rir: 2,
  prevWeight: 37.5,
  prevReps: 10,
  resting: false,
  restEndsAt: null,
  nextSetLabel: null,
};

describe('buildWatchWorkoutState', () => {
  it('maps target reps to repMax and sets 0.5 weight step', () => {
    const s = buildWatchWorkoutState(base);
    expect(s.targetReps).toBe(12);
    expect(s.weightStep).toBe(0.5);
    expect(s.setIndex).toBe(1);
    expect(s.totalSets).toBe(3);
    expect(s.prevWeight).toBe(37.5);
  });
  it('passes rest fields through when resting', () => {
    const s = buildWatchWorkoutState({
      ...base,
      phase: 'rest',
      resting: true,
      restEndsAt: 1000,
      nextSetLabel: '3. série',
    });
    expect(s.phase).toBe('rest');
    expect(s.resting).toBe(true);
    expect(s.restEndsAt).toBe(1000);
    expect(s.nextSetLabel).toBe('3. série');
  });
  it('handles null target weight (bodyweight/first time)', () => {
    const s = buildWatchWorkoutState({ ...base, targetWeight: null, prevWeight: null });
    expect(s.targetWeight).toBeNull();
  });
});

describe('resolveWatchRestEndsAt', () => {
  const idle = { sessionResting: false, sessionRestEndsAt: 0, playerResting: false, playerRestEndsAt: 0 };

  it('returns null when nothing is resting', () => {
    expect(resolveWatchRestEndsAt(idle)).toBeNull();
  });

  it('uses the session clock in list view', () => {
    expect(resolveWatchRestEndsAt({ ...idle, sessionResting: true, sessionRestEndsAt: 1_700_000_000_000 }))
      .toBe(1_700_000_000_000);
  });

  it('uses the player clock during a video-view rest', () => {
    expect(resolveWatchRestEndsAt({ ...idle, playerResting: true, playerRestEndsAt: 1_700_000_030_000 }))
      .toBe(1_700_000_030_000);
  });

  it('prefers the session clock when both are set', () => {
    expect(resolveWatchRestEndsAt({
      sessionResting: true, sessionRestEndsAt: 111, playerResting: true, playerRestEndsAt: 222,
    })).toBe(111);
  });

  it('treats a zero clock as no rest (never sends epoch 0 to the watch)', () => {
    expect(resolveWatchRestEndsAt({ ...idle, sessionResting: true, sessionRestEndsAt: 0 })).toBeNull();
  });

  it('is stable across calls — the watch countdown must not restart on rerender', () => {
    const input = { ...idle, sessionResting: true, sessionRestEndsAt: 1_700_000_000_000 };
    expect(resolveWatchRestEndsAt(input)).toBe(resolveWatchRestEndsAt(input));
  });
});
