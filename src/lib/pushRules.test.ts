// Testy pravidel ranní push notifikace (David 18. 10.). Pravidla žijí v edge
// funkci send-push-notifications (bez Deno importů), stejně jako planRules.
import { describe, it, expect } from 'vitest';
import {
  decidePushKind,
  daysBetweenDateKeys,
  daysSinceSignup,
  missedWindowStart,
  pragueDateKey,
  shiftDateKey,
  usableTemplates,
  fillTemplate,
  type MorningPushInput,
} from '../../supabase/functions/send-push-notifications/rules';

const trained: MorningPushInput = {
  completedWorkouts: 5,
  daysSinceSignup: 30,
  isTrainingDay: true,
  missedPrevious: false,
  recentMissedCount: 0,
  hasActivePlan: true,
};

describe('decidePushKind — nikdy netrénoval', () => {
  const never = { ...trained, completedWorkouts: 0, missedPrevious: true };

  it('nikdy nedostane missed, i když „vynechal“', () => {
    for (let d = 0; d <= 40; d++) {
      expect(decidePushKind({ ...never, daysSinceSignup: d })).not.toBe('missed');
    }
  });

  it('first_workout jen ve dnech 0, 1, 3 a 7', () => {
    const sent = Array.from({ length: 31 }, (_, d) => d)
      .filter((d) => decidePushKind({ ...never, daysSinceSignup: d }) === 'first_workout');
    expect(sent).toEqual([0, 1, 3, 7]);
  });

  it('bez aktivního plánu (nedokončený dotazník) nic nedostane', () => {
    for (const d of [0, 1, 3, 7]) {
      expect(decidePushKind({ ...never, daysSinceSignup: d, hasActivePlan: false })).toBe('none');
    }
  });

  it('nezávisí na tréninkovém dni', () => {
    expect(decidePushKind({ ...never, daysSinceSignup: 3, isTrainingDay: false })).toBe('first_workout');
  });

  it('po 7. dni nic (ani morning)', () => {
    expect(decidePushKind({ ...never, daysSinceSignup: 8 })).toBe('none');
    expect(decidePushKind({ ...never, daysSinceSignup: 14 })).toBe('none');
  });

  it('neznámé datum registrace → nic', () => {
    expect(decidePushKind({ ...never, daysSinceSignup: null })).toBe('none');
  });
});

describe('decidePushKind — už trénoval', () => {
  it('netréninkový den → nic', () => {
    expect(decidePushKind({ ...trained, isTrainingDay: false })).toBe('none');
  });

  it('nevynechal → morning', () => {
    expect(decidePushKind(trained)).toBe('morning');
  });

  it('vynechal, 0 nebo 1 missed za 7 dní → missed', () => {
    expect(decidePushKind({ ...trained, missedPrevious: true, recentMissedCount: 0 })).toBe('missed');
    expect(decidePushKind({ ...trained, missedPrevious: true, recentMissedCount: 1 })).toBe('missed');
  });

  it('vynechal, ale už 2 missed za 7 dní → jen morning', () => {
    expect(decidePushKind({ ...trained, missedPrevious: true, recentMissedCount: 2 })).toBe('morning');
    expect(decidePushKind({ ...trained, missedPrevious: true, recentMissedCount: 5 })).toBe('morning');
  });

  it('jeden dokončený trénink už stačí na běžný režim', () => {
    expect(decidePushKind({ ...trained, completedWorkouts: 1, daysSinceSignup: 3 })).toBe('morning');
  });
});

describe('datumové pomocníky', () => {
  it('pragueDateKey počítá pražskou půlnoc', () => {
    // 22:30 UTC 17. 10. = 00:30 v Praze 18. 10. (letní čas)
    expect(pragueDateKey(new Date('2026-10-17T22:30:00Z'))).toBe('2026-10-18');
    expect(pragueDateKey(new Date('2026-10-17T21:30:00Z'))).toBe('2026-10-17');
  });

  it('daysBetweenDateKeys přes přechod času i měsíc', () => {
    expect(daysBetweenDateKeys('2026-10-18', '2026-10-18')).toBe(0);
    expect(daysBetweenDateKeys('2026-10-24', '2026-10-31')).toBe(7);
    expect(daysBetweenDateKeys('2026-09-30', '2026-10-03')).toBe(3);
  });

  it('daysSinceSignup', () => {
    expect(daysSinceSignup('2026-10-17T22:30:00Z', '2026-10-18')).toBe(0);
    expect(daysSinceSignup('2026-10-11T10:00:00Z', '2026-10-18')).toBe(7);
    expect(daysSinceSignup(null, '2026-10-18')).toBeNull();
    expect(daysSinceSignup('nesmysl', '2026-10-18')).toBeNull();
  });

  it('okno pro missed = dnešek + 6 dní zpět', () => {
    expect(missedWindowStart('2026-10-18')).toBe('2026-10-12');
    expect(shiftDateKey('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('šablony', () => {
  const tpls = [
    { title: 'A', body: '{workout} zabere ~{minutes} min' },
    { title: 'B', body: 'Plán je hotový: {workout}' },
  ];

  it('bez délky tréninku vynechá šablony s {minutes}', () => {
    expect(usableTemplates(tpls, false).map((t) => t.title)).toEqual(['B']);
    expect(usableTemplates(tpls, true)).toHaveLength(2);
  });

  it('fillTemplate doplní hodnoty a velké písmeno na začátku', () => {
    expect(fillTemplate(tpls[0].body, 'silový trénink', 45)).toBe('Silový trénink zabere ~45 min');
  });
});
