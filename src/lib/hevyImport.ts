// Import of workout history from a Hevy CSV export.
//
// Hevy (Settings → Export Data) hands the user a CSV with one row per set:
//   title, start_time, end_time, description, exercise_title, superset_id,
//   exercise_notes, set_index, set_type, weight_kg, reps, distance_km,
//   duration_seconds, rpe
// Column order is not guaranteed across app versions, so everything is read
// by header name. Bringing the history over is the adoption bridge for people
// switching from Hevy — nobody abandons years of logged workouts (user
// feedback, 7 Aug 2026).

export interface HevySetRow {
  workoutTitle: string;
  startTime: string;
  endTime: string;
  exerciseTitle: string;
  setIndex: number;
  setType: string;
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
}

export interface HevyWorkout {
  title: string;
  startTime: Date;
  endTime: Date | null;
  /** Stable id derived from the workout — makes re-imports skip duplicates. */
  clientSessionId: string;
  sets: HevySetRow[];
}

export interface HevyImportPlan {
  workouts: HevyWorkout[];
  /** Distinct Hevy exercise names → matched Pumplo exercise id (or null). */
  exerciseMap: Map<string, string | null>;
  matchedNames: string[];
  unmatchedNames: string[];
}

/** Minimal exercise shape needed for matching. */
export interface MatchableExercise {
  id: string;
  name: string;
  name_en: string | null;
}

// RFC-4180-ish CSV parser: quoted fields may contain commas, quotes ("" =
// escaped quote) and newlines. Hevy quotes notes/descriptions, so a naive
// split-on-comma silently corrupts rows.
export const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field); field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== '') rows.push(row);
  }
  return rows;
};

const num = (v: string | undefined): number | null => {
  if (v == null || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const parseHevyCsv = (text: string): HevySetRow[] => {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0].map(h => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const iTitle = col('title');
  const iStart = col('start_time');
  const iEnd = col('end_time');
  const iExercise = col('exercise_title');
  const iSetIndex = col('set_index');
  const iSetType = col('set_type');
  const iWeight = col('weight_kg');
  const iReps = col('reps');
  const iDuration = col('duration_seconds');
  if (iTitle < 0 || iStart < 0 || iExercise < 0) {
    throw new Error('not_hevy_csv');
  }
  return rows.slice(1)
    .filter(r => (r[iExercise] ?? '').trim() !== '')
    .map(r => ({
      workoutTitle: (r[iTitle] ?? '').trim(),
      startTime: (r[iStart] ?? '').trim(),
      endTime: iEnd >= 0 ? (r[iEnd] ?? '').trim() : '',
      exerciseTitle: (r[iExercise] ?? '').trim(),
      setIndex: num(r[iSetIndex]) ?? 0,
      setType: iSetType >= 0 ? (r[iSetType] ?? '').trim() : 'normal',
      weightKg: num(r[iWeight]),
      reps: num(r[iReps]),
      durationSeconds: num(r[iDuration]),
    }));
};

// Hevy timestamps look like "7 Aug 2026, 17:39" or ISO — Date.parse handles
// both; anything unparseable drops the workout rather than corrupting history.
const parseHevyDate = (s: string): Date | null => {
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t);
};

export const groupWorkouts = (rows: HevySetRow[]): HevyWorkout[] => {
  const byKey = new Map<string, HevySetRow[]>();
  for (const r of rows) {
    const key = `${r.workoutTitle}|${r.startTime}`;
    const list = byKey.get(key);
    if (list) list.push(r); else byKey.set(key, [r]);
  }
  const workouts: HevyWorkout[] = [];
  for (const [key, sets] of byKey) {
    const start = parseHevyDate(sets[0].startTime);
    if (!start) continue;
    workouts.push({
      title: sets[0].workoutTitle || 'Hevy trénink',
      startTime: start,
      endTime: parseHevyDate(sets[0].endTime),
      // Deterministic id: the same export imported twice maps to the same
      // sessions, so re-imports are no-ops instead of duplicates.
      clientSessionId: `hevy:${simpleHash(key)}`,
      sets,
    });
  }
  workouts.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  return workouts;
};

// Tiny stable string hash (djb2) — collision risk across one user's workout
// list is negligible and ids stay short.
const simpleHash = (s: string): string => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
};

const normalizeName = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/\(.*?\)/g, ' ')     // "(Barbell)", "(Dumbbell)" — Hevy equipment suffixes
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Matches Hevy exercise names against the Pumplo catalog by normalized name
 * (Czech or English). Unmatched names are reported so the import can create
 * private custom exercises for them.
 */
export const matchExercises = (
  rows: HevySetRow[],
  catalog: MatchableExercise[],
): { exerciseMap: Map<string, string | null>; matchedNames: string[]; unmatchedNames: string[] } => {
  const byNorm = new Map<string, string>();
  for (const ex of catalog) {
    byNorm.set(normalizeName(ex.name), ex.id);
    if (ex.name_en) {
      const en = normalizeName(ex.name_en);
      if (!byNorm.has(en)) byNorm.set(en, ex.id);
    }
  }
  const exerciseMap = new Map<string, string | null>();
  for (const r of rows) {
    if (exerciseMap.has(r.exerciseTitle)) continue;
    exerciseMap.set(r.exerciseTitle, byNorm.get(normalizeName(r.exerciseTitle)) ?? null);
  }
  const matchedNames: string[] = [];
  const unmatchedNames: string[] = [];
  for (const [name, id] of exerciseMap) {
    (id ? matchedNames : unmatchedNames).push(name);
  }
  return { exerciseMap, matchedNames, unmatchedNames };
};

export const buildImportPlan = (csvText: string, catalog: MatchableExercise[]): HevyImportPlan => {
  const rows = parseHevyCsv(csvText);
  const workouts = groupWorkouts(rows);
  const { exerciseMap, matchedNames, unmatchedNames } = matchExercises(rows, catalog);
  return { workouts, exerciseMap, matchedNames, unmatchedNames };
};
