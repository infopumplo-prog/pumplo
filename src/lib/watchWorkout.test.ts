import { describe, it, expect } from 'vitest';
import { buildWatchWorkoutState } from './watchWorkout';

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
