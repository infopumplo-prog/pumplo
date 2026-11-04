// Check-in pro trenéra — čistá logika (2. feedback Adam Kakiš, 30. 10. 2026).
// Trenér klientovi přiřadí vlastní formulář a den v týdnu. Od toho dne (pražský
// čas) až do konce týdne visí na Home karta, dokud klient check-in nevyplní;
// vyplněný check-in jde upravovat do dalšího pondělí.
//
// Souběh s osobním týdenním check-inem (WeeklyCheckinHost, neděle 19:00):
// když na klienta čeká check-in od trenéra, osobní panel se sám neotevře —
// karta trenéra má přednost a dva dotazníky naráz by klienta zahltily. Osobní
// check-in se ukáže při dalším otevření appky po odeslání toho trenérského
// (platí pro něj stejné „dokud ho nenahradí další týden“), viz pickWeeklyPrompt.
import { addDays, parseWeightKg, pragueParts, pragueWeekStart } from '@/lib/weeklyCheckin';

export type CheckinFieldType = 'weight' | 'number' | 'scale' | 'text' | 'choice' | 'photos';

export interface CheckinField {
  id: string;
  type: CheckinFieldType;
  label: string;
  unit?: string;
  min?: number;
  max?: number;
  min_label?: string;
  max_label?: string;
  options?: string[];
  required?: boolean;
  max_photos?: number;
}

/** Odpověď v rozpracovaném formuláři (z inputů). Fotky se sem nepíšou — jsou v trainer_checkin_photos. */
export type DraftAnswer = string | number | null;
export type DraftAnswers = Record<string, DraftAnswer>;
/** Uložené odpovědi: číslo (weight/number/scale) nebo text (text/choice). */
export type CheckinAnswers = Record<string, number | string>;

export type FieldError = 'required' | 'range' | 'invalid' | 'too_many';

const FIELD_TYPES: CheckinFieldType[] = ['weight', 'number', 'scale', 'text', 'choice', 'photos'];
export const CHECKIN_TEXT_MAX = 2000;
export const DEFAULT_MAX_PHOTOS = 4;
export const PHOTOS_HARD_MAX = 10;
export const SCALE_DEFAULT_MIN = 1;
export const SCALE_DEFAULT_MAX = 5;
/** Víc chipů než tolik se na telefon nevejde — škálu ořízneme. */
export const SCALE_MAX_STEPS = 11;

const finite = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** JSON z DB → bezpečné pole. Neznámé typy a pole bez id se zahodí, duplicitní id taky. */
export function parseFormFields(raw: unknown): CheckinField[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: CheckinField[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const id = str(r.id);
    const type = r.type as CheckinFieldType;
    if (!id || seen.has(id) || !FIELD_TYPES.includes(type)) continue;
    seen.add(id);
    const field: CheckinField = { id, type, label: str(r.label) ?? id, required: r.required === true };
    const unit = str(r.unit); if (unit) field.unit = unit;
    const min = finite(r.min); if (min !== undefined) field.min = min;
    const max = finite(r.max); if (max !== undefined) field.max = max;
    const minLabel = str(r.min_label); if (minLabel) field.min_label = minLabel;
    const maxLabel = str(r.max_label); if (maxLabel) field.max_label = maxLabel;
    if (Array.isArray(r.options)) {
      const opts = r.options.map(str).filter((o): o is string => !!o);
      if (opts.length) field.options = Array.from(new Set(opts));
    }
    const mp = finite(r.max_photos); if (mp !== undefined) field.max_photos = mp;
    if (type === 'choice' && !field.options?.length) continue; // volba bez možností nejde vyplnit
    out.push(field);
  }
  return out;
}

export function scaleRange(field: CheckinField): { min: number; max: number } {
  let min = Math.round(field.min ?? SCALE_DEFAULT_MIN);
  let max = Math.round(field.max ?? SCALE_DEFAULT_MAX);
  if (max < min) [min, max] = [max, min];
  if (max - min + 1 > SCALE_MAX_STEPS) max = min + SCALE_MAX_STEPS - 1;
  return { min, max };
}

export function maxPhotos(field: CheckinField): number {
  const n = Math.round(field.max_photos ?? DEFAULT_MAX_PHOTOS);
  return Math.min(PHOTOS_HARD_MAX, Math.max(1, n));
}

// ───────────────────────── Týden a termín ─────────────────────────

/** Pondělí aktuálního týdne v Praze (= week_start check-inu). */
export const checkinWeekStart = (now: Date): string => pragueWeekStart(now);

const isWeekday = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 7;

export interface TrainerCheckinConfig {
  checkin_form_id?: string | null;
  checkin_weekday?: number | null;
}

/** Má vazba nastavený check-in? (Bez migrace sloupce chybí → false.) */
export const hasCheckinConfigured = (cfg: TrainerCheckinConfig): boolean =>
  !!cfg.checkin_form_id && isWeekday(cfg.checkin_weekday);

/** Datum (YYYY-MM-DD), kdy je check-in tohoto týdne na řadě. */
export function checkinDueDate(now: Date, weekday: number): string {
  return addDays(checkinWeekStart(now), weekday - 1);
}

/**
 * Visí na klientovi check-in? Od dne check-inu (pražský čas) do neděle,
 * pokud pro tento týden ještě žádný neodeslal.
 */
export function isCheckinDue(cfg: TrainerCheckinConfig, now: Date, submittedWeekStarts: string[]): boolean {
  if (!hasCheckinConfigured(cfg)) return false;
  if (pragueParts(now).isoWeekday < (cfg.checkin_weekday as number)) return false;
  return !submittedWeekStarts.includes(checkinWeekStart(now));
}

/** Upravovat jde jen check-in aktuálního týdne (do dalšího pondělí 0:00 Praha). */
export const canEditCheckin = (weekStart: string, now: Date): boolean => weekStart === checkinWeekStart(now);

