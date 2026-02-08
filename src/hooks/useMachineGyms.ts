import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MachineGymEntry {
  gym_id: string;
  gym_name: string;
  quantity: number;
  max_weight_kg: number | null;
  bench_configs: string[] | null;
}

export const useMachineGyms = (machineId: string | null) => {
  const [gyms, setGyms] = useState<MachineGymEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchGyms = async () => {
      if (!machineId) {
        setGyms([]);
        return;
      }

      setIsLoading(true);
      const { data, error } = await supabase
        .from('gym_machines')
        .select(`
          gym_id,
          quantity,
          max_weight_kg,
          bench_configs,
          gyms!inner(name)
        `)
        .eq('machine_id', machineId);

      if (error) {
        console.error('Error fetching machine gyms:', error);
        setGyms([]);
      } else {
        const mapped: MachineGymEntry[] = (data || []).map((item: any) => ({
          gym_id: item.gym_id,
          gym_name: item.gyms?.name || 'Unknown',
          quantity: item.quantity,
          max_weight_kg: item.max_weight_kg,
          bench_configs: item.bench_configs,
        }));
        // Sort by gym name
        mapped.sort((a, b) => a.gym_name.localeCompare(b.gym_name));
        setGyms(mapped);
      }
      setIsLoading(false);
    };

    fetchGyms();
  }, [machineId]);

  return { gyms, isLoading };
};
