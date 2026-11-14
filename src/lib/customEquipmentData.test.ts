import { beforeEach, describe, expect, it, vi } from 'vitest';

// Výřez reálné tabulky machines (jednoručky, kettlebell, osa, leg press)
const MACHINES = [
  { id: 'db', name: 'Jednoručky', equipment_category: 'free_weight', is_cardio: false },
  { id: 'kb', name: 'Kettlebell', equipment_category: 'free_weight', is_cardio: false },
  { id: 'bar', name: 'Osa', equipment_category: 'free_weight', is_cardio: false },
  { id: 'lp', name: 'Leg press', equipment_category: 'machine', is_cardio: false },
];

const { fetchGymBoundAlternatives } = vi.hoisted(() => ({ fetchGymBoundAlternatives: vi.fn(async (_opts: unknown) => []) }));

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/lib/offlineCache', () => ({
  fetchWithCache: async () => ({ data: MACHINES, source: 'network' }),
  SHARED_SCOPE: 'shared',
}));
vi.mock('@/lib/exerciseSwap', () => ({ fetchGymBoundAlternatives }));
vi.mock('@/lib/gymAdaptation', () => ({ supabaseAdaptDeps: {} }));

import { fetchSlotAlternatives } from './customEquipmentData';

const base = { primaryRole: 'horizontal_pull', isCardio: false, excludeIds: ['row-db'], baseExerciseId: 'row-db' };
const lastCall = () => fetchGymBoundAlternatives.mock.calls.at(-1)?.[0] as { gymId: string; machineIds?: Set<string> };

describe('fetchSlotAlternatives', () => {
  beforeEach(() => fetchGymBoundAlternatives.mockClear());

  it('uses the gym machines when the workout has a gym', async () => {
    await fetchSlotAlternatives({ ...base, gymId: 'eurogym', customEquipment: ['dumbbells'] });
    expect(lastCall().gymId).toBe('eurogym');
    expect(lastCall().machineIds).toBeUndefined();
  });

  // Bug 14. 11.: bez posilovny se četly stroje pro prázdné gym_id → „Žádná náhrada nenalezena"
  it('uses the own equipment when the workout has no gym', async () => {
    await fetchSlotAlternatives({ ...base, gymId: '', customEquipment: ['dumbbells', 'kettlebell'] });
    expect(lastCall().machineIds).toEqual(new Set(['db', 'kb']));
  });

  it('allows every machine when there is neither a gym nor own equipment', async () => {
    await fetchSlotAlternatives({ ...base, gymId: null, customEquipment: null });
    expect(lastCall().machineIds).toEqual(new Set(['db', 'kb', 'bar', 'lp']));
  });
});
