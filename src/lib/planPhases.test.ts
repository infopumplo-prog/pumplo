import { describe, expect, it } from 'vitest';
import {
  activeDaysForWeek, applyProgressionToExercise, currentPlanWeek, effectivePhaseForWeek, effectivePrescription,
  findPlanAssignment, hasWeeklySchedule, phaseForWeek, planSchedule, planStartDate, planTotalWeeks, pragueIsoDate,
  resizePerSet, toPragueDate, upcomingProgressions, type ExerciseProgression, type PlanPhase,
} from './planPhases';

const phase = (id: string, start: number, end: number, order = 0): PlanPhase => ({
  id, order_index: order, name: id, name_en: null, start_week: start, end_week: end,
});
const home = phase('home', 1, 4, 0);
const gym = phase('gym', 5, 8, 1);

describe('pragueIsoDate / toPragueDate', () => {
  it('uses Prague date, not UTC (23:30 UTC in summer = next day in Prague)', () => {
    expect(pragueIsoDate(new Date('2026-07-01T23:30:00Z'))).toBe('2026-07-02');
    expect(pragueIsoDate(new Date('2026-01-01T22:59:00Z'))).toBe('2026-01-01');
  });
  it('keeps plain dates, converts timestamps, rejects junk', () => {
    expect(toPragueDate('2026-10-29')).toBe('2026-10-29');
    expect(toPragueDate('2026-10-28T23:30:00+00:00')).toBe('2026-10-29');
    expect(toPragueDate('nope')).toBeNull();
    expect(toPragueDate(null)).toBeNull();
  });
});

describe('currentPlanWeek', () => {
  it('week 1 on start day and for 6 more days', () => {
    expect(currentPlanWeek('2026-10-01', 8, '2026-10-01').week).toBe(1);
    expect(currentPlanWeek('2026-10-01', 8, '2026-10-07').week).toBe(1);
    expect(currentPlanWeek('2026-10-01', 8, '2026-10-08').week).toBe(2);
  });
  it('clamps to 1 before start', () => {
    expect(currentPlanWeek('2026-11-01', 8, '2026-10-01')).toEqual({ week: 1, totalWeeks: 8, finished: false });
  });
  it('after the end keeps the last week and flags finished', () => {
    expect(currentPlanWeek('2026-01-01', 4, '2026-10-01')).toEqual({ week: 4, totalWeeks: 4, finished: true });
    expect(currentPlanWeek('2026-01-01', 4, '2026-01-28')).toEqual({ week: 4, totalWeeks: 4, finished: false });
    expect(currentPlanWeek('2026-01-01', 4, '2026-01-29').finished).toBe(true);
  });
  it('no total → unbounded', () => {
    expect(currentPlanWeek('2026-01-01', null, '2026-03-01')).toEqual({ week: 9, totalWeeks: null, finished: false });
  });
  it('DST change does not shift weeks', () => {
    expect(currentPlanWeek('2026-10-19', 8, '2026-10-26').week).toBe(2);
    expect(currentPlanWeek('2026-03-23', 8, '2026-03-30').week).toBe(2);
  });
  it('accepts a timestamp start (plan.created_at) in Prague time', () => {
    // 22:30 UTC = 00:30 next day in Prague (winter) → start is the 2nd
    expect(currentPlanWeek('2026-01-01T23:30:00Z', null, '2026-01-08').week).toBe(1);
    expect(currentPlanWeek('2026-01-01T23:30:00Z', null, '2026-01-09').week).toBe(2);
  });
  it('invalid start → week 1', () => {
    expect(currentPlanWeek(null, 4, '2026-10-01').week).toBe(1);
  });
});

describe('planTotalWeeks', () => {
  it('assignment → duration → phases end → null', () => {
    expect(planTotalWeeks(6, 10, [home, gym])).toBe(6);
    expect(planTotalWeeks(null, 10, [home, gym])).toBe(10);
    expect(planTotalWeeks(null, null, [home, gym])).toBe(8);
    expect(planTotalWeeks(undefined, null, [])).toBeNull();
  });
});

