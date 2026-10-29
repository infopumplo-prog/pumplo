// Fáze plánu a progrese po týdnech (trenérská platforma, migrace 20261029).
// Čisté funkce bez Supabase — testy v planPhases.test.ts.
// Plány bez fází/progresí musí projít beze změny (identita), ať se nic nerozbije.

export const PLAN_TZ = 'Europe/Prague';
const DAY_MS = 86_400_000;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface PlanPhase {
  id: string;
  plan_id?: string;
  order_index: number;
  name: string;
  name_en: string | null;
  start_week: number;
  end_week: number;
  notes?: string | null;
}

export interface ExerciseProgression {
  plan_exercise_id: string;
  from_week: number;
  sets: number | null;
  reps: number | null;
  weight_kg: number | null;
  notes?: string | null;
}

export interface PhasedDay {
  id: string;
  phase_id?: string | null;
}

export interface PlanWeek {
  /** 1-based týden, po konci zůstává na posledním. */
  week: number;
  /** Celkem týdnů (přiřazení → duration_weeks → konec fází); null = neomezeně. */
  totalWeeks: number | null;
  /** Plán už skončil (dnešek za posledním týdnem). */
  finished: boolean;
}

/** Datum (YYYY-MM-DD) v Praze pro daný okamžik. */
export const pragueIsoDate = (d: Date = new Date()): string => {
  const parts: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat('en-CA', { timeZone: PLAN_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d)) {
    parts[p.type] = p.value;
  }
  return `${parts.year}-${parts.month}-${parts.day}`;
};

/** YYYY-MM-DD nebo timestamp → pražské datum. Null u neplatného vstupu. */
export const toPragueDate = (value: string | null | undefined): string | null => {
  if (!value) return null;
  if (ISO_DATE_RE.test(value)) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : pragueIsoDate(d);
};

const dayIndex = (iso: string): number | null => {
  const m = ISO_DATE_RE.exec(iso);
  if (!m) return null;
  return Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY_MS);
};

const validWeek = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 1;

/** Délka plánu: přiřazení trenéra → duration_weeks plánu → konec poslední fáze → null. */
export const planTotalWeeks = (
  assignmentWeeks: number | null | undefined,
  durationWeeks: number | null | undefined,
  phases: readonly PlanPhase[] | null | undefined,
): number | null => {
  if (validWeek(assignmentWeeks)) return Math.round(assignmentWeeks);
  if (validWeek(durationWeeks)) return Math.round(durationWeeks);
  const ends = (phases ?? []).map(p => p.end_week).filter(validWeek);
  return ends.length ? Math.max(...ends) : null;
};

/**
 * Aktuální týden plánu. Týden 1 začíná dnem startu (pražské datum); před startem = 1.
 * Po konci zůstává na posledním týdnu a `finished` je true.
 */
export const currentPlanWeek = (
  startDate: string | null | undefined,
  totalWeeks: number | null,
  today: string = pragueIsoDate(),
): PlanWeek => {
  const start = toPragueDate(startDate);
  const s = start ? dayIndex(start) : null;
  const t = dayIndex(today);
  let week = s === null || t === null ? 1 : Math.floor((t - s) / 7) + 1;
  if (week < 1) week = 1;
  let finished = false;
  if (totalWeeks !== null && totalWeeks >= 1 && week > totalWeeks) {
    week = totalWeeks;
    finished = true;
  }
  return { week, totalWeeks, finished };
};

/** Fáze, do které týden spadá (při překryvu ta s nižším order_index). */
export const phaseForWeek = (phases: readonly PlanPhase[] | null | undefined, week: number): PlanPhase | null => {
  const covering = (phases ?? []).filter(p => p.start_week <= week && week <= p.end_week);
  if (!covering.length) return null;
  return covering.slice().sort((a, b) => a.order_index - b.order_index || a.start_week - b.start_week)[0];
};

/** Fáze seřazené po týdnech (pro časovou osu). */
export const sortPhases = (phases: readonly PlanPhase[] | null | undefined): PlanPhase[] =>
  (phases ?? []).slice().sort((a, b) => a.start_week - b.start_week || a.order_index - b.order_index);

/**
 * Fáze, jejíž dny platí v daném týdnu: pokrývající fáze; v mezeře (žádná fáze týden
 * nepokrývá) nejbližší předchozí, před první fází ta první. Null = plán bez fází.
 */
