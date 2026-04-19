import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { OpeningHours } from './useGym';
import { GymPricing } from '@/contexts/GymContext';

// Public gym type without owner_id for security
export interface PublicGym {
  id: string;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
  address: string | null;
  is_published: boolean;
  opening_hours: OpeningHours;
  cover_photo_url: string | null;
  logo_url: string | null;
  pricing: GymPricing | null;
  instagram_handle: string | null;
  website: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  services: string[] | null;
  created_at: string;
  updated_at: string;
  /** Gym has been verified by Pumplo team (fulfillment completed). */
  is_verified: boolean;
}

export const usePublishedGyms = () => {
  const { data: gyms, isLoading, error, refetch } = useQuery({
    queryKey: ['published-gyms'],
    queryFn: async () => {
      // Use the secure public_gyms view that excludes owner_id
      const { data, error } = await supabase
        .from('public_gyms')
        .select('*');

      if (error) throw error;

      const normalized = (data || []).map(gym => ({
        ...gym,
        opening_hours: gym.opening_hours as OpeningHours,
        pricing: gym.pricing as unknown as GymPricing | null,
        is_verified: Boolean((gym as { is_verified?: boolean }).is_verified),
      })) as PublicGym[];

      return normalized.sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  return { gyms: gyms || [], isLoading, error, refetch };
};
