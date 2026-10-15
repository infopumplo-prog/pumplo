// Týdenní check-in — čistá logika (feedback 13. 10.).
// Check-in „vyprší" v neděli v 19:00 Europe/Prague. Kdo ten den neodpoví,
// dostane ho při dalším otevření appky, dokud ho nenahradí check-in dalšího týdne.

export const CHECKIN_TZ = 'Europe/Prague';
export const CHECKIN_HOUR = 19;
export const CHECKIN_TEXT_MAX = 300;
export const OPEN_CHECKIN_EVENT = 'pumplo:open-weekly-checkin';

interface ZonedParts {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number;
  minute: number;
  isoWeekday: number; // 1 = pondělí … 7 = neděle
}

const WEEKDAY_INDEX: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: CHECKIN_TZ,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  weekday: 'short',
  hourCycle: 'h23',
});

export function pragueParts(date: Date): ZonedParts {
  const parts: Record<string, string> = {};
  for (const p of formatter.formatToParts(date)) parts[p.type] = p.value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    isoWeekday: WEEKDAY_INDEX[parts.weekday] ?? 1,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

// Kalendářní posun data YYYY-MM-DD (bez časové zóny).
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

// Pondělí týdne, do kterého `date` patří (v pražském čase).
export function pragueWeekStart(date: Date): string {
  const p = pragueParts(date);
  return addDays(`${p.year}-${pad(p.month)}-${pad(p.day)}`, -(p.isoWeekday - 1));
}

// Pražský místní čas → okamžik (UTC). Počítá s letním/zimním časem.
export function pragueLocalToDate(isoDate: string, hour = 0, minute = 0): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  const target = Date.UTC(y, m - 1, d, hour, minute);
  let guess = target;
  for (let i = 0; i < 2; i++) {
    const p = pragueParts(new Date(guess));
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    guess += target - asUtc;
  }
  return new Date(guess);
}

// Kdy se check-in daného týdne otevírá (neděle 19:00 Praha).
export function checkinOpensAt(weekStart: string): Date {
  return pragueLocalToDate(addDays(weekStart, 6), CHECKIN_HOUR);
}

// Týden, ke kterému právě patří check-in: od neděle 19:00 aktuální týden,
// jinak týden předchozí (ten, jehož neděle už proběhla).
export function currentCheckinWeekStart(now: Date): string {
  const thisWeek = pragueWeekStart(now);
  return now.getTime() >= checkinOpensAt(thisWeek).getTime() ? thisWeek : addDays(thisWeek, -7);
}

// Hranice týdne pro souhrn [pondělí 00:00, další pondělí 00:00) v Praze.
export function weekRange(weekStart: string): { from: Date; to: Date } {
  return { from: pragueLocalToDate(weekStart), to: pragueLocalToDate(addDays(weekStart, 7)) };
}

export interface CheckinDecisionInput {
  now: Date;
  userCreatedAt: string | null | undefined;
  onboardingCompleted: boolean;
  answeredWeekStarts: string[];
  dismissedWeekStart: string | null; // „Přeskočit" — pro ten týden už neukazovat
  snoozedThisSession: boolean; // zavřeno bez odpovědi — znovu až při dalším otevření appky
  pathname: string;
}

// Obrazovky, kde se check-in smí sám otevřít (ne uprostřed tréninku).
const AUTO_OPEN_PATHS = ['/', '/statistics', '/profile', '/map', '/workouts', '/settings'];

export function isAutoOpenPath(pathname: string): boolean {
  return AUTO_OPEN_PATHS.includes(pathname);
}

