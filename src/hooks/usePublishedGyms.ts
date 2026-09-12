import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchWithCache, SHARED_SCOPE } from '@/lib/offlineCache';
import { prefetchFiles } from '@/lib/videoCache';
import { OpeningHours } from './useGym';
import { GymPricing } from '@/contexts/GymContext';

// Public gym type without owner_id for security
export interface PublicGym {
  id: string;
  name: string;
  description: string | null;
  description_en?: string | null;
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
    // Offline: react-query by dotaz jinak „pozastavil“ a výběr posilovny zůstal prázdný
    networkMode: 'always',
    queryFn: async () => {
      // Use the secure public_gyms view that excludes owner_id.
      // Offline-first: seznam posiloven z cache (sdílený, ne per uživatel).
      const { data, source } = await fetchWithCache<Record<string, unknown>[]>(SHARED_SCOPE, 'publishedGyms', () =>
        supabase.from('public_gyms').select('*'),
      );
      if (!data) throw new Error(source === 'none' ? 'Seznam posiloven není dostupný (offline bez cache)' : 'no data');

      const normalized = (data as unknown as Array<Record<string, unknown>>).map(gym => ({
        ...gym,
        opening_hours: gym.opening_hours as OpeningHours,
        pricing: gym.pricing as unknown as GymPricing | null,
        is_verified: Boolean((gym as { is_verified?: boolean }).is_verified),
      })) as PublicGym[];

      // Loga do telefonu, ať výběr posilovny offline nevypadá rozbitě
      if (source === 'network') void prefetchFiles(normalized.map(g => g.logo_url));
      return normalized.sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  return { gyms: gyms || [], isLoading, error, refetch };
};
