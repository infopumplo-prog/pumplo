import { supabase } from '@/integrations/supabase/client';

export interface AlternativeExercise {
  id: string;
  name: string;
  name_en?: string | null;
  primary_muscles: string[];
  equipment_type: string;
  video_path: string | null;
  machine_id: string;
}

export interface IncompatibleExercise {
  exercise_id: string;
  exercise_name: string;
  exercise_name_en?: string | null;
  primary_role: string;
  primary_muscles: string[];
  alternatives: AlternativeExercise[];
}

function muscleOverlap(a: string[], b: string[]): number {
  return a.filter(m => b.includes(m)).length;
}

export async function checkCustomPlanEquipment(
  planId: string,
  gymId: string
): Promise<IncompatibleExercise[]> {
  // 1. Get day IDs for this plan
  const { data: days } = await supabase
    .from('custom_plan_days')
    .select('id')
    .eq('plan_id', planId);

  if (!days || days.length === 0) return [];

  const dayIds = days.map(d => d.id);

  // 2. Get all exercises in the plan with their machine data
  const { data: planExercises } = await supabase
    .from('custom_plan_exercises')
    .select(`
      exercise_id,
      exercises (
        id, name, machine_id, secondary_machine_id,
        primary_role, primary_muscles, equipment_type
      )
    `)
    .in('day_id', dayIds);

  if (!planExercises || planExercises.length === 0) return [];

  // Deduplicate by exercise_id
  const seen = new Set<string>();
  const uniqueExercises = planExercises.filter(pe => {
    if (seen.has(pe.exercise_id)) return false;
    seen.add(pe.exercise_id);
    return true;
  });

  // 3. Get gym's available machine IDs
  const { data: gymMachines } = await supabase
    .from('gym_machines')
    .select('machine_id')
    .eq('gym_id', gymId);

  const gymMachineIds = new Set((gymMachines || []).map(m => m.machine_id));

  // 4. Find exercises whose machine is NOT in the gym
  const incompatible = uniqueExercises.filter(pe => {
    const ex = pe.exercises as any;
    if (!ex || !ex.machine_id) return false;
    const primaryMissing = !gymMachineIds.has(ex.machine_id);
    const secondaryMissing = ex.secondary_machine_id && !gymMachineIds.has(ex.secondary_machine_id);
    return primaryMissing || secondaryMissing;
  });

  if (incompatible.length === 0) return [];

  // 5. For each incompatible exercise, find alternatives
  // Get all exercises that have machines available in this gym
  const { data: allExercises } = await supabase
    .from('exercises')
    .select('id, name, name_en, machine_id, primary_role, primary_muscles, equipment_type, video_path')
    .in('machine_id', Array.from(gymMachineIds));

  const availableExercises = allExercises || [];

  return incompatible.map(pe => {
    const ex = pe.exercises as any;
    const role = ex?.primary_role as string;
    const muscles = (ex?.primary_muscles as string[]) || [];

    // Find alternatives: same primary_role, machine in gym
    const candidates = availableExercises
      .filter(a => a.primary_role === role && a.id !== pe.exercise_id)
      .map(a => ({
        ...a,
        _overlap: muscleOverlap(a.primary_muscles || [], muscles),
      }))
      .sort((a, b) => b._overlap - a._overlap)
      .slice(0, 5)
      .map(({ _overlap, ...a }) => a as AlternativeExercise);

    return {
      exercise_id: pe.exercise_id,
      exercise_name: ex?.name || 'Neznámý cvik',
      exercise_name_en: ex?.name_en || null,
      primary_role: role,
      primary_muscles: muscles,
      alternatives: candidates,
    };
  });
}
