import { supabase } from '@/integrations/supabase/client';

// A slot alternative offered by the swap button / hold-to-pick sheet. Shared by
// the generated workout player, the custom-plan builder and custom playback.
export interface SwapCandidate {
  id: string;
  name: string;
  name_en: string | null;
  machine_id: string | null;
  video_path: string | null;
}

// Count of shared muscles between two lists (same scoring as gymEquipmentCheck).
export function muscleOverlap(a: string[], b: string[]): number {
  return a.filter(m => b.includes(m)).length;
}

/**
 * Gym-bound alternatives for a slot: same role (or any cardio), available at the
 * selected gym, excluding exercises already in the session. This is the exact
 * filtering the generated workout player uses, extracted so custom playback can
 * reuse it. Exercises without a machine are always considered available.
 */
export async function fetchGymBoundAlternatives(opts: {
  primaryRole: string | null;
  isCardio: boolean;
  excludeIds: string[];
  gymId: string;
}): Promise<SwapCandidate[]> {
  const { primaryRole, isCardio, excludeIds, gymId } = opts;
  if (!isCardio && !primaryRole) return [];

  const { data: gymMachines } = await supabase
    .from('gym_machines')
    .select('machine_id')
    .eq('gym_id', gymId);
  const machineIds = new Set((gymMachines || []).map(m => m.machine_id));

  let query = supabase
    .from('exercises')
    .select('id, name, name_en, primary_role, machine_id, category, video_path')
    .eq('allowed_phase', 'main');
  query = isCardio ? query.eq('category', 'cardio') : query.eq('primary_role', primaryRole!);

  const { data: candidates, error } = await query;
  if (error || !candidates) return [];

  return candidates.filter(c => {
    if (excludeIds.includes(c.id)) return false;
    if (c.machine_id && !machineIds.has(c.machine_id)) return false;
    return true;
  }).map(c => ({
    id: c.id,
    name: c.name,
    name_en: (c as { name_en?: string | null }).name_en ?? null,
    machine_id: c.machine_id,
    video_path: c.video_path,
  }));
}

/**
 * Catalog-wide alternatives for the custom-plan BUILDER (not gym-bound): same
 * primary_role, or — when the exercise has no role — any exercise sharing a
 * primary muscle. Ranked by muscle overlap (desc), then name, so the closest
 * matches surface first.
 */
export async function fetchCatalogAlternatives(
  exerciseId: string,
  excludeIds: string[] = [],
): Promise<SwapCandidate[]> {
  const { data: base } = await supabase
    .from('exercises')
    .select('primary_role, primary_muscles')
    .eq('id', exerciseId)
    .single();
  if (!base) return [];

  const role = (base as { primary_role: string | null }).primary_role;
  const muscles = ((base as { primary_muscles: string[] | null }).primary_muscles) || [];

  type Row = { id: string; name: string; name_en: string | null; machine_id: string | null; video_path: string | null; primary_muscles: string[] | null };
  let candidates: Row[] = [];

  if (role) {
    const { data } = await supabase
      .from('exercises')
      .select('id, name, name_en, machine_id, video_path, primary_muscles')
      .eq('primary_role', role);
    candidates = (data as Row[] | null) || [];
  }

  // Fallback: no role, or role produced nothing → any overlapping primary muscle.
  if (candidates.length === 0 && muscles.length > 0) {
    const { data } = await supabase
      .from('exercises')
      .select('id, name, name_en, machine_id, video_path, primary_muscles');
    candidates = ((data as Row[] | null) || []).filter(c => muscleOverlap(c.primary_muscles || [], muscles) > 0);
  }

  return candidates
    .filter(c => c.id !== exerciseId && !excludeIds.includes(c.id))
    .map(c => ({ row: c, overlap: muscleOverlap(c.primary_muscles || [], muscles) }))
    .sort((a, b) => b.overlap - a.overlap || a.row.name.localeCompare(b.row.name, 'cs'))
    .map(({ row }) => ({
      id: row.id,
      name: row.name,
      name_en: row.name_en ?? null,
      machine_id: row.machine_id,
      video_path: row.video_path,
    }));
}
