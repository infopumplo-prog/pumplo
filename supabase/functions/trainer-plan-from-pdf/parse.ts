// Pure validation / normalisation of the model's extracted plan (no network, no Deno APIs).
// Used by index.ts and tested by parse_test.ts.

export const MAX_DAYS = 14;
export const MAX_EXERCISES_PER_DAY = 40;
const MAX_NAME_LEN = 120;
const MAX_PHASE_LEN = 120;
const MAX_REPS_LEN = 40;
const MAX_NOTES_LEN = 500;

export interface PlanExercise {
  name: string;
  sets: number | null;
  reps: string | null;
  weight_kg: number | null;
  rest_seconds: number | null;
  notes: string | null;
}

export interface PlanDay {
  name: string;
  phase: string | null;
  exercises: PlanExercise[];
}

export interface Plan {
  name: string | null;
  days: PlanDay[];
}

export const TOOL_NAME = "record_training_plan";

const nullableString = { type: ["string", "null"] };
const nullableNumber = { type: ["number", "null"] };

// JSON Schema for the tool input (strict tool use: every property required, no extras).
export const PLAN_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["plan"],
  properties: {
    plan: {
      type: "object",
      additionalProperties: false,
      required: ["name", "days"],
      properties: {
        name: { ...nullableString, description: "Plan title as written in the document, or null." },
        days: {
          type: "array",
          description: "One entry per training day / session (e.g. 'Den A', 'Day 1', 'Push'). Empty if none found.",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name", "phase", "exercises"],
            properties: {
              name: { type: "string", description: "Day/session label as written." },
              phase: { ...nullableString, description: "Phase / week / block label if any (e.g. 'Týden 1-4'), else null." },
              exercises: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["name", "sets", "reps", "weight_kg", "rest_seconds", "notes"],
                  properties: {
                    name: { type: "string", description: "Exercise name exactly as written (do not translate)." },
                    sets: { ...nullableNumber, description: "Number of working sets, e.g. 4 for '4×8-10'." },
                    reps: { ...nullableString, description: "Reps as text, e.g. '8-10', '12', 'AMRAP', '30 s'." },
                    weight_kg: { ...nullableNumber, description: "Load in kg if stated, else null." },
                    rest_seconds: { ...nullableNumber, description: "Rest between sets in seconds if stated." },
                    notes: { ...nullableString, description: "Other per-exercise notes (tempo, RPE, technique)." },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function cleanString(v: unknown, max: number): string | null {
  if (typeof v === "number" && Number.isFinite(v)) v = String(v);
  if (typeof v !== "string") return null;
  const s = v.replace(/\s+/g, " ").trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max).trimEnd() : s;
}

// Accepts 4, "4", "4.5", "60 kg", "60,5kg", "90 s", "2 min". Returns first number found.
function parseNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const m = v.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

function coerceSets(v: unknown): number | null {
  const n = parseNumber(v);
  if (n === null) return null;
  const r = Math.round(n);
  return r >= 1 && r <= 100 ? r : null;
}

function coerceWeight(v: unknown): number | null {
  const n = parseNumber(v);
  if (n === null || n < 0 || n > 1000) return null;
  // lbs → kg if the source string says so
  const isLb = typeof v === "string" && /\b(lb|lbs|pounds?)\b/i.test(v);
  const kg = isLb ? n * 0.45359237 : n;
  return Math.round(kg * 100) / 100;
}

function coerceRestSeconds(v: unknown): number | null {
  const n = parseNumber(v);
  if (n === null || n < 0) return null;
  const isMin = typeof v === "string" && /\b(min|mins|minut[ay]?|minutes?|')/i.test(v) &&
    !/\b(s|sec|secs|seconds?|sekund[y]?)\b/i.test(v);
  const secs = Math.round(isMin ? n * 60 : n);
  return secs <= 3600 ? secs : null;
}

function coerceReps(v: unknown): string | null {
  const s = cleanString(v, MAX_REPS_LEN);
  if (!s) return null;
  // normalise dash variants in ranges: "8–12" / "8 - 12" → "8-12"
  return s.replace(/\s*[–—-]\s*/g, "-");
}

function normaliseExercise(raw: unknown): PlanExercise | null {
  if (!isObj(raw)) return null;
  const name = cleanString(raw.name, MAX_NAME_LEN);
  if (!name) return null;
  return {
    name,
    sets: coerceSets(raw.sets),
    reps: coerceReps(raw.reps),
    weight_kg: coerceWeight(raw.weight_kg),
    rest_seconds: coerceRestSeconds(raw.rest_seconds),
    notes: cleanString(raw.notes, MAX_NOTES_LEN),
  };
}

function normaliseDay(raw: unknown, index: number): PlanDay | null {
  if (!isObj(raw)) return null;
  const list = Array.isArray(raw.exercises) ? raw.exercises : [];
  const exercises: PlanExercise[] = [];
  for (const e of list) {
    const ex = normaliseExercise(e);
    if (ex) exercises.push(ex);
    if (exercises.length >= MAX_EXERCISES_PER_DAY) break;
  }
  if (exercises.length === 0) return null;
  return {
    name: cleanString(raw.name, MAX_NAME_LEN) ?? `Day ${index + 1}`,
    phase: cleanString(raw.phase, MAX_PHASE_LEN),
    exercises,
  };
}

/**
 * Normalise the tool input (or anything) into a safe Plan.
 * Accepts `{ plan: {...} }` or the bare plan object. Never throws.
 */
export function normalisePlan(input: unknown): Plan {
  const planRaw = isObj(input) && isObj(input.plan) ? input.plan : input;
  if (!isObj(planRaw)) return { name: null, days: [] };
  const daysRaw = Array.isArray(planRaw.days) ? planRaw.days : [];
  const days: PlanDay[] = [];
  for (const d of daysRaw) {
    const day = normaliseDay(d, days.length);
    if (day) days.push(day);
    if (days.length >= MAX_DAYS) break;
  }
  return { name: cleanString(planRaw.name, MAX_NAME_LEN), days };
}

/**
 * Extract the plan from an Anthropic Messages API response body.
 * Returns null when the response has no matching tool_use block.
 */
export function planFromMessageResponse(resp: unknown): Plan | null {
  if (!isObj(resp) || !Array.isArray(resp.content)) return null;
  for (const block of resp.content) {
    if (isObj(block) && block.type === "tool_use" && block.name === TOOL_NAME) {
      return normalisePlan(block.input);
    }
  }
  return null;
}
