import { describe, it, expect } from 'vitest';
import { buildCustomWatchState, buildWatchMenu, WATCH_MENU_LIMIT, buildWatchWorkoutState, resolveWatchRestEndsAt, resolveLoggedWeight, resolveSetStep } from './watchWorkout';

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

describe('resolveLoggedWeight', () => {
  it('uses the weight the watch sent', () => {
    expect(resolveLoggedWeight({ actionWeight: 42.5, sameExercise: true, currentExWeight: 40 })).toBe(42.5);
  });

  it('keeps an explicit zero (bodyweight) instead of falling back', () => {
    expect(resolveLoggedWeight({ actionWeight: 0, sameExercise: true, currentExWeight: 40 })).toBe(0);
  });

  it('falls back to the prefilled weight on the viewed exercise', () => {
    expect(resolveLoggedWeight({ actionWeight: null, sameExercise: true, currentExWeight: 40 })).toBe(40);
  });

  it('never guesses a weight for a different exercise', () => {
    expect(resolveLoggedWeight({ actionWeight: null, sameExercise: false, currentExWeight: 40 })).toBeUndefined();
  });

  it('returns undefined when nothing is known', () => {
    expect(resolveLoggedWeight({ actionWeight: null, sameExercise: true, currentExWeight: null })).toBeUndefined();
  });
});

describe('resolveSetStep', () => {
  const mid = { exerciseIndex: 1, setIndex: 1, totalSets: 3, exerciseCount: 4 };

  it('moves to the next set inside the exercise', () => {
    expect(resolveSetStep(mid, 'next')).toEqual({ exerciseIndex: 1, setIndex: 2 });
  });

  it('moves to the previous set inside the exercise', () => {
    expect(resolveSetStep(mid, 'prev')).toEqual({ exerciseIndex: 1, setIndex: 0 });
  });

  it('rolls over to the next exercise after the last set', () => {
    expect(resolveSetStep({ ...mid, setIndex: 2 }, 'next')).toEqual({ exerciseIndex: 2, setIndex: 0 });
  });

  it('rolls back to the previous exercise before the first set', () => {
    expect(resolveSetStep({ ...mid, setIndex: 0 }, 'prev')).toEqual({ exerciseIndex: 0, setIndex: 0 });
  });

  it('stops at the end of the workout', () => {
    expect(resolveSetStep({ exerciseIndex: 3, setIndex: 2, totalSets: 3, exerciseCount: 4 }, 'next')).toBeNull();
  });

  it('stops at the very beginning', () => {
    expect(resolveSetStep({ exerciseIndex: 0, setIndex: 0, totalSets: 3, exerciseCount: 4 }, 'prev')).toBeNull();
  });
});

describe('buildWatchWorkoutState — cardio', () => {
  it('passes cardio fields through', () => {
    const s = buildWatchWorkoutState({
      ...base,
      phase: 'cardio',
      cardioTotalSeconds: 600,
      cardioEndsAt: 1700000000000,
      cardioPausedAt: null,
    });
    expect(s.phase).toBe('cardio');
    expect(s.cardioTotalSeconds).toBe(600);
    expect(s.cardioEndsAt).toBe(1700000000000);
    expect(s.cardioPausedAt).toBeNull();
  });
  it('defaults cardio fields to empty when the caller omits them', () => {
    const s = buildWatchWorkoutState(base);
    expect(s.cardioTotalSeconds).toBe(0);
    expect(s.cardioEndsAt).toBeNull();
    expect(s.cardioPausedAt).toBeNull();
  });
});

const customBase = {
  playerState: 'exercise' as const,
  isCardio: false,
  exerciseName: 'Dřep',
  currentSet: 2,
  totalSets: 4,
  targetWeight: 60,
  targetReps: 10,
  prevWeight: 57.5,
  prevReps: 10,
  restEndsAt: 0,
  cardioTotalSeconds: 0,
  cardioEndsAt: 0,
  cardioPausedAt: 0,
  nextExerciseName: null,
};

