import { addDays, addMonths, addWeeks, startOfDay, startOfMonth, startOfWeek, subDays, subMonths, subWeeks } from 'date-fns';

export const HISTORY_RANGES = ['7d', '30d', '90d', '1y'] as const;
export type HistoryRange = (typeof HISTORY_RANGES)[number];

export interface HistoryBucket { start: Date; end: Date; unit: 'day' | 'week' | 'month' }

/** Sloupce grafu historie: 7 a 30 dní po dnech, 90 dní po týdnech (13), rok po měsících (12). */
export function buildHistoryBuckets(range: HistoryRange, now: Date): HistoryBucket[] {
  const today = startOfDay(now);
  if (range === '7d' || range === '30d') {
    const n = range === '7d' ? 7 : 30;
    return Array.from({ length: n }, (_, i) => {
      const start = subDays(today, n - 1 - i);
      return { start, end: addDays(start, 1), unit: 'day' as const };
    });
  }
  if (range === '90d') {
    const thisWeek = startOfWeek(today, { weekStartsOn: 1 });
    return Array.from({ length: 13 }, (_, i) => {
      const start = subWeeks(thisWeek, 12 - i);
      return { start, end: addWeeks(start, 1), unit: 'week' as const };
    });
  }
  const thisMonth = startOfMonth(today);
  return Array.from({ length: 12 }, (_, i) => {
    const start = subMonths(thisMonth, 11 - i);
    return { start, end: addMonths(start, 1), unit: 'month' as const };
  });
}
