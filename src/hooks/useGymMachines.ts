import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GymMachine } from './useGym';

export const useGymMachines = (gymId: string | null) => {
  const [machines, setMachines] = useState<GymMachine[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchMachines = async () => {
      if (!gymId) {
        setMachines([]);
        return;
      }

      setIsLoading(true);
      const { data, error } = await supabase
        .from('gym_machines')
        .select(`
          *,
          machine:machines(id, name, description, target_muscles, image_url, equipment_type)
        `)
        .eq('gym_id', gymId);

      if (error) {
        console.error('Error fetching gym machines:', error);
      } else {
        setMachines(data as GymMachine[]);
      }
      setIsLoading(false);
    };

    fetchMachines();
  }, [gymId]);

  return { machines, isLoading };
};
