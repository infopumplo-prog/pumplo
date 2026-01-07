import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Gym, OpeningHours } from './useGym';

export const usePublishedGyms = () => {
  const { data: gyms, isLoading, error, refetch } = useQuery({
    queryKey: ['published-gyms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gyms')
        .select('*')
        .eq('is_published', true);

      if (error) throw error;

      return (data || []).map(gym => ({
        ...gym,
        opening_hours: gym.opening_hours as OpeningHours,
      })) as Gym[];
    },
  });

  return { gyms: gyms || [], isLoading, error, refetch };
};
