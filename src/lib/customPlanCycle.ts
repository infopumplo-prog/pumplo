// Vlastní trénink s více dny v kruhu (A → B → C → A …) — feedback 13. 10.
// Čisté funkce bez Supabase, aby šla rotace otestovat; I/O je dole a zvlášť.
import { supabase } from '@/integrations/supabase/client';

export interface CycleDay {
  id: string;
  day_number: number;
  /** Počet cviků; prázdný den se v kruhu přeskakuje (nedá se odcvičit). */
  exerciseCount?: number;
}

export interface LastCompletedDay {
  dayId: string;
  completedAt: string;
}

/** Dny v pořadí kruhu (podle day_number, při shodě stabilně podle vstupu). */
export const sortCycleDays = <T extends CycleDay>(days: T[]): T[] =>
  days
    .map((d, i) => ({ d, i }))
    .sort((a, b) => a.d.day_number - b.d.day_number || a.i - b.i)
    .map(x => x.d);

/** Písmeno dne v kruhu: 0 → A, 1 → B … 25 → Z, 26 → AA. */
export const cycleLetter = (index: number): string => {
  let n = Math.max(0, Math.floor(index));
  let out = '';
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
};

/**
 * Další den kruhu po naposledy odcvičeném dni.
 * - nic odcvičeno / den mezitím smazaný → první hratelný den,
 * - po posledním dni zpět na první (wrap-around),
 * - dny bez cviků se přeskakují; když nejsou žádné hratelné, vrací null.
 */
export const getNextCycleDay = <T extends CycleDay>(
  days: T[],
  lastCompletedDayId: string | null | undefined,
): T | null => {
  const ordered = sortCycleDays(days);
  const playable = (d: T) => d.exerciseCount === undefined || d.exerciseCount > 0;
  if (!ordered.some(playable)) return null;
  const lastIdx = lastCompletedDayId ? ordered.findIndex(d => d.id === lastCompletedDayId) : -1;
  if (lastIdx < 0) return ordered.find(playable) ?? null;
  for (let step = 1; step <= ordered.length; step++) {
    const candidate = ordered[(lastIdx + step) % ordered.length];
    if (playable(candidate)) return candidate;
  }
  return null;
};

/** Novější ze dvou záznamů (DB vs. lokální cache po offline/ před migrací). */
export const pickLatestCompleted = (
  ...records: (LastCompletedDay | null | undefined)[]
): LastCompletedDay | null => {
  let best: LastCompletedDay | null = null;
  for (const r of records) {
    if (!r?.dayId || !r.completedAt) continue;
    if (!best || new Date(r.completedAt).getTime() > new Date(best.completedAt).getTime()) best = r;
  }
  return best;
};

/** Přečíslování po smazání/přesunu: 1..n bez děr a duplicit. Vrací jen změněné. */
export const renumberDays = <T extends CycleDay>(ordered: T[]): { id: string; day_number: number }[] =>
  ordered
    .map((d, i) => ({ id: d.id, day_number: i + 1, prev: d.day_number }))
    .filter(x => x.prev !== x.day_number)
    .map(({ id, day_number }) => ({ id, day_number }));

/** Prohodí den se sousedem (−1 doleva, +1 doprava). Mimo rozsah vrací stejné pořadí. */
export const moveDayInOrder = <T extends CycleDay>(ordered: T[], dayId: string, direction: -1 | 1): T[] => {
  const idx = ordered.findIndex(d => d.id === dayId);
  const target = idx + direction;
  if (idx < 0 || target < 0 || target >= ordered.length) return ordered;
  const next = ordered.slice();
  [next[idx], next[target]] = [next[target], next[idx]];
  return next;
};

// --- Lokální záznam posledního dne -------------------------------------------
// Pojistka: funguje i bez migrace workout_sessions.custom_plan_day_id a offline.
const LOCAL_KEY = 'pumplo_custom_cycle_last';

