import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface StationExercise {
  id: string;
  name: string;
  name_en: string | null;
  video_path: string | null;
  description: string | null;
  description_en: string | null;
  setup_instructions: string | null;
  setup_instructions_en: string | null;
  common_mistakes: string | null;
  common_mistakes_en: string | null;
  tips: string | null;
  tips_en: string | null;
  primary_muscles: string[];
  secondary_muscles: string[];
  primary_muscles_en: string[];
  secondary_muscles_en: string[];
  difficulty: number | null;
  category: string | null;
  equipment_type: string | null;
}

interface StationData {
  machineName: string;
  machineName_en: string | null;
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .select('machine_id, gym_id, machines(name, name_en, description)' as any)
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
        .select('id, name, name_en, video_path, description, description_en, setup_instructions, setup_instructions_en, common_mistakes, common_mistakes_en, tips, tips_en, primary_muscles, secondary_muscles, primary_muscles_en, secondary_muscles_en, difficulty, category, equipment_type')
        .eq('machine_id', gymMachine.machine_id);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const machine = gymMachine.machines as { name: string; name_en: string | null; description: string | null } | null;

      setData({
        machineName: machine?.name || 'Cvičiště',
        machineName_en: (machine as any)?.name_en || null,
        machineDescription: machine?.description || null,
        gymName: gym?.name || '',
        gymId: gymMachine.gym_id,
        gymIsVerified: Boolean(gym?.is_verified),
        exercises: (exercises || []).map(e => ({
          ...e,
          name_en: e.name_en ?? null,
          description_en: e.description_en ?? null,
          setup_instructions_en: e.setup_instructions_en ?? null,
          common_mistakes_en: (e as any).common_mistakes_en ?? null,
          tips_en: e.tips_en ?? null,
          primary_muscles: e.primary_muscles || [],
          secondary_muscles: e.secondary_muscles || [],
          primary_muscles_en: e.primary_muscles_en || [],
          secondary_muscles_en: e.secondary_muscles_en || [],
        })),
      });
      setIsLoading(false);
    };

    fetchData();
  }, [shortCode]);

  return { data, isLoading, error };
};
