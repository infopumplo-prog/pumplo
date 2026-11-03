import { describe, it, expect } from 'vitest';
import { pickHeroPlan } from './customPlanHero';

const p = (id: string, created_at: string, last_completed_at: string | null = null) => ({ id, created_at, last_completed_at });

describe('pickHeroPlan', () => {
  it('prázdný seznam', () => {
    expect(pickHeroPlan([])).toEqual({ hero: null, others: [] });
  });

  it('vybere plán s nejnovějším dokončeným tréninkem', () => {
    const plans = [p('a', '2026-10-10'), p('b', '2026-09-01', '2026-10-15T10:00:00Z'), p('c', '2026-08-01', '2026-10-16T08:00:00Z')];
    const { hero, others } = pickHeroPlan(plans);
    expect(hero?.id).toBe('c');
    expect(others.map(x => x.id)).toEqual(['a', 'b']);
  });

  it('bez tréninků spadne na nejnověji vytvořený', () => {
    const plans = [p('a', '2026-10-01'), p('b', '2026-10-12'), p('c', '2026-09-30')];
    expect(pickHeroPlan(plans).hero?.id).toBe('b');
  });

  it('odcvičený plán má přednost před novějším neodcvičeným', () => {
    const plans = [p('new', '2026-10-16'), p('old', '2026-01-01', '2026-02-01T00:00:00Z')];
    expect(pickHeroPlan(plans).hero?.id).toBe('old');
  });

  it('jediný plán → žádné další', () => {
    const { hero, others } = pickHeroPlan([p('x', '2026-10-01')]);
    expect(hero?.id).toBe('x');
    expect(others).toEqual([]);
  });
});
