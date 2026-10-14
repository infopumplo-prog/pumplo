import { beforeEach, describe, expect, it, vi } from 'vitest';

// Rotace je čistá logika — klient Supabase se v testech nesmí volat.
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import {
  cycleLetter, getNextCycleDay, isGenericDayName, moveDayInOrder, pickLatestCompleted,
  readLocalLastCompleted, recordLocalCompleted, renumberDays, sortCycleDays,
} from './customPlanCycle';

// Push / Pull / Legs z katalogu (3 dny), schválně v nesetříděném pořadí.
const ppl = [
  { id: 'legs', day_number: 3, exerciseCount: 5 },
  { id: 'push', day_number: 1, exerciseCount: 6 },
  { id: 'pull', day_number: 2, exerciseCount: 6 },
];

describe('getNextCycleDay', () => {
  it('bez odcvičeného dne začíná prvním dnem (A)', () => {
    expect(getNextCycleDay(ppl, null)?.id).toBe('push');
    expect(getNextCycleDay(ppl, undefined)?.id).toBe('push');
  });

  it('po A jde B, po B jde C', () => {
    expect(getNextCycleDay(ppl, 'push')?.id).toBe('pull');
    expect(getNextCycleDay(ppl, 'pull')?.id).toBe('legs');
  });

  it('po posledním dni se vrací na A (kruh)', () => {
    expect(getNextCycleDay(ppl, 'legs')?.id).toBe('push');
  });

  it('celý kruh třikrát dokola', () => {
    let last: string | null = null;
    const seen: string[] = [];
    for (let i = 0; i < 9; i++) {
      last = getNextCycleDay(ppl, last)!.id;
      seen.push(last);
    }
    expect(seen).toEqual(['push', 'pull', 'legs', 'push', 'pull', 'legs', 'push', 'pull', 'legs']);
  });

  it('smazaný (neznámý) poslední den → zpět na A', () => {
    expect(getNextCycleDay(ppl, 'deleted-day')?.id).toBe('push');
  });

  it('prázdné dny přeskakuje, i přes konec kruhu', () => {
    const days = [
      { id: 'a', day_number: 1, exerciseCount: 4 },
      { id: 'b', day_number: 2, exerciseCount: 0 },
      { id: 'c', day_number: 3, exerciseCount: 3 },
      { id: 'd', day_number: 4, exerciseCount: 0 },
    ];
    expect(getNextCycleDay(days, 'a')?.id).toBe('c');
    expect(getNextCycleDay(days, 'c')?.id).toBe('a');
    expect(getNextCycleDay(days, 'b')?.id).toBe('c');
  });

  it('první den prázdný → začíná prvním hratelným', () => {
    const days = [
      { id: 'a', day_number: 1, exerciseCount: 0 },
      { id: 'b', day_number: 2, exerciseCount: 2 },
    ];
    expect(getNextCycleDay(days, null)?.id).toBe('b');
  });

  it('jednodenní plán vrací stále ten jediný den', () => {
    const one = [{ id: 'only', day_number: 1, exerciseCount: 3 }];
    expect(getNextCycleDay(one, null)?.id).toBe('only');
    expect(getNextCycleDay(one, 'only')?.id).toBe('only');
  });

  it('bez hratelných dnů / bez dnů → null', () => {
    expect(getNextCycleDay([], null)).toBeNull();
    expect(getNextCycleDay([{ id: 'x', day_number: 1, exerciseCount: 0 }], null)).toBeNull();
  });

  it('bez exerciseCount bere všechny dny jako hratelné', () => {
    expect(getNextCycleDay([{ id: 'a', day_number: 1 }, { id: 'b', day_number: 2 }], 'a')?.id).toBe('b');
  });

  it('díry a duplicity v day_number nevadí (stabilní pořadí)', () => {
    const days = [
      { id: 'a', day_number: 1 },
      { id: 'c', day_number: 5 },
      { id: 'b', day_number: 1 },
    ];
    expect(sortCycleDays(days).map(d => d.id)).toEqual(['a', 'b', 'c']);
    expect(getNextCycleDay(days, 'b')?.id).toBe('c');
    expect(getNextCycleDay(days, 'c')?.id).toBe('a');
  });
});

describe('cycleLetter', () => {
  it('A, B, … Z, AA', () => {
    expect([0, 1, 2].map(cycleLetter)).toEqual(['A', 'B', 'C']);
    expect(cycleLetter(25)).toBe('Z');
    expect(cycleLetter(26)).toBe('AA');
    expect(cycleLetter(27)).toBe('AB');
  });
});

describe('pickLatestCompleted', () => {
  it('vybere novější záznam (DB vs. lokální)', () => {
    const db = { dayId: 'push', completedAt: '2026-10-10T10:00:00Z' };
    const local = { dayId: 'pull', completedAt: '2026-10-12T10:00:00Z' };
    expect(pickLatestCompleted(db, local)).toEqual(local);
    expect(pickLatestCompleted(local, db)).toEqual(local);
    expect(pickLatestCompleted(null, db)).toEqual(db);
    expect(pickLatestCompleted(null, undefined)).toBeNull();
  });
});

describe('renumberDays / moveDayInOrder', () => {
  it('přečísluje po smazání bez děr a vrátí jen změny', () => {
    const remaining = [{ id: 'a', day_number: 1 }, { id: 'c', day_number: 3 }];
    expect(renumberDays(remaining)).toEqual([{ id: 'c', day_number: 2 }]);
  });

  it('posune den doprava/doleva a na krajích nic nedělá', () => {
    const ordered = sortCycleDays(ppl);
    expect(moveDayInOrder(ordered, 'push', 1).map(d => d.id)).toEqual(['pull', 'push', 'legs']);
    expect(moveDayInOrder(ordered, 'legs', -1).map(d => d.id)).toEqual(['push', 'legs', 'pull']);
    expect(moveDayInOrder(ordered, 'push', -1)).toBe(ordered);
    expect(moveDayInOrder(ordered, 'legs', 1)).toBe(ordered);
    expect(renumberDays(moveDayInOrder(ordered, 'push', 1))).toEqual([
      { id: 'pull', day_number: 1 },
      { id: 'push', day_number: 2 },
    ]);
  });
});

describe('isGenericDayName', () => {
  it('automatické názvy vs. vlastní', () => {
    expect(isGenericDayName(null)).toBe(true);
    expect(isGenericDayName('  ')).toBe(true);
    expect(isGenericDayName('Den 1')).toBe(true);
    expect(isGenericDayName('Day 12')).toBe(true);
    expect(isGenericDayName('Den A')).toBe(true);
    expect(isGenericDayName('Push')).toBe(false);
    expect(isGenericDayName('Den nohou')).toBe(false);
  });
});

describe('lokální záznam posledního dne', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
    });
  });

  it('uloží a přečte poslední den per plán', () => {
    expect(readLocalLastCompleted('plan-1')).toBeNull();
    recordLocalCompleted('plan-1', 'pull', '2026-10-14T08:00:00Z');
    recordLocalCompleted('plan-2', 'legs', '2026-10-14T09:00:00Z');
    expect(readLocalLastCompleted('plan-1')).toEqual({ dayId: 'pull', completedAt: '2026-10-14T08:00:00Z' });
    expect(getNextCycleDay(ppl, readLocalLastCompleted('plan-2')?.dayId)?.id).toBe('push');
  });
});
