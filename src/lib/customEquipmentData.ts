/**
 * Supabase část režimu „bez posilovny" (feedback 13. 10.): načtení strojů a
 * závislosti pro přizpůsobení dnešního tréninku vlastnímu vybavení.
 */
import { supabase } from '@/integrations/supabase/client';
import { fetchWithCache, SHARED_SCOPE } from '@/lib/offlineCache';
import { fetchGymBoundAlternatives, type SwapCandidate } from '@/lib/exerciseSwap';
import { supabaseAdaptDeps, type AdaptDeps } from '@/lib/gymAdaptation';
import { resolveMachineIds, sanitizeCustomEquipment, type MachineRow } from '@/lib/customEquipment';

/** Klíč „posilovny" pro adaptExercisesToGym v režimu vlastního vybavení. */
export const CUSTOM_EQUIPMENT_GYM_KEY = 'custom-equipment';

export async function fetchAllMachines(): Promise<MachineRow[] | null> {
  const { data } = await fetchWithCache<MachineRow[]>(SHARED_SCOPE, 'machines:all', () =>
    supabase.from('machines').select('id, name, equipment_category, is_cardio'),
  );
  return data ?? null;
}

/** Stroje dostupné pro výběr skupin; null = nedostupné (offline bez cache). */
export async function fetchCustomEquipmentMachineIds(selected: string[]): Promise<Set<string> | null> {
  const machines = await fetchAllMachines();
  return machines ? resolveMachineIds(selected, machines) : null;
}

/** AdaptDeps, které místo strojů posilovny použijí vlastní vybavení. */
export function customEquipmentAdaptDeps(selected: string[]): AdaptDeps {
  let cached: Promise<Set<string> | null> | null = null;
  const machineIds = () => (cached ??= fetchCustomEquipmentMachineIds(selected));
  return {
    ...supabaseAdaptDeps,
    getGymMachineIds: () => machineIds(),
    getAlternatives: async (opts) => {
      const ids = await machineIds();
      return fetchGymBoundAlternatives({ ...opts, machineIds: ids ?? new Set() });
    },
  };
}

/**
 * Náhrady pro ruční výměnu cviku: stroje posilovny, když je trénink v posilovně;
 * bez posilovny vlastní vybavení z profilu; bez obojího všechny stroje (nic
 * neskrývat). Dřív se bez posilovny četly stroje pro prázdné gym_id → žádné
 * náhrady (bug 14. 11.).
 */
export async function fetchSlotAlternatives(
  opts: Omit<Parameters<typeof fetchGymBoundAlternatives>[0], 'gymId' | 'machineIds'> & {
    gymId?: string | null;
    customEquipment?: string[] | null;
  },
): Promise<SwapCandidate[]> {
  const { gymId, customEquipment, ...rest } = opts;
  if (gymId) return fetchGymBoundAlternatives({ ...rest, gymId });
  const equipment = sanitizeCustomEquipment(customEquipment);
  const machineIds = equipment.length > 0
    ? await fetchCustomEquipmentMachineIds(equipment)
    : new Set((await fetchAllMachines() ?? []).map(m => m.id));
  return fetchGymBoundAlternatives({ ...rest, gymId: '', machineIds: machineIds ?? new Set() });
}
