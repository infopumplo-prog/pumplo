import { describe, it, expect } from 'vitest';
import {
  formatWeekRange,
  pragueWeekStart,
  pragueLocalToDate,
  currentCheckinWeekStart,
  checkinOpensAt,
  shouldShowCheckin,
  recordsInWeek,
  weekRange,
  clampText,
  aggregateCheckinsByWeek,
  type CheckinDecisionInput,
} from './weeklyCheckin';

describe('pragueWeekStart', () => {
  it('vrací pondělí v pražském čase', () => {
    // středa 15. 10. 2026 poledne
    expect(pragueWeekStart(new Date('2026-10-15T10:00:00Z'))).toBe('2026-10-12');
    // pondělí 00:30 Praha = neděle 22:30 UTC → už nový týden
    expect(pragueWeekStart(new Date('2026-10-11T22:30:00Z'))).toBe('2026-10-12');
    // neděle 23:30 Praha (21:30 UTC) → pořád starý týden
    expect(pragueWeekStart(new Date('2026-10-11T21:30:00Z'))).toBe('2026-10-05');
  });

  it('přechod přes měsíc a rok', () => {
    expect(pragueWeekStart(new Date('2027-01-01T12:00:00Z'))).toBe('2026-12-28');
  });
});

describe('pragueLocalToDate', () => {
  it('letní čas (UTC+2) a zimní čas (UTC+1)', () => {
    expect(pragueLocalToDate('2026-10-18', 19).toISOString()).toBe('2026-10-18T17:00:00.000Z');
    expect(pragueLocalToDate('2026-11-01', 19).toISOString()).toBe('2026-11-01T18:00:00.000Z');
  });

  it('neděle přechodu na zimní čas (25. 10. 2026)', () => {
    expect(checkinOpensAt('2026-10-19').toISOString()).toBe('2026-10-25T18:00:00.000Z');
  });
});

describe('currentCheckinWeekStart', () => {
  it('neděle před 19:00 → předchozí týden', () => {
    // neděle 18. 10. 18:59 Praha = 16:59 UTC
    expect(currentCheckinWeekStart(new Date('2026-10-18T16:59:00Z'))).toBe('2026-10-05');
  });
  it('neděle od 19:00 → aktuální týden', () => {
    expect(currentCheckinWeekStart(new Date('2026-10-18T17:00:00Z'))).toBe('2026-10-12');
  });
  it('středa po zmeškané neděli → týden té neděle', () => {
    expect(currentCheckinWeekStart(new Date('2026-10-21T08:00:00Z'))).toBe('2026-10-12');
  });
});

describe('weekRange', () => {
  it('pondělí 00:00 až další pondělí 00:00 Praha', () => {
    const r = weekRange('2026-10-12');
    expect(r.from.toISOString()).toBe('2026-10-11T22:00:00.000Z');
    expect(r.to.toISOString()).toBe('2026-10-18T22:00:00.000Z');
  });
});