describe('phases', () => {
  it('phaseForWeek finds the covering phase', () => {
    expect(phaseForWeek([home, gym], 3)?.id).toBe('home');
    expect(phaseForWeek([home, gym], 5)?.id).toBe('gym');
    expect(phaseForWeek([home, gym], 9)).toBeNull();
    expect(phaseForWeek([], 1)).toBeNull();
  });
  it('overlap → lower order_index wins', () => {
    expect(phaseForWeek([phase('b', 1, 4, 2), phase('a', 3, 6, 1)], 3)?.id).toBe('a');
  });
  it('effective phase in a gap → nearest previous; before first → first', () => {
    const gapped = [phase('p1', 1, 2), phase('p2', 5, 6, 1)];
    expect(effectivePhaseForWeek(gapped, 3)?.id).toBe('p1');
    expect(effectivePhaseForWeek(gapped, 9)?.id).toBe('p2');
    expect(effectivePhaseForWeek([phase('late', 3, 4)], 1)?.id).toBe('late');
    expect(effectivePhaseForWeek(null, 1)).toBeNull();
  });
});

describe('activeDaysForWeek', () => {
  const days = [
    { id: 'h1', phase_id: 'home' },
    { id: 'h2', phase_id: 'home' },
    { id: 'g1', phase_id: 'gym' },
    { id: 'all', phase_id: null },
  ];
  it('no phases → all days unchanged (regression)', () => {
    const plain = [{ id: 'a' }, { id: 'b' }];
    expect(activeDaysForWeek(plain, [], 3)).toEqual(plain);
    expect(activeDaysForWeek(plain, undefined, 3)).toEqual(plain);
  });
  it('current phase days + days without phase', () => {
    expect(activeDaysForWeek(days, [home, gym], 2).map(d => d.id)).toEqual(['h1', 'h2', 'all']);
    expect(activeDaysForWeek(days, [home, gym], 6).map(d => d.id)).toEqual(['g1', 'all']);
  });
  it('gap → days without phase', () => {
    expect(activeDaysForWeek(days, [home, gym], 10).map(d => d.id)).toEqual(['all']);
  });
  it('gap with no phase-less days → nearest previous phase', () => {
    const only = days.filter(d => d.phase_id);
    expect(activeDaysForWeek(only, [home, gym], 10).map(d => d.id)).toEqual(['g1']);
    expect(activeDaysForWeek(only, [phase('home', 1, 2), phase('gym', 5, 8, 1)], 3).map(d => d.id)).toEqual(['h1', 'h2']);
  });
  it('day pointing to an unknown phase counts as always valid', () => {
    expect(activeDaysForWeek([{ id: 'x', phase_id: 'ghost' }, { id: 'g1', phase_id: 'gym' }], [home, gym], 2).map(d => d.id)).toEqual(['x']);
  });
  it('never returns empty when days exist', () => {
    expect(activeDaysForWeek([{ id: 'g1', phase_id: 'gym' }], [home, gym], 2).map(d => d.id)).toEqual(['g1']);
  });
});

const rule = (from_week: number, p: Partial<ExerciseProgression> = {}): ExerciseProgression => ({
  plan_exercise_id: 'e1', from_week, sets: null, reps: null, weight_kg: null, ...p,
});

describe('effectivePrescription', () => {
  const base = { sets: 3, reps: 10, weight_kg: 40 };
  it('no rules → base', () => {
    expect(effectivePrescription(base, [], 5)).toMatchObject({ ...base, progressed: false });
  });
  it('rule from week 5 applies from week 5', () => {
    const rules = [rule(5, { sets: 4 })];
    expect(effectivePrescription(base, rules, 4)).toMatchObject({ sets: 3, progressed: false });
    expect(effectivePrescription(base, rules, 5)).toMatchObject({ sets: 4, reps: 10, weight_kg: 40, progressed: true, setsOverridden: true, repsOverridden: false });
  });
  it('highest from_week ≤ week wins; nulls keep earlier values', () => {
    const rules = [rule(9, { reps: 6 }), rule(5, { sets: 4, weight_kg: 50 }), rule(7, { weight_kg: 55 })];
    expect(effectivePrescription(base, rules, 8)).toMatchObject({ sets: 4, reps: 10, weight_kg: 55 });
    expect(effectivePrescription(base, rules, 12)).toMatchObject({ sets: 4, reps: 6, weight_kg: 55 });
  });
  it('weight 0 is a valid override', () => {
    expect(effectivePrescription(base, [rule(1, { weight_kg: 0 })], 1).weight_kg).toBe(0);
  });
});

describe('resizePerSet', () => {
  it('truncates, repeats last, or pads with given value', () => {
    expect(resizePerSet([10, 8, 6], 2)).toEqual([10, 8]);
    expect(resizePerSet([10, 8], 4)).toEqual([10, 8, 8, 8]);
    expect(resizePerSet(['W', 'normal'], 3, 'normal')).toEqual(['W', 'normal', 'normal']);
    expect(resizePerSet(null, 3)).toBeNull();
  });
});