export function shouldShowCheckin(input: CheckinDecisionInput): { show: boolean; weekStart: string } {
  const weekStart = currentCheckinWeekStart(input.now);
  const no = { show: false, weekStart };
  if (!input.onboardingCompleted) return no;
  if (input.snoozedThisSession) return no;
  if (!isAutoOpenPath(input.pathname)) return no;
  if (input.dismissedWeekStart === weekStart) return no;
  if (input.answeredWeekStarts.includes(weekStart)) return no;
  // Nový účet: check-in až za týden, ve kterém už byl registrovaný před nedělí 19:00.
  if (input.userCreatedAt) {
    const created = new Date(input.userCreatedAt).getTime();
    if (!Number.isNaN(created) && created >= checkinOpensAt(weekStart).getTime()) return no;
  }
  return { show: true, weekStart };
}

export interface PersonalRecordLike {
  achievedAt: string;
  previousMax: number | null;
}

// Nové osobní rekordy v týdnu = překonané maximum (ne první zápis cviku).
export function recordsInWeek<T extends PersonalRecordLike>(records: T[], weekStart: string): T[] {
  const { from, to } = weekRange(weekStart);
  return records.filter((r) => {
    if (r.previousMax == null) return false;
    const t = new Date(r.achievedAt).getTime();
    return t >= from.getTime() && t < to.getTime();
  });
}

export function clampText(value: string): string | null {
  const trimmed = value.trim().slice(0, CHECKIN_TEXT_MAX);
  return trimmed.length > 0 ? trimmed : null;
}

export interface CheckinRow {
  id: string;
  week_start: string;
  mood: number;
  training: number;
  hardest: string | null;
  app_feedback: string | null;
  created_at: string;
}

export interface CheckinWeekAggregate {
  weekStart: string;
  count: number;
  avgMood: number;
  avgTraining: number;
  texts: { id: string; hardest: string | null; appFeedback: string | null; createdAt: string }[];
}

// Admin přehled: průměry po týdnech + volné texty, nejnovější týden první.
export function aggregateCheckinsByWeek(rows: CheckinRow[]): CheckinWeekAggregate[] {
  const byWeek = new Map<string, CheckinRow[]>();
  for (const r of rows) {
    const list = byWeek.get(r.week_start) ?? [];
    list.push(r);
    byWeek.set(r.week_start, list);
  }
  const round1 = (n: number) => Math.round(n * 10) / 10;
  return Array.from(byWeek.entries())
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([weekStart, list]) => ({
      weekStart,
      count: list.length,
      avgMood: round1(list.reduce((a, r) => a + r.mood, 0) / list.length),
      avgTraining: round1(list.reduce((a, r) => a + r.training, 0) / list.length),
      texts: list
        .filter((r) => r.hardest || r.app_feedback)
        .map((r) => ({ id: r.id, hardest: r.hardest, appFeedback: r.app_feedback, createdAt: r.created_at })),
    }));
}

// Váha v check-inu (David 15. 10.: „chybí mi tam změna ve váze“).
export const WEIGHT_MIN_KG = 25;
export const WEIGHT_MAX_KG = 400;

/** „82,4“ / „82.4“ → 82.4; mimo rozsah nebo nesmysl → null. */
export function parseWeightKg(input: string): number | null {
  const v = Number(input.trim().replace(',', '.'));
  if (!input.trim() || !Number.isFinite(v) || v < WEIGHT_MIN_KG || v > WEIGHT_MAX_KG) return null;
  return Math.round(v * 10) / 10;
}

export type WeightTrend = 'good' | 'bad' | 'neutral';

/** Změna proti minulé váze a jestli jde správným směrem podle cíle. */
export function weightChange(
  previous: number | null | undefined,
  current: number | null | undefined,
  goal: string | null | undefined,
): { delta: number; trend: WeightTrend } | null {
  if (previous == null || current == null) return null;
  const delta = Math.round((current - previous) * 10) / 10;
  if (delta === 0) return { delta: 0, trend: 'neutral' };
  const wantsDown = goal === 'fat_loss';
  const wantsUp = goal === 'muscle_gain';
  const trend: WeightTrend = wantsDown ? (delta < 0 ? 'good' : 'bad')
    : wantsUp ? (delta > 0 ? 'good' : 'bad')
    : 'neutral';
  return { delta, trend };
}
