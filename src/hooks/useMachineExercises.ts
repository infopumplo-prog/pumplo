import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MachineExercise {
  id: string;
  name: string;
  equipment_type: string | null;
  machine_id: string | null;
  secondary_machine_id: string | null;
  primary_machine_name: string | null;
  secondary_machine_name: string | null;
  is_primary: boolean; // true if this machine is the primary, false if secondary
}

export const useMachineExercises = (machineId: string | null) => {
  const [exercises, setExercises] = useState<MachineExercise[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchExercises = useCallback(async () => {
    if (!machineId) {
      setExercises([]);
      return;
    }

    setIsLoading(true);

    // Fetch exercises where this machine is primary or secondary
    const { data, error } = await supabase
      .from('exercises')
      .select(`
        id,
        name,
        equipment_type,
        machine_id,
        secondary_machine_id,
        primary_machine:machines!exercises_machine_id_fkey(name),
        secondary_machine:machines!exercises_secondary_machine_id_fkey(name)
      `)
      .or(`machine_id.eq.${machineId},secondary_machine_id.eq.${machineId}`)
      .order('name');

    if (error) {
      console.error('Error fetching machine exercises:', error);
      setExercises([]);
    } else {
      const mapped = (data || []).map((ex: any) => ({
        id: ex.id,
        name: ex.name,
        equipment_type: ex.equipment_type,
        machine_id: ex.machine_id,
        secondary_machine_id: ex.secondary_machine_id,
        primary_machine_name: ex.primary_machine?.name || null,
        secondary_machine_name: ex.secondary_machine?.name || null,
        is_primary: ex.machine_id === machineId,
      }));
      setExercises(mapped);
    }

    setIsLoading(false);
  }, [machineId]);

  useEffect(() => {
    fetchExercises();
  }, [fetchExercises]);

  const updateSecondaryMachine = async (exerciseId: string, newSecondaryMachineId: string | null) => {
    const { error } = await supabase
      .from('exercises')
      .update({ secondary_machine_id: newSecondaryMachineId })
      .eq('id', exerciseId);

    if (error) {
      console.error('Error updating secondary machine:', error);
      return false;
    }

    // Refresh the list
    await fetchExercises();
    return true;
  };

  return {
    exercises,
    isLoading,
    refetch: fetchExercises,
    updateSecondaryMachine,
  };
};
