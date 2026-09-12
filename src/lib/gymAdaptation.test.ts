import { describe, expect, it, vi } from 'vitest';

// Produkční závislosti (supabase) se v testech nepoužívají — injektujeme vlastní deps
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/lib/offlineCache', () => ({ fetchWithCache: async () => ({ data: null, source: 'none' }), SHARED_SCOPE: 'shared' }));
vi.mock('@/lib/exerciseSwap', () => ({
  fetchGymBoundAlternatives: async () => [],
  muscleOverlap: (a: string[], b: string[]) => a.filter(m => b.includes(m)).length,
}));

import { adaptExercisesToGym, pickBestAlternative, type AdaptDeps, type ExerciseMeta } from './gymAdaptation';
import type { WorkoutExercise } from './trainingGoals';


const ex = (id: string, name: string, extra: Partial<WorkoutExercise> = {}): WorkoutExercise => ({
  id: `slot-${id}`, dayLetter: 'A', slotOrder: 1, roleId: 'hinge', exerciseId: id, exerciseName: name,
  sets: 3, repMin: 8, repMax: 12, isFallback: false, fallbackReason: null, ...extra,
});

const META: Record<string, ExerciseMeta> = {
  booty:   { id: 'booty',   name: 'Hip thrust Booty Builder', machine_id: 'm-booty', category: 'strength', primary_role: 'hinge', primary_muscles: ['glutes', 'hamstrings'] },
  bench:   { id: 'bench',   name: 'Bench press',              machine_id: 'm-bench', category: 'strength', primary_role: 'horizontal_push', primary_muscles: ['chest'] },
  pushup:  { id: 'pushup',  name: 'Klik',                      machine_id: null,      category: 'strength', primary_role: 'horizontal_push', primary_muscles: ['chest'] },
  bridge:  { id: 'bridge',  name: 'Hip thrust s osou',         machine_id: 'm-bar',   category: 'strength', primary_role: 'hinge', primary_muscles: ['glutes', 'hamstrings'] },
  rdl:     { id: 'rdl',     name: 'Rumunský mrtvý tah',        machine_id: 'm-bar',   category: 'strength', primary_role: 'hinge', primary_muscles: ['hamstrings', 'back'] },
};

const deps = (gymMachines: string[] | null, alternatives: Record<string, string[]> = {}): AdaptDeps & { calls: string[] } => {
  const calls: string[] = [];
  return {
    calls,
    getGymMachineIds: async () => (gymMachines ? new Set(gymMachines) : null),
    getExerciseMeta: async (id) => META[id] ?? null,
    getAlternatives: async ({ baseExerciseId, excludeIds }) => {
      calls.push(`alt:${baseExerciseId}`);
      return (alternatives[baseExerciseId] ?? []).filter(id => !excludeIds.includes(id)).map(id => ({ id, name: META[id].name, name_en: null, machine_id: META[id].machine_id, video_path: null }));
    },
    getMachineName: async (id) => ({ name: `Stroj ${id}`, name_en: null }),
  };
};

describe('přizpůsobení posilovně', () => {
  it('cviky na dostupných strojích a cviky bez stroje zůstanou beze změny', async () => {
    const d = deps(['m-bench']);
    const r = await adaptExercisesToGym([ex('bench', 'Bench press'), ex('pushup', 'Klik')], 'gym-2', d);
    expect(r.skipped).toBe(false);
    expect(r.swapped).toEqual([]);
    expect(r.exercises.map(e => e.exerciseId)).toEqual(['bench', 'pushup']);
    expect(d.calls).toEqual([]);
  });

  it('cvik na chybějícím stroji (Booty Builder) se nahradí alternativou s největším překryvem svalů, série a opakování zůstanou', async () => {
    const d = deps(['m-bar'], { booty: ['rdl', 'bridge'] });
    const r = await adaptExercisesToGym([ex('booty', 'Hip thrust Booty Builder', { sets: 4, repMin: 10, repMax: 15 })], 'nextgen', d);
    expect(r.swapped).toEqual([{ from: 'Hip thrust Booty Builder', to: 'Hip thrust s osou' }]);
    const e = r.exercises[0];
    expect(e.exerciseId).toBe('bridge');
    expect(e.machineName).toBe('Stroj m-bar');
    expect([e.sets, e.repMin, e.repMax]).toEqual([4, 10, 15]);
    expect(e.isFallback).toBe(true);
    expect(e.fallbackReason).toBe('gym_adapt:Hip thrust Booty Builder');
  });

  it('bez náhrady se cvik z dnešního tréninku vynechá a nahlásí', async () => {
    const d = deps(['m-bar'], { booty: [] });
    const r = await adaptExercisesToGym([ex('pushup', 'Klik'), ex('booty', 'Hip thrust Booty Builder')], 'nextgen', d);
    expect(r.unresolved).toEqual(['Hip thrust Booty Builder']);
    expect(r.exercises.map(e => e.exerciseId)).toEqual(['pushup']);
  });

  it('INVARIANT: výsledek obsahuje jen cviky bez stroje nebo na stroji, který posilovna má', async () => {
    const gym = ['m-bar'];
    const d = deps(gym, { booty: ['bridge'], bench: [] });
    const r = await adaptExercisesToGym([ex('booty', 'Booty'), ex('bench', 'Bench press'), ex('pushup', 'Klik'), ex('rdl', 'RDL')], 'nextgen', d);
    for (const e of r.exercises) {
      const m = META[e.exerciseId!].machine_id;
      expect(m === null || gym.includes(m)).toBe(true);
    }
    expect(r.exercises.map(e => e.exerciseId)).toEqual(['bridge', 'pushup', 'rdl']);
  });

  it('náhrada nikdy nezdvojí cvik, který už v tréninku je', async () => {
    const d = deps(['m-bar'], { booty: ['bridge', 'rdl'] });
    const r = await adaptExercisesToGym([ex('bridge', 'Hip thrust s osou'), ex('booty', 'Hip thrust Booty Builder')], 'nextgen', d);
    expect(r.exercises.map(e => e.exerciseId)).toEqual(['bridge', 'rdl']);
  });

  it('offline bez uložených strojů posilovny se nic nemění a výsledek je označen jako přeskočený', async () => {
    const d = deps(null, { booty: ['bridge'] });
    const list = [ex('booty', 'Hip thrust Booty Builder')];
    const r = await adaptExercisesToGym(list, 'nextgen', d);
    expect(r.skipped).toBe(true);
    expect(r.exercises).toBe(list);
  });

  it('pickBestAlternative: při shodě překryvu vyhraje první kandidát', () => {
    const best = pickBestAlternative(
      [{ id: 'a', name: 'A', name_en: null, machine_id: null, video_path: null }, { id: 'b', name: 'B', name_en: null, machine_id: null, video_path: null }],
      ['glutes'], id => (id === 'a' ? ['glutes'] : ['glutes']),
    );
    expect(best?.id).toBe('a');
    expect(pickBestAlternative([], ['glutes'], () => [])).toBeNull();
  });
});