export const effectivePhaseForWeek = (
  phases: readonly PlanPhase[] | null | undefined,
  week: number,
): PlanPhase | null => {
  const covering = phaseForWeek(phases, week);
  if (covering) return covering;
  const sorted = sortPhases(phases);
  if (!sorted.length) return null;
  const previous = sorted.filter(p => p.end_week < week);
  return previous.length ? previous.reduce((a, b) => (b.end_week >= a.end_week ? b : a)) : sorted[0];
};

/**
 * Dny platné v daném týdnu.
 * - plán bez fází → všechny dny (beze změny),
 * - týden ve fázi → dny té fáze + dny bez fáze,
 * - mezera → dny bez fáze, a když žádné nejsou, dny nejbližší předchozí fáze.
 * Den s phase_id na neexistující fázi se bere jako „platí vždy“.
 * Kdyby výsledek vyšel prázdný, vrací všechny dny (nikdy neschovat celý plán).
 */
export const activeDaysForWeek = <T extends PhasedDay>(
  days: readonly T[],
  phases: readonly PlanPhase[] | null | undefined,
  week: number,
): T[] => {
  const list = phases ?? [];
  if (!list.length) return days.slice();
  const known = new Set(list.map(p => p.id));
  const phaseOf = (d: T) => (d.phase_id && known.has(d.phase_id) ? d.phase_id : null);
  const always = days.filter(d => phaseOf(d) === null);
  const covering = phaseForWeek(list, week);
  let result: T[];
  if (covering) {
    result = days.filter(d => phaseOf(d) === null || phaseOf(d) === covering.id);
  } else if (always.length) {
    result = always;
  } else {
    const fallback = effectivePhaseForWeek(list, week);
    result = fallback ? days.filter(d => phaseOf(d) === fallback.id) : [];
  }
  return result.length ? result : days.slice();
};

export interface Prescription {
  sets: number;
  reps: number;
  weight_kg: number | null;
}

export interface EffectivePrescription extends Prescription {
  /** Některé pravidlo progrese v tomto týdnu platí. */
  progressed: boolean;
  repsOverridden: boolean;
  weightOverridden: boolean;
  setsOverridden: boolean;
  /** Poznámka posledního platného pravidla s poznámkou. */
  note: string | null;
}

/** Pravidla jednoho cviku seřazená podle from_week. */
export const progressionsForExercise = (
  progressions: readonly ExerciseProgression[] | null | undefined,
  planExerciseId: string,
): ExerciseProgression[] =>
  (progressions ?? []).filter(p => p.plan_exercise_id === planExerciseId).sort((a, b) => a.from_week - b.from_week);

/**
 * Série/opakování/váha v týdnu N. Pravidla s from_week ≤ N se skládají postupně:
 * hodnota null = beze změny (zůstává poslední zadaná, jinak základ cviku), takže
 * pro vyplněné hodnoty platí vždy pravidlo s nejvyšším from_week ≤ N.
 */
export const effectivePrescription = (
  base: Prescription,
  rules: readonly ExerciseProgression[] | null | undefined,
  week: number,
): EffectivePrescription => {
  const out: EffectivePrescription = {
    sets: base.sets, reps: base.reps, weight_kg: base.weight_kg,
    progressed: false, repsOverridden: false, weightOverridden: false, setsOverridden: false, note: null,
  };
  const applicable = (rules ?? []).filter(r => r.from_week <= week).sort((a, b) => a.from_week - b.from_week);
  for (const r of applicable) {
    out.progressed = true;
    if (r.sets != null && r.sets >= 1) { out.sets = Math.round(r.sets); out.setsOverridden = true; }
    if (r.reps != null && r.reps >= 1) { out.reps = Math.round(r.reps); out.repsOverridden = true; }
    if (r.weight_kg != null && r.weight_kg >= 0) { out.weight_kg = Number(r.weight_kg); out.weightOverridden = true; }
    if (r.notes?.trim()) out.note = r.notes.trim();
  }
  return out;
};

/** Pole po sériích na délku n: zkrátit, nebo doplnit poslední hodnotou (prázdné/null zůstává). */
export const resizePerSet = <T>(arr: readonly T[] | null | undefined, n: number, pad?: T): T[] | null => {
  if (!arr || arr.length === 0) return arr ? [] : null;
  if (arr.length >= n) return arr.slice(0, n);
  const fill = pad !== undefined ? pad : arr[arr.length - 1];
  return [...arr, ...Array(n - arr.length).fill(fill)];
};

export interface PlanExerciseShape {
  id: string;
  sets: number;
  reps: number;
  weight_kg: number | null;
  reps_per_set: number[] | null;
  weight_per_set: (number | null)[] | null;
  rest_per_set: number[] | null;
  set_types: (string | null)[] | null;
}

