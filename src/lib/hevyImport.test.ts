import { describe, it, expect } from 'vitest';
import { parseCsv, parseHevyCsv, groupWorkouts, matchExercises, buildImportPlan } from './hevyImport';

const HEADER = 'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe';

const CSV = [
  HEADER,
  '"Push Day","7 Aug 2026, 17:00","7 Aug 2026, 18:00","","Bench Press (Barbell)","","",0,normal,80,8,,,',
  '"Push Day","7 Aug 2026, 17:00","7 Aug 2026, 18:00","","Bench Press (Barbell)","","",1,normal,85,6,,,',
  '"Push Day","7 Aug 2026, 17:00","7 Aug 2026, 18:00","poznámka, s čárkou","Kotrmelec vpřed","","",0,normal,,10,,,',
  '"Leg Day","5 Aug 2026, 16:00","5 Aug 2026, 17:10","","Squat (Barbell)","","",0,warmup,60,10,,,',
].join('\n');

describe('parseCsv', () => {
  it('handles quoted fields with commas and escaped quotes', () => {
    const rows = parseCsv('a,"b,c","say ""hi"""\n1,2,3');
    expect(rows).toEqual([['a', 'b,c', 'say "hi"'], ['1', '2', '3']]);
  });

  it('handles CRLF and trailing newline', () => {
    expect(parseCsv('a,b\r\nc,d\n')).toEqual([['a', 'b'], ['c', 'd']]);
  });
});

describe('parseHevyCsv', () => {
  it('reads sets by header name', () => {
    const rows = parseHevyCsv(CSV);
    expect(rows).toHaveLength(4);
    expect(rows[0].exerciseTitle).toBe('Bench Press (Barbell)');
    expect(rows[0].weightKg).toBe(80);
    expect(rows[2].weightKg).toBeNull();
    expect(rows[2].reps).toBe(10);
  });

  it('rejects a CSV without the Hevy columns', () => {
    expect(() => parseHevyCsv('foo,bar\n1,2')).toThrow('not_hevy_csv');
  });
});

describe('groupWorkouts', () => {
  it('groups sets into workouts and keeps stable ids', () => {
    const workouts = groupWorkouts(parseHevyCsv(CSV));
    expect(workouts).toHaveLength(2);
    // sorted by start time: Leg Day (5 Aug) first
    expect(workouts[0].title).toBe('Leg Day');
    expect(workouts[1].sets).toHaveLength(3);
    const again = groupWorkouts(parseHevyCsv(CSV));
    expect(again[0].clientSessionId).toBe(workouts[0].clientSessionId);
    expect(workouts[0].clientSessionId).toMatch(/^hevy:/);
  });
});

describe('matchExercises', () => {
  const catalog = [
    { id: 'ex-bench', name: 'Bench press', name_en: 'Bench Press' },
    { id: 'ex-squat', name: 'Dřep s velkou činkou', name_en: 'Squat' },
  ];

  it('matches by normalized name ignoring Hevy equipment suffixes', () => {
    const { exerciseMap, unmatchedNames } = matchExercises(parseHevyCsv(CSV), catalog);
    expect(exerciseMap.get('Bench Press (Barbell)')).toBe('ex-bench');
    expect(exerciseMap.get('Squat (Barbell)')).toBe('ex-squat');
    expect(unmatchedNames).toEqual(['Kotrmelec vpřed']);
  });
});

describe('buildImportPlan', () => {
  it('produces a full plan', () => {
    const plan = buildImportPlan(CSV, [{ id: 'x', name: 'Bench Press', name_en: null }]);
    expect(plan.workouts).toHaveLength(2);
    expect(plan.matchedNames).toEqual(['Bench Press (Barbell)']);
    expect(plan.unmatchedNames.sort()).toEqual(['Kotrmelec vpřed', 'Squat (Barbell)'].sort());
  });
});
