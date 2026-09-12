/**
 * Přizpůsobení dnešního tréninku posilovně, kterou si uživatel vybral při startu.
 *
 * Generovaný plán je stavěný na stroje domácí posilovny. Když jde uživatel
 * trénovat jinam (Eurogym → NextGen), cviky na stroji, který tam není (např.
 * Booty Builder), se nahradí alternativou se stejnou rolí dostupnou v dané
 * posilovně; nejlepší je ta s největším překryvem hlavních svalů. Plán v DB se
 * nemění — jde jen o dnešní session. Cvik bez náhrady se z dnešního tréninku
 * vynechá a nahlásí — trénink smí obsahovat jen cviky proveditelné v dané posilovně.
 */
import { supabase } from '@/integrations/supabase/client';
import { fetchWithCache, SHARED_SCOPE } from '@/lib/offlineCache';
import { fetchGymBoundAlternatives, muscleOverlap, type SwapCandidate } from '@/lib/exerciseSwap';
import type { WorkoutExercise } from '@/lib/trainingGoals';

export interface ExerciseMeta {
  id: string;
  name: string;
  name_en?: string | null;
  machine_id: string | null;
  category: string | null;
  primary_role: string | null;
  primary_muscles: string[] | null;
}

export interface AdaptDeps {
  /** Množina strojů posilovny; null = nedostupné (offline bez cache). */
  getGymMachineIds: (gymId: string) => Promise<Set<string> | null>;
  getExerciseMeta: (exerciseId: string) => Promise<ExerciseMeta | null>;
  getAlternatives: (opts: {
    primaryRole: string | null;
    isCardio: boolean;
    excludeIds: string[];
    gymId: string;
    baseExerciseId: string;
  }) => Promise<SwapCandidate[]>;
  getMachineName: (machineId: string) => Promise<{ name: string; name_en: string | null } | null>;
}

export interface AdaptResult {
  exercises: WorkoutExercise[];
  swapped: Array<{ from: string; to: string }>;
  /** Cviky, pro které v posilovně není náhrada — z dnešního tréninku VYNECHANÉ. */
  unresolved: string[];
  /** true = nedalo se rozhodnout (stroje posilovny nedostupné), trénink beze změny */
  skipped: boolean;
}

export const GYM_ADAPT_REASON = 'gym_adapt';

/** Vybere alternativu s největším překryvem hlavních svalů; při shodě první v pořadí. */
export const pickBestAlternative = (
  candidates: SwapCandidate[],
  baseMuscles: string[],
  musclesOf: (id: string) => string[],
): SwapCandidate | null => {
  if (candidates.length === 0) return null;
  let best = candidates[0];
  let bestScore = muscleOverlap(baseMuscles, musclesOf(best.id));
  for (const c of candidates.slice(1)) {
    const s = muscleOverlap(baseMuscles, musclesOf(c.id));
    if (s > bestScore) { best = c; bestScore = s; }
  }
  return best;
};

export const adaptExercisesToGym = async (
  exercises: WorkoutExercise[],
  gymId: string,
  deps: AdaptDeps,
): Promise<AdaptResult> => {
  const machineIds = await deps.getGymMachineIds(gymId);
  if (!machineIds) return { exercises, swapped: [], unresolved: [], skipped: true };

  const metaById = new Map<string, ExerciseMeta>();
  const metaOf = async (id: string) => {
    if (!metaById.has(id)) {
      const m = await deps.getExerciseMeta(id);
      if (m) metaById.set(id, m);
    }
    return metaById.get(id) ?? null;
  };

  const result: WorkoutExercise[] = [];
  const swapped: AdaptResult['swapped'] = [];
  const unresolved: string[] = [];
  const usedIds = exercises.map(e => e.exerciseId).filter((x): x is string => Boolean(x));

  for (const ex of exercises) {
    if (!ex.exerciseId) { result.push(ex); continue; }
    const meta = await metaOf(ex.exerciseId);
    // Bez metadat (offline bez cache) nebo bez stroje → cvik je dostupný všude
    if (!meta || !meta.machine_id || machineIds.has(meta.machine_id)) { result.push(ex); continue; }

    const candidates = await deps.getAlternatives({
      primaryRole: meta.primary_role ?? ex.roleId ?? null,
      isCardio: meta.category === 'cardio',
      excludeIds: usedIds,
      gymId,
      baseExerciseId: ex.exerciseId,
    });
    const candMuscles = new Map<string, string[]>();
    for (const c of candidates) candMuscles.set(c.id, (await metaOf(c.id))?.primary_muscles ?? []);
    const best = pickBestAlternative(candidates, meta.primary_muscles ?? [], id => candMuscles.get(id) ?? []);

    if (!best) {
      // Tvrdé pravidlo: trénink obsahuje JEN cviky proveditelné ve vybrané posilovně.
      // Bez náhrady se cvik pro dnešní session vynechá (a nahlásí).
      unresolved.push(ex.exerciseName || meta.name);
      continue;
    }
    const machine = best.machine_id ? await deps.getMachineName(best.machine_id) : null;
    usedIds.push(best.id);
    swapped.push({ from: ex.exerciseName || meta.name, to: best.name });
    result.push({
      ...ex,
      exerciseId: best.id,
      exerciseName: best.name,
      exerciseNameEn: best.name_en ?? null,
      machineName: machine?.name ?? null,
      machineNameEn: machine?.name_en ?? null,
      isFallback: true,
      fallbackReason: `${GYM_ADAPT_REASON}:${ex.exerciseName || meta.name}`,
    });
  }
  return { exercises: result, swapped, unresolved, skipped: false };
};

/** Produkční závislosti — vše přes offline cache, aby to jelo i bez signálu, když už byla posilovna jednou vybraná online. */
export const supabaseAdaptDeps: AdaptDeps = {
  getGymMachineIds: async (gymId) => {
    const { data } = await fetchWithCache<Array<{ machine_id: string }>>(SHARED_SCOPE, `gymMachines:${gymId}`, () =>
      supabase.from('gym_machines').select('machine_id').eq('gym_id', gymId),
    );
    return data ? new Set(data.map(r => r.machine_id)) : null;
  },
  getExerciseMeta: async (id) => {
    const { data } = await fetchWithCache<ExerciseMeta>(SHARED_SCOPE, `exercise:${id}`, () =>
      supabase.from('exercises').select('*').eq('id', id).single(),
    );
    return data;
  },
  getAlternatives: (opts) => fetchGymBoundAlternatives(opts),
  getMachineName: async (machineId) => {
    const { data } = await fetchWithCache<{ name: string; name_en: string | null }>(SHARED_SCOPE, `machine:${machineId}`, () =>
      supabase.from('machines').select('name, name_en').eq('id', machineId).single(),
    );
    return data;
  },
};