/**
 * Cvik tak, jak se má odcvičit v týdnu N. Bez platné progrese vrací vstup beze
 * změny (stejný objekt). Při změně počtu sérií se pole po sériích zkrátí, nebo
 * doplní poslední hodnotou (typy sérií doplní „normal“). Když progrese přepíše
 * opakování/váhu, má přednost před poli po sériích (ta se zahodí).
 */
export const applyProgressionToExercise = <T extends PlanExerciseShape>(
  exercise: T,
  progressions: readonly ExerciseProgression[] | null | undefined,
  week: number,
): T => {
  const rules = progressionsForExercise(progressions, exercise.id);
  if (!rules.length) return exercise;
  const eff = effectivePrescription(
    { sets: exercise.sets, reps: exercise.reps, weight_kg: exercise.weight_kg },
    rules,
    week,
  );
  if (!eff.progressed) return exercise;
  const n = Math.max(1, eff.sets);
  return {
    ...exercise,
    sets: n,
    reps: eff.reps,
    weight_kg: eff.weight_kg,
    reps_per_set: eff.repsOverridden ? null : resizePerSet(exercise.reps_per_set, n),
    weight_per_set: eff.weightOverridden ? null : resizePerSet(exercise.weight_per_set, n),
    rest_per_set: resizePerSet(exercise.rest_per_set, n),
    set_types: resizePerSet<string | null>(exercise.set_types, n, 'normal'),
  };
};

/** Pravidla, která teprve přijdou (from_week > N) — pro nápovědu „od 5. týdne 4 série“. */
export const upcomingProgressions = (
  progressions: readonly ExerciseProgression[] | null | undefined,
  planExerciseId: string,
  week: number,
): ExerciseProgression[] => progressionsForExercise(progressions, planExerciseId).filter(r => r.from_week > week);

export interface AssignmentLike {
  plan_id: string | null;
  start_date: string;
  weeks?: number | null;
  ended_at?: string | null;
}

/**
 * Přiřazení od trenéra pro plán (neukončené trenérem; i po uplynutí období, aby
 * se týden po konci držel na posledním). Při víc kusech to s nejpozdějším startem.
 */
export const findPlanAssignment = <A extends AssignmentLike>(
  planId: string | null | undefined,
  assignments: readonly A[] | null | undefined,
): A | null => {
  if (!planId) return null;
  let best: A | null = null;
  for (const a of assignments ?? []) {
    if (a.plan_id !== planId || a.ended_at || !ISO_DATE_RE.test(a.start_date ?? '')) continue;
    if (!best || a.start_date > best.start_date) best = a;
  }
  return best;
};

/** Start plánu: start přiřazení od trenéra, jinak created_at plánu (pražské datum). */
export const planStartDate = (
  planId: string,
  createdAt: string | null | undefined,
  assignments: readonly AssignmentLike[] | null | undefined,
): string | null => findPlanAssignment(planId, assignments)?.start_date ?? toPragueDate(createdAt);

export interface PlanScheduleInput {
  id: string;
  created_at?: string | null;
  duration_weeks?: number | null;
  phases?: readonly PlanPhase[] | null;
}

export interface PlanSchedule extends PlanWeek {
  phase: PlanPhase | null;
  /** Fáze, jejíž dny teď platí (v mezeře nejbližší předchozí). */
  effectivePhase: PlanPhase | null;
  startDate: string | null;
}

/** Vše o „teď“ pro jeden plán: týden, délka, fáze. */
export const planSchedule = (
  plan: PlanScheduleInput,
  assignments: readonly AssignmentLike[] | null | undefined,
  today: string = pragueIsoDate(),
): PlanSchedule => {
  const assignment = findPlanAssignment(plan.id, assignments);
  const startDate = assignment?.start_date ?? toPragueDate(plan.created_at);
  const total = planTotalWeeks(assignment?.weeks, plan.duration_weeks, plan.phases);
  const w = currentPlanWeek(startDate, total, today);
  return {
    ...w,
    startDate,
    phase: phaseForWeek(plan.phases, w.week),
    effectivePhase: effectivePhaseForWeek(plan.phases, w.week),
  };
};

/** Má plán něco, co závisí na týdnu? (jinak se nic nepočítá ani nečeká) */
export const hasWeeklySchedule = (
  phases: readonly PlanPhase[] | null | undefined,
  progressions: readonly ExerciseProgression[] | null | undefined,
): boolean => (phases?.length ?? 0) > 0 || (progressions?.length ?? 0) > 0;
