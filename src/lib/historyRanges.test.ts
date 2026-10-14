import { describe, expect, it } from 'vitest';
import { buildHistoryBuckets } from './historyRanges';

describe('buildHistoryBuckets', () => {
  const now = new Date(2026, 9, 14, 15, 0); // 14. 10. 2026 (středa)
  it('7 a 30 dní po dnech, poslední sloupec je dnešek', () => {
    const b7 = buildHistoryBuckets('7d', now);
    expect(b7).toHaveLength(7);
    expect(b7[6].start).toEqual(new Date(2026, 9, 14));
    expect(buildHistoryBuckets('30d', now)).toHaveLength(30);
  });
  it('90 dní = 13 týdnů od pondělí, rok = 12 měsíců', () => {
    const w = buildHistoryBuckets('90d', now);
    expect(w).toHaveLength(13);
    expect(w[12].start).toEqual(new Date(2026, 9, 12));
    const m = buildHistoryBuckets('1y', now);
    expect(m).toHaveLength(12);
    expect(m[11].start).toEqual(new Date(2026, 9, 1));
    expect(m[0].start).toEqual(new Date(2025, 10, 1));
  });
  it('sloupce na sebe navazují bez mezer', () => {
    for (const r of ['7d', '30d', '90d', '1y'] as const) {
      const b = buildHistoryBuckets(r, now);
      for (let i = 1; i < b.length; i++) expect(b[i].start).toEqual(b[i - 1].end);
    }
  });
});
