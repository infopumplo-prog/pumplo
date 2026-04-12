import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface StationExercise {
  id: string;
  name: string;
  video_path: string | null;
  description: string | null;
  setup_instructions: string | null;
  common_mistakes: string | null;
  tips: string | null;
  primary_muscles: string[];
  secondary_muscles: string[];
  difficulty: number | null;
  category: string | null;
  equipment_type: string | null;
}

interface StationData {
  machineName: string;
  machineDescription: string | null;
  gymName: string;
  gymId: string;
  gymIsVerified: boolean;
  exercises: StationExercise[];
}

export const useStationData = (shortCode: string | undefined) => {
  const [data, setData] = useState<StationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shortCode) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      const { data: gymMachine, error: gmError } = await supabase
        .from('gym_machines')
        .select('machine_id, gym_id, machines(name, description)')
        .eq('short_code', shortCode)
        .single();

      if (gmError || !gymMachine) {
        setError('Cvičiště nenalezeno');
        setIsLoading(false);
        return;
      }

      const { data: gym } = await supabase
        .from('gyms')
        .select('name, is_verified')
        .eq('id', gymMachine.gym_id)
        .single();

      const { data: exercises } = await supabase
        .from('exercises')
        .select('id, name, video_path, description, setup_instructions, common_mistakes, tips, primary_muscles, secondary_muscles, difficulty, category, equipment_type')
        .eq('machine_id', gymMachine.machine_id);

      const machine = gymMachine.machines as any;

      setData({
        machineName: machine?.name || 'Cvičiště',
        machineDescription: machine?.description || null,
        gymName: gym?.name || '',
        gymId: gymMachine.gym_id,
        gymIsVerified: Boolean(gym?.is_verified),
        exercises: (exercises || []).map(e => ({
          ...e,
          primary_muscles: e.primary_muscles || [],
          secondary_muscles: e.secondary_muscles || [],
        })),
      });
      setIsLoading(false);
    };

    fetchData();
  }, [shortCode]);

  return { data, isLoading, error };
};