describe('applyProgressionToExercise', () => {
  const ex = {
    id: 'e1', sets: 3, reps: 10, weight_kg: 40,
    reps_per_set: [12, 10, 8], weight_per_set: [40, 45, 50], rest_per_set: [60, 90, 120], set_types: ['W', 'normal', 'F'],
    extra: 'kept',
  };
  it('no rules for this exercise → same object (regression)', () => {
    expect(applyProgressionToExercise(ex, [], 5)).toBe(ex);
    expect(applyProgressionToExercise(ex, [{ ...rule(1, { sets: 5 }), plan_exercise_id: 'other' }], 5)).toBe(ex);
    expect(applyProgressionToExercise(ex, [rule(6, { sets: 5 })], 5)).toBe(ex);
  });
  it('more sets → per-set arrays repeat last, types pad normal', () => {
    const out = applyProgressionToExercise(ex, [rule(5, { sets: 4 })], 5);
    expect(out).toMatchObject({
      sets: 4, reps: 10, weight_kg: 40, extra: 'kept',
      reps_per_set: [12, 10, 8, 8], weight_per_set: [40, 45, 50, 50], rest_per_set: [60, 90, 120, 120],
      set_types: ['W', 'normal', 'F', 'normal'],
    });
  });
  it('fewer sets → truncated', () => {
    const out = applyProgressionToExercise(ex, [rule(2, { sets: 2 })], 3);
    expect(out.reps_per_set).toEqual([12, 10]);
    expect(out.set_types).toEqual(['W', 'normal']);
  });
  it('reps/weight override beats per-set arrays', () => {
    const out = applyProgressionToExercise(ex, [rule(3, { reps: 6, weight_kg: 60 })], 3);
    expect(out).toMatchObject({ sets: 3, reps: 6, weight_kg: 60, reps_per_set: null, weight_per_set: null, rest_per_set: [60, 90, 120] });
  });
  it('does not mutate the input', () => {
    applyProgressionToExercise(ex, [rule(1, { sets: 5 })], 1);
    expect(ex.reps_per_set).toEqual([12, 10, 8]);
  });
});

describe('upcomingProgressions', () => {
  it('only rules after the current week, sorted', () => {
    const rules = [rule(9, { reps: 6 }), rule(5, { sets: 4 }), rule(2, { sets: 3 })];
    expect(upcomingProgressions(rules, 'e1', 4).map(r => r.from_week)).toEqual([5, 9]);
  });
});

describe('assignment start & schedule', () => {
  const assignments = [
    { plan_id: 'p1', start_date: '2026-09-01', weeks: 8, ended_at: null },
    { plan_id: 'p1', start_date: '2026-10-01', weeks: 6, ended_at: null },
    { plan_id: 'p1', start_date: '2026-10-20', weeks: 6, ended_at: '2026-10-21T10:00:00Z' },
    { plan_id: 'p2', start_date: '2026-10-15', weeks: 4, ended_at: null },
  ];
  it('latest non-ended assignment of the plan', () => {
    expect(findPlanAssignment('p1', assignments)?.start_date).toBe('2026-10-01');
    expect(findPlanAssignment('p3', assignments)).toBeNull();
  });
  it('start = assignment start, else created_at in Prague', () => {
    expect(planStartDate('p1', '2026-08-01T10:00:00Z', assignments)).toBe('2026-10-01');
    expect(planStartDate('own', '2026-08-01T23:30:00Z', assignments)).toBe('2026-08-02');
  });
  it('planSchedule combines week, total and phase', () => {
    const s = planSchedule({ id: 'p1', created_at: '2026-08-01', duration_weeks: 8, phases: [home, gym] }, assignments, '2026-10-29');
    expect(s).toMatchObject({ week: 5, totalWeeks: 6, finished: false, startDate: '2026-10-01' });
    expect(s.phase?.id).toBe('gym');
    const own = planSchedule({ id: 'own', created_at: '2026-10-01T08:00:00Z', duration_weeks: null, phases: [] }, [], '2026-10-29');
    expect(own).toMatchObject({ week: 5, totalWeeks: null, phase: null, effectivePhase: null });
  });
  it('hasWeeklySchedule', () => {
    expect(hasWeeklySchedule([], [])).toBe(false);
    expect(hasWeeklySchedule(undefined, null)).toBe(false);
    expect(hasWeeklySchedule([home], [])).toBe(true);
    expect(hasWeeklySchedule([], [rule(2)])).toBe(true);
  });
});