describe('buildCustomWatchState', () => {
  it('maps a strength set, converting the 1-based set number', () => {
    const s = buildCustomWatchState(customBase)!;
    expect(s.phase).toBe('set');
    expect(s.setIndex).toBe(1);
    expect(s.totalSets).toBe(4);
    expect(s.targetWeight).toBe(60);
    expect(s.repMin).toBe(10);
    expect(s.repMax).toBe(10);
    expect(s.rir).toBeNull();
  });
  it('maps rest with the end timestamp', () => {
    const s = buildCustomWatchState({ ...customBase, playerState: 'rest', restEndsAt: 1700000000000, nextExerciseName: 'Tlak na prsa' })!;
    expect(s.phase).toBe('rest');
    expect(s.resting).toBe(true);
    expect(s.restEndsAt).toBe(1700000000000);
    expect(s.nextSetLabel).toBe('Tlak na prsa');
  });
  it('drops the rest phase when the end time is unknown', () => {
    const s = buildCustomWatchState({ ...customBase, playerState: 'rest', restEndsAt: 0 })!;
    expect(s.phase).toBe('set');
  });
  it('maps a cardio exercise', () => {
    const s = buildCustomWatchState({ ...customBase, isCardio: true, cardioTotalSeconds: 600, cardioEndsAt: 1700000600000, cardioPausedAt: 0 })!;
    expect(s.phase).toBe('cardio');
    expect(s.cardioTotalSeconds).toBe(600);
    expect(s.cardioEndsAt).toBe(1700000600000);
    expect(s.cardioPausedAt).toBeNull();
  });
  it('reports the finished workout', () => {
    expect(buildCustomWatchState({ ...customBase, playerState: 'completed' })!.phase).toBe('summary');
  });
  it('goes idle while the user is still picking a gym or a day', () => {
    expect(buildCustomWatchState({ ...customBase, playerState: 'select_day' })!.phase).toBe('idle');
  });
});

describe('buildWatchMenu', () => {
  const days = [
    { planId: 'p1', planName: 'Push Pull', dayId: 'd1', dayName: 'Push' },
    { planId: 'p1', planName: 'Push Pull', dayId: 'd2', dayName: 'Pull' },
  ];
  it('puts resume first, then the plan workout, then custom days', () => {
    const m = buildWatchMenu({ resumeLabel: 'Rozdělaný trénink', hasPlanWorkout: true, planLabel: 'Dnešní trénink', customDays: days });
    expect(m.items.map(i => i.kind)).toEqual(['resume', 'plan', 'custom', 'custom']);
    expect(m.items[2].label).toBe('Push Pull · Push');
    expect(m.items[2].planId).toBe('p1');
    expect(m.items[2].dayId).toBe('d1');
  });
  it('omits resume when there is nothing to resume', () => {
    const m = buildWatchMenu({ resumeLabel: null, hasPlanWorkout: true, planLabel: 'Dnešní trénink', customDays: [] });
    expect(m.items.map(i => i.kind)).toEqual(['plan']);
  });
  it('caps the list and reports that it was cut', () => {
    const many = Array.from({ length: 30 }, (_, n) => ({ planId: 'p', planName: 'P', dayId: `d${n}`, dayName: `D${n}` }));
    const m = buildWatchMenu({ resumeLabel: null, hasPlanWorkout: false, planLabel: '', customDays: many });
    expect(m.items).toHaveLength(WATCH_MENU_LIMIT);
    expect(m.truncated).toBe(true);
  });
  it('is not truncated when everything fits', () => {
    const m = buildWatchMenu({ resumeLabel: null, hasPlanWorkout: false, planLabel: '', customDays: days });
    expect(m.truncated).toBe(false);
  });
});

describe('buildWatchWorkoutState — seznam cviků', () => {
  it('serialises the exercise list and passes the header through', () => {
    const s = buildWatchWorkoutState({
      ...base,
      workoutTitle: 'Trénink A',
      workoutStartedAt: 1700000000000,
      exercises: [
        { name: 'Dřep', setsDone: 2, setsTotal: 4, thumbUrl: 'https://x/thumb.jpg' },
        { name: 'Tlak na prsa', setsDone: 0, setsTotal: 3, thumbUrl: null },
      ],
    });
    expect(s.workoutTitle).toBe('Trénink A');
    expect(s.workoutStartedAt).toBe(1700000000000);
    expect(JSON.parse(s.exercisesJson)).toEqual([
      { name: 'Dřep', setsDone: 2, setsTotal: 4, thumbUrl: 'https://x/thumb.jpg' },
      { name: 'Tlak na prsa', setsDone: 0, setsTotal: 3, thumbUrl: null },
    ]);
  });
  it('sends an empty list when the caller has no exercises', () => {
    const s = buildWatchWorkoutState(base);
    expect(s.exercisesJson).toBe('[]');
    expect(s.workoutTitle).toBe('');
    expect(s.workoutStartedAt).toBeNull();
  });
});
