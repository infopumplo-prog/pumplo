import { describe, expect, it } from 'vitest';
import { buildCheckinTrend } from './weeklyCheckin';

describe('buildCheckinTrend', () => {
  it('řadí týdny, počítá změnu váhy a průměry', () => {
    const t = buildCheckinTrend([
      { week_start: '2026-10-12', mood: 5, training: 4, weight_kg: '84.2' },
      { week_start: '2026-09-28', mood: 3, training: 2, weight_kg: '85.0' },
      { week_start: '2026-10-05', mood: 4, training: 3, weight_kg: null },
    ]);
    expect(t.points.map(p => p.week)).toEqual(['2026-09-28', '2026-10-05', '2026-10-12']);
    expect(t.firstWeight).toBe(85);
    expect(t.lastWeight).toBe(84.2);
    expect(t.weightDelta).toBe(-0.8);
    expect(t.avgMood).toBe(4);
    expect(t.avgTraining).toBe(3);
  });
  it('jedna váha = bez změny, prázdno = null', () => {
    expect(buildCheckinTrend([{ week_start: '2026-10-05', mood: 4, training: 3, weight_kg: 85 }]).weightDelta).toBeNull();
    const e = buildCheckinTrend([]);
    expect([e.weightDelta, e.avgMood, e.lastWeight]).toEqual([null, null, null]);
  });
});