export type WeeklyPrompt = 'trainer' | 'personal' | null;

/** Který týdenní dotazník ukázat. Check-in od trenéra má přednost (viz hlavička souboru). */
export function pickWeeklyPrompt(input: { trainerCheckinDue: boolean; personalCheckinDue: boolean }): WeeklyPrompt {
  if (input.trainerCheckinDue) return 'trainer';
  return input.personalCheckinDue ? 'personal' : null;
}

// ───────────────────────── Validace a odpovědi ─────────────────────────

const toNumber = (v: DraftAnswer | undefined): number | null => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const t = v.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

const isBlank = (v: DraftAnswer | undefined): boolean =>
  v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

/**
 * Chyby po polích (prázdný objekt = jde odeslat).
 * photoCounts = počet fotek u pole po odeslání (stávající − odebrané + nové).
 */
export function validateAnswers(
  fields: CheckinField[],
  answers: DraftAnswers,
  photoCounts: Record<string, number> = {},
): Record<string, FieldError> {
  const errors: Record<string, FieldError> = {};
  for (const f of fields) {
    const v = answers[f.id];
    if (f.type === 'photos') {
      const n = photoCounts[f.id] ?? 0;
      if (f.required && n === 0) errors[f.id] = 'required';
      else if (n > maxPhotos(f)) errors[f.id] = 'too_many';
      continue;
    }
    if (isBlank(v)) {
      if (f.required) errors[f.id] = 'required';
      continue;
    }
    switch (f.type) {
      case 'weight': {
        const raw = typeof v === 'number' ? String(v) : (v as string);
        if (parseWeightKg(raw) === null) errors[f.id] = 'range';
        break;
      }
      case 'number': {
        const n = toNumber(v);
        if (n === null) errors[f.id] = 'invalid';
        else if ((f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max)) errors[f.id] = 'range';
        break;
      }
      case 'scale': {
        const n = toNumber(v);
        const { min, max } = scaleRange(f);
        if (n === null || !Number.isInteger(n) || n < min || n > max) errors[f.id] = 'invalid';
        break;
      }
      case 'text':
        if (String(v).trim().length > CHECKIN_TEXT_MAX) errors[f.id] = 'too_many';
        break;
      case 'choice':
        if (!f.options?.includes(String(v))) errors[f.id] = 'invalid';
        break;
    }
  }
  return errors;
}

/** Rozpracované odpovědi → JSON do DB (čísla jako čísla, prázdné vynechané, cizí klíče pryč). */
export function normalizeAnswers(fields: CheckinField[], answers: DraftAnswers): CheckinAnswers {
  const out: CheckinAnswers = {};
  for (const f of fields) {
    const v = answers[f.id];
    if (f.type === 'photos' || isBlank(v)) continue;
    if (f.type === 'weight') {
      const kg = parseWeightKg(typeof v === 'number' ? String(v) : (v as string));
      if (kg !== null) out[f.id] = kg;
    } else if (f.type === 'number' || f.type === 'scale') {
      const n = toNumber(v);
      if (n !== null) out[f.id] = n;
    } else {
      out[f.id] = String(v).trim().slice(0, CHECKIN_TEXT_MAX);
    }
  }
  return out;
}

/** Uložené odpovědi → hodnoty pro inputy (váha s desetinnou čárkou). */
export function answersToDraft(fields: CheckinField[], answers: unknown): DraftAnswers {
  const src = answers && typeof answers === 'object' ? (answers as Record<string, unknown>) : {};
  const out: DraftAnswers = {};
  for (const f of fields) {
    const v = src[f.id];
    if (v === undefined || v === null || f.type === 'photos') continue;
    if (f.type === 'weight' || f.type === 'number') out[f.id] = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
    else if (f.type === 'scale') out[f.id] = typeof v === 'number' ? v : toNumber(String(v));
    else out[f.id] = String(v);
  }
  return out;
}

/** Váha z prvního pole typu „weight“ (→ trainer_checkins.weight_kg a body_weight_entries). */
export function extractWeightKg(fields: CheckinField[], answers: CheckinAnswers | DraftAnswers): number | null {
  const field = fields.find((f) => f.type === 'weight');
  if (!field) return null;
  const v = answers[field.id];
  if (v === null || v === undefined) return null;
  return parseWeightKg(typeof v === 'number' ? String(v) : v);
}

// ───────────────────────── Fotky ─────────────────────────

export const CHECKIN_PHOTO_BUCKET = 'checkin-photos';

/**
 * <client_uid>/<checkin_id>/<field_id>-<n>-<ts>.jpg — první složka = uid (storage RLS),
 * druhá = id check-inu (RLS trainer_checkin_photos). Id pole očištěné na bezpečné znaky.
 */
export function checkinPhotoPath(p: { clientUid: string; checkinId: string; fieldId: string; index: number; ts: number }): string {
  const safeField = p.fieldId.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 60) || 'photo';
  return `${p.clientUid}/${p.checkinId}/${safeField}-${p.index}-${p.ts}.jpg`;
}

// ───────────────────────── Koncept (offline) ─────────────────────────

export const checkinDraftKey = (linkId: string, weekStart: string) => `trainer_checkin_draft_${linkId}_${weekStart}`;

/** Koncept z localStorage — jen hodnoty pro známá pole a přípustných typů. */
export function parseDraft(raw: string | null, fields: CheckinField[]): DraftAnswers | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as unknown;
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
    const out: DraftAnswers = {};
    for (const f of fields) {
      const v = (obj as Record<string, unknown>)[f.id];
      if (typeof v === 'string' || typeof v === 'number') out[f.id] = v;
    }
    return out;
  } catch {
    return null;
  }
}
