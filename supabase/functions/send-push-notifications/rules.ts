// Čistá pravidla ranní push notifikace (David 18. 10.) — bez Deno importů,
// aby je šlo testovat vitestem z appky (src/lib/pushRules.test.ts).
//
// Data 18. 10.: lidé, kteří nikdy netrénovali, dostávali ~3× týdně
// „😤 Včera jsi vynechal trénink!“ (1 573 odeslaných). Nově:
//  - 0 dokončených tréninků → nikdy 'missed'; jen přátelský 'first_workout'
//    ve dnech 0–1, 3 a 7 od registrace, pak nic (kromě comebacku, pokud platí),
//  - kdo už trénoval → 'missed' nejvýš 2× za klouzavých 7 dní, jinak 'morning'.

export type MorningPushKind = 'morning' | 'missed' | 'first_workout' | 'none';

/** Dny od registrace (kalendářní, Praha), kdy dostane nováček první-tréninkovou připomínku. */
export const FIRST_WORKOUT_DAYS: readonly number[] = [0, 1, 3, 7];
/** Kolik 'missed' smí odejít za klouzavých 7 dní (včetně dneška). */
export const MISSED_MAX_PER_7_DAYS = 2;
export const MISSED_WINDOW_DAYS = 7;

export interface MorningPushInput {
  /** Dokončené tréninky (completed_at not null). */
  completedWorkouts: number;
  /** Kalendářní dny od registrace (0 = den registrace); null = neznámé. */
  daysSinceSignup: number | null;
  /** Je dnes podle plánu tréninkový den? */
  isTrainingDay: boolean;
  /** Vynechal předchozí tréninkový den a má zapnuté „Zmeškaný trénink“. */
  missedPrevious: boolean;
  /** Počet 'missed' v notification_logs za posledních 7 dní (včetně dneška). */
  recentMissedCount: number;
}

export function decidePushKind(i: MorningPushInput): MorningPushKind {
  if (i.completedWorkouts <= 0) {
    if (i.daysSinceSignup === null) return 'none';
    return FIRST_WORKOUT_DAYS.includes(i.daysSinceSignup) ? 'first_workout' : 'none';
  }
  if (!i.isTrainingDay) return 'none';
  if (i.missedPrevious && i.recentMissedCount < MISSED_MAX_PER_7_DAYS) return 'missed';
  return 'morning';
}

/** Kalendářní datum YYYY-MM-DD v pražském čase (nezávislé na časové zóně serveru). */
export function pragueDateKey(date: Date): string {
  // en-CA formátuje jako YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Prague',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

const keyToUtc = (key: string): number => {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

/** Počet kalendářních dní mezi dvěma YYYY-MM-DD (to − from). */
export function daysBetweenDateKeys(fromKey: string, toKey: string): number {
  return Math.round((keyToUtc(toKey) - keyToUtc(fromKey)) / 86400000);
}

/** Posune YYYY-MM-DD o n dní (n může být záporné). */
export function shiftDateKey(key: string, days: number): string {
  const d = new Date(keyToUtc(key) + days * 86400000);
  return d.toISOString().slice(0, 10);
}

/** Začátek klouzavého okna pro limit 'missed' (dnešek + 6 dní zpět). */
export function missedWindowStart(todayKey: string): string {
  return shiftDateKey(todayKey, -(MISSED_WINDOW_DAYS - 1));
}

/** Dny od registrace; null když created_at chybí nebo je nečitelné. */
export function daysSinceSignup(createdAt: string | null | undefined, todayKey: string): number | null {
  if (!createdAt) return null;
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return null;
  return daysBetweenDateKeys(pragueDateKey(d), todayKey);
}

export interface PushTemplate { title: string; body: string }

/** Šablony s {minutes} jen tehdy, když délku tréninku známe. */
export function usableTemplates<T extends PushTemplate>(templates: T[], hasMinutes: boolean): T[] {
  if (hasMinutes) return templates;
  const withoutMinutes = templates.filter((t) => !t.title.includes('{minutes}') && !t.body.includes('{minutes}'));
  return withoutMinutes.length > 0 ? withoutMinutes : templates;
}

/** Doplní {workout}/{minutes}; text začínající názvem tréninku dostane velké písmeno. */
export function fillTemplate(text: string, workout: string, minutes: number | null): string {
  const filled = text
    .replace(/\{workout\}/g, workout)
    .replace(/\{minutes\}/g, minutes != null ? String(minutes) : '');
  return filled.charAt(0).toUpperCase() + filled.slice(1);
}
