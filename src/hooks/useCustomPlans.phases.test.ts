import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/i18n', () => ({ default: { t: (k: string) => k } }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

import { nextDayForSummary, summarizeNextDay, summaryActiveDayCount, type CustomPlanSummary } from './useCustomPlans';

const day = (id: string, n: number, phase_id: string | null = null, count = 3) =>
  ({ id, day_number: n, name: null, name_en: null, phase_id, exerciseCount: count });

const plan = (over: Partial<CustomPlanSummary> = {}): CustomPlanSummary => ({
  id: 'p1', name: 'P', created_at: '2026-10-01T08:00:00Z', published_at: null, day_count: 4,
  next_day: null, last_completed_at: null, last_completed_day_id: null,
  cycle_days: [day('h1', 1, 'home'), day('h2', 2, 'home'), day('g1', 3, 'gym'), day('g2', 4, 'gym')],
  duration_weeks: 8,
  phases: [
    { id: 'home', order_index: 0, name: 'Doma', name_en: null, start_week: 1, end_week: 4 },
    { id: 'gym', order_index: 1, name: 'Posilovna', name_en: null, start_week: 5, end_week: 8 },
  ],
  ...over,
});

describe('summarizeNextDay without phases (regression)', () => {
  it('rotates over all days', () => {
    const rows = [
      { id: 'a', day_number: 1, name: null, name_en: null, custom_plan_exercises: [{ count: 2 }] },
      { id: 'b', day_number: 2, name: null, name_en: null, custom_plan_exercises: [{ count: 2 }] },
    ];
    expect(summarizeNextDay(rows, { dayId: 'a', completedAt: '2026-10-01' })?.id).toBe('b');
    expect(summarizeNextDay(rows, { dayId: 'b', completedAt: '2026-10-01' })?.id).toBe('a');
  });
});

describe('nextDayForSummary with phases', () => {
  it('no phases → keeps precomputed next_day', () => {
    const p = plan({ phases: [], next_day: { id: 'x', index: 0, name: null, name_en: null, day_number: 1 } });
    expect(nextDayForSummary(p, [])?.id).toBe('x');
  });
  it('rotates only within the current phase, letter index from the full plan', () => {
    const assignments = [{ plan_id: 'p1', start_date: '2026-09-20', weeks: 8, ended_at: null }];
    // 29. 10. vs start 20. 9. → týden 6 → posilovna
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-29T10:00:00Z'));
    const first = nextDayForSummary(plan(), assignments);
    expect(first).toMatchObject({ id: 'g1', index: 2 });
    const after = nextDayForSummary(plan({ last_completed_day_id: 'g1', last_completed_at: '2026-10-28T10:00:00Z' }), assignments);
    expect(after?.id).toBe('g2');
    const wrap = nextDayForSummary(plan({ last_completed_day_id: 'g2', last_completed_at: '2026-10-28T10:00:00Z' }), assignments);
    expect(wrap?.id).toBe('g1');
    // Bez přiřazení: týden od created_at (1. 10.) → týden 5 → posilovna taky; 2. 10. by byl doma
    vi.setSystemTime(new Date('2026-10-02T10:00:00Z'));
    expect(nextDayForSummary(plan(), [])?.id).toBe('h1');
    vi.useRealTimers();
  });
});

describe('summaryActiveDayCount', () => {
  const assignments = [{ plan_id: 'p1', start_date: '2026-09-20', weeks: 8, ended_at: null }];
  it('counts only days of the current phase plus whole-plan days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-29T10:00:00Z')); // týden 6 → posilovna
    expect(summaryActiveDayCount(plan(), assignments)).toBe(2);
    const withWholePlanDay = plan({ day_count: 5, cycle_days: [...plan().cycle_days, day('x', 5)] });
    expect(summaryActiveDayCount(withWholePlanDay, assignments)).toBe(3);
    vi.useRealTimers();
  });
  it('plan without phases keeps day_count', () => {
    expect(summaryActiveDayCount(plan({ phases: [], day_count: 3 }), [])).toBe(3);
  });
});