describe('shouldShowCheckin', () => {
  const base: CheckinDecisionInput = {
    now: new Date('2026-10-18T17:30:00Z'), // neděle 19:30 Praha
    userCreatedAt: '2026-09-01T10:00:00Z',
    onboardingCompleted: true,
    answeredWeekStarts: [],
    dismissedWeekStart: null,
    snoozedThisSession: false,
    pathname: '/',
  };

  it('neděle večer → ukázat check-in aktuálního týdne', () => {
    expect(shouldShowCheckin(base)).toEqual({ show: true, weekStart: '2026-10-12' });
  });

  it('neděle odpoledne → týden už předtím zodpovězený → nic', () => {
    const r = shouldShowCheckin({ ...base, now: new Date('2026-10-18T12:00:00Z'), answeredWeekStarts: ['2026-10-05'] });
    expect(r).toEqual({ show: false, weekStart: '2026-10-05' });
  });

  it('zmeškaná neděle → ukáže se při otevření appky v úterý', () => {
    const r = shouldShowCheckin({ ...base, now: new Date('2026-10-20T06:00:00Z') });
    expect(r).toEqual({ show: true, weekStart: '2026-10-12' });
  });

  it('zmeškaná neděle → nahradí ji check-in dalšího týdne', () => {
    const r = shouldShowCheckin({ ...base, now: new Date('2026-10-25T18:30:00Z'), dismissedWeekStart: null });
    expect(r.weekStart).toBe('2026-10-19');
    expect(r.show).toBe(true);
  });

  it('zodpovězeno → neukazovat', () => {
    expect(shouldShowCheckin({ ...base, answeredWeekStarts: ['2026-10-12'] }).show).toBe(false);
  });

  it('přeskočeno pro týden → neukazovat, další týden zase ano', () => {
    expect(shouldShowCheckin({ ...base, dismissedWeekStart: '2026-10-12' }).show).toBe(false);
    expect(shouldShowCheckin({
      ...base, dismissedWeekStart: '2026-10-12', now: new Date('2026-10-25T19:00:00Z'),
    }).show).toBe(true);
  });

  it('zavřeno bez odpovědi → v téže relaci už ne', () => {
    expect(shouldShowCheckin({ ...base, snoozedThisSession: true }).show).toBe(false);
  });

  it('během tréninku se neotevře', () => {
    expect(shouldShowCheckin({ ...base, pathname: '/training' }).show).toBe(false);
    expect(shouldShowCheckin({ ...base, pathname: '/custom-workout/abc' }).show).toBe(false);
  });

  it('bez dokončeného onboardingu ne', () => {
    expect(shouldShowCheckin({ ...base, onboardingCompleted: false }).show).toBe(false);
  });

  it('účet založený po nedělní 19:00 → až příští týden', () => {
    const r = shouldShowCheckin({ ...base, now: new Date('2026-10-20T06:00:00Z'), userCreatedAt: '2026-10-19T08:00:00Z' });
    expect(r.show).toBe(false);
  });
});

describe('recordsInWeek', () => {
  it('jen překonané maximum v daném týdnu', () => {
    const prs = [
      { id: 'a', achievedAt: '2026-10-14T16:00:00Z', previousMax: 50 },
      { id: 'b', achievedAt: '2026-10-14T16:00:00Z', previousMax: null },
      { id: 'c', achievedAt: '2026-10-05T16:00:00Z', previousMax: 40 },
      { id: 'd', achievedAt: '2026-10-11T22:30:00Z', previousMax: 40 }, // pondělí 0:30 Praha
    ];
    expect(recordsInWeek(prs, '2026-10-12').map((r) => r.id)).toEqual(['a', 'd']);
  });
});

describe('clampText', () => {
  it('ořízne a prázdné převede na null', () => {
    expect(clampText('   ')).toBeNull();
    expect(clampText('x'.repeat(400))?.length).toBe(300);
    expect(clampText(' ahoj ')).toBe('ahoj');
  });
});

describe('aggregateCheckinsByWeek', () => {
  it('průměry po týdnech, nejnovější první, jen řádky s textem', () => {
    const row = (id: string, week_start: string, mood: number, training: number, hardest: string | null = null) =>
      ({ id, week_start, mood, training, hardest, app_feedback: null, created_at: '2026-10-18T18:00:00Z' });
    const agg = aggregateCheckinsByWeek([
      row('1', '2026-10-05', 3, 4),
      row('2', '2026-10-12', 5, 4, 'nohy'),
      row('3', '2026-10-12', 4, 3),
      row('4', '2026-10-12', 4, 2),
    ]);
    expect(agg.map((w) => w.weekStart)).toEqual(['2026-10-12', '2026-10-05']);
    expect(agg[0]).toMatchObject({ count: 3, avgMood: 4.3, avgTraining: 3 });
    expect(agg[0].texts.map((t) => t.id)).toEqual(['2']);
  });
});

describe('formatWeekRange', () => {
  it('formats a week inside one month in Czech', () => {
    expect(formatWeekRange('2026-10-12', 'cs')).toBe('12.–18. 10.');
  });
  it('formats a week across months in Czech', () => {
    expect(formatWeekRange('2026-09-28', 'cs')).toBe('28. 9. – 4. 10.');
  });
  it('formats in English', () => {
    expect(formatWeekRange('2026-10-12', 'en')).toBe('Oct 12–18');
  });
});