type LocalMap = Record<string, LastCompletedDay>;

const readLocalMap = (): LocalMap => {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? (parsed as LocalMap) : {};
  } catch {
    return {};
  }
};

export const readLocalLastCompleted = (planId: string): LastCompletedDay | null =>
  readLocalMap()[planId] ?? null;

export const recordLocalCompleted = (planId: string, dayId: string, completedAt: string): void => {
  try {
    const map = readLocalMap();
    map[planId] = { dayId, completedAt };
    localStorage.setItem(LOCAL_KEY, JSON.stringify(map));
  } catch { /* plné úložiště / private mode — DB záznam stačí */ }
};

/**
 * Poslední odcvičený den pro každý plán (planId → záznam). Čte workout_sessions
 * (sloupce z migrace 20261014_custom_plan_cycle); když sloupce ještě nejsou,
 * tiše spadne na lokální záznam.
 */
type SessionCycleRow = { custom_plan_id: string; custom_plan_day_id: string; completed_at: string | null };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const untyped = () => supabase as any;

export const fetchLastCompletedDays = async (
  userId: string,
  planIds: string[],
): Promise<Record<string, LastCompletedDay>> => {
  const result: Record<string, LastCompletedDay> = {};
  if (planIds.length === 0) return result;
  try {
    // Sloupce nejsou ve vygenerovaných typech (migrace 14. 10.) — dotaz bez typů.
    const { data, error } = await untyped()
      .from('workout_sessions')
      .select('custom_plan_id, custom_plan_day_id, completed_at')
      .eq('user_id', userId)
      .in('custom_plan_id', planIds)
      .not('custom_plan_day_id', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(500);
    if (!error && data) {
      for (const row of data as SessionCycleRow[]) {
        if (!row.completed_at || result[row.custom_plan_id]) continue;
        result[row.custom_plan_id] = { dayId: row.custom_plan_day_id, completedAt: row.completed_at };
      }
    }
  } catch { /* fallback níž */ }
  for (const planId of planIds) {
    const best = pickLatestCompleted(result[planId], readLocalLastCompleted(planId));
    if (best) result[planId] = best;
  }
  return result;
};

/** Poslední dokončená session daného vlastního plánu (Home karta, David 17. 10.). */
export interface CustomPlanSessionRow {
  id: string;
  day_letter: string;
  goal_id: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  total_sets: number | null;
  total_reps: number | null;
  total_weight_kg: number | null;
  gym_id: string | null;
  custom_plan_day_id: string | null;
}

export const fetchLastCustomPlanSession = async (userId: string, planId: string): Promise<CustomPlanSessionRow | null> => {
  try {
    const { data, error } = await untyped()
      .from('workout_sessions')
      .select('id, day_letter, goal_id, started_at, completed_at, duration_seconds, total_sets, total_reps, total_weight_kg, gym_id, custom_plan_day_id')
      .eq('user_id', userId)
      .eq('custom_plan_id', planId)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(1);
    if (error || !data?.length) return null;
    return data[0] as CustomPlanSessionRow;
  } catch {
    return null;
  }
};

/** Zapíše k uložené session, který den kterého plánu to byl (best-effort). */
export const tagSessionWithCycleDay = async (sessionId: string, planId: string, dayId: string): Promise<void> => {
  try {
    const { error } = await untyped()
      .from('workout_sessions')
      .update({ custom_plan_id: planId, custom_plan_day_id: dayId })
      .eq('id', sessionId);
    if (error) console.warn('[customCycle] session not tagged — apply migration 20261014_custom_plan_cycle:', error.message);
  } catch (e) {
    console.warn('[customCycle] session tag failed', e);
  }
};

/** „Den 1“ / „Day 2“ = automatický název, ne vlastní (v kruhu se ukáže „Den A“). */
export const isGenericDayName = (name: string | null | undefined): boolean =>
  !name?.trim() || /^(den|day)\s*(\d+|[a-z])$/i.test(name.trim());
