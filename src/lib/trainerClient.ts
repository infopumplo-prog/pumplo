// Klient trenéra v appce: přiřazené plány („Od trenéra“), zpětná vazba po tréninku.
// Čisté funkce bez Supabase — testy v trainerClient.test.ts.

export interface TrainerAssignment {
  id: string;
  trainer_client_id: string;
  trainer_user_id: string;
  plan_id: string | null;
  plan_name: string;
  /** YYYY-MM-DD */
  start_date: string;
  weeks: number;
  sessions_per_week: number;
  ended_at: string | null;
}

export interface MyTrainer {
  link_id: string;
  trainer_user_id: string;
  trainer_name: string;
  trainer_photo: string | null;
  accepted_at: string | null;
  /** Od migrace 20261030 — bez ní chybí (undefined) a check-in/váhy se neukazují. */
  checkin_form_id?: string | null;
  checkin_weekday?: number | null;
  client_shares_weight?: boolean;
}

export const NOTE_MAX_LENGTH = 1000;
export const DIFFICULTY_LEVELS = [1, 2, 3, 4, 5] as const;
export type Difficulty = (typeof DIFFICULTY_LEVELS)[number];

// Statické klíče (gate trainer-app-i18n neumí ověřit skládané).
export const DIFFICULTY_LABEL_KEYS: Record<Difficulty, string> = {
  1: 'trainer_client.difficulty_1',
  2: 'trainer_client.difficulty_2',
  3: 'trainer_client.difficulty_3',
  4: 'trainer_client.difficulty_4',
  5: 'trainer_client.difficulty_5',
};

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Dnešek (nebo `d`) jako místní YYYY-MM-DD — porovnává se s date sloupci z DB. */
export const toLocalIsoDate = (d: Date = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** start + weeks × 7 dní (stejně jako trainer_assignment_progress.end_date). Null u neplatného vstupu. */
export const assignmentEndDate = (startDate: string, weeks: number): string | null => {
  const m = ISO_DATE_RE.exec(startDate ?? '');
  if (!m || !Number.isFinite(weeks) || weeks < 0) return null;
  // Počítáno v UTC, ať přechod na letní čas neposune den.
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) + Math.round(weeks) * 7 * 86_400_000;
  const end = new Date(t);
  if (Number.isNaN(end.getTime())) return null;
  return `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, '0')}-${String(end.getUTCDate()).padStart(2, '0')}`;
};

/**
 * Přiřazení je živé: trenér ho neukončil a ještě neuplynulo (dnešek < konec).
 * Budoucí start se počítá taky — plán už u klienta je a je „od trenéra“.
 */
export const isAssignmentLive = (a: TrainerAssignment, today: string = toLocalIsoDate()): boolean => {
  if (a.ended_at || !a.plan_id) return false;
  const end = assignmentEndDate(a.start_date, a.weeks);
  if (!end) return false;
  return today < end;
};

/** Živé přiřazení pro daný plán (při víc kusech to s nejpozdějším startem). */
export const findLiveAssignmentForPlan = (
  planId: string | null | undefined,
  assignments: readonly TrainerAssignment[] | null | undefined,
  today: string = toLocalIsoDate(),
): TrainerAssignment | null => {
  if (!planId || !assignments?.length) return null;
  let best: TrainerAssignment | null = null;
  for (const a of assignments) {
    if (a.plan_id !== planId || !isAssignmentLive(a, today)) continue;
    if (!best || a.start_date > best.start_date) best = a;
  }
  return best;
};

export const isTrainerAssignedPlan = (
  planId: string | null | undefined,
  assignments: readonly TrainerAssignment[] | null | undefined,
  today: string = toLocalIsoDate(),
): boolean => findLiveAssignmentForPlan(planId, assignments, today) !== null;

export const isValidDifficulty = (value: unknown): value is Difficulty =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;

/**
 * Poznámka pro trenéra: bez řídicích znaků (kromě nového řádku/tabu), oříznutá,
 * max 1000 znaků (počítáno po znacích jako char_length v Postgresu). Prázdná → null.
 */
export const sanitizeNote = (raw: string | null | undefined): string | null => {
  if (typeof raw !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const cleaned = raw.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (!cleaned) return null;
  const chars = Array.from(cleaned);
  return chars.length > NOTE_MAX_LENGTH ? chars.slice(0, NOTE_MAX_LENGTH).join('').trimEnd() : cleaned;
};

/** Délka poznámky tak, jak ji počítá DB (znaky, ne UTF-16 jednotky). */
export const noteLength = (raw: string): number => Array.from(raw ?? '').length;

export interface SessionFeedbackUpdate {
  client_difficulty: Difficulty | null;
  client_note: string | null;
}

/** Co zapsat do workout_sessions; null = není co poslat. */
export const buildFeedbackUpdate = (difficulty: unknown, note: string | null | undefined): SessionFeedbackUpdate | null => {
  const d = isValidDifficulty(difficulty) ? difficulty : null;
  const n = sanitizeNote(note);
  if (d === null && n === null) return null;
  return { client_difficulty: d, client_note: n };
};

/** Plnění v procentech 0–100 (pro případ, že RPC nevrátí progress_pct). */
export const progressPercent = (done: number, target: number): number => {
  if (!Number.isFinite(done) || !Number.isFinite(target) || target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.floor((100 * done) / target)));
};
