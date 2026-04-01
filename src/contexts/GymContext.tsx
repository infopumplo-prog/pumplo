import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface OpeningHours {
  [day: string]: { open: string; close: string; closed: boolean };
}

 export interface PriceVariant {
   group: string;
   price: number | null;
 }
 
 export interface PricingItem {
   name: string;
   description?: string;
   prices: PriceVariant[];
 }
 
 export interface GymPricing {
   single_entries: PricingItem[];
   memberships: PricingItem[];
 }
 
export interface Gym {
  id: string;
  owner_id: string;
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
  created_at: string;
  updated_at: string;
}

export interface GymMachine {
  id: string;
  gym_id: string;
  machine_id: string;
  quantity: number;
  max_weight_kg: number | null;
  bench_configs: string[] | null;
  machine?: {
    id: string;
    name: string;
    description: string | null;
    image_url: string | null;
    requires_bench_config?: boolean;
  };
}

interface GymContextType {
  gym: Gym | null;
  gyms: Gym[];
  gymMachines: GymMachine[];
  isLoading: boolean;
  licenseCount: number;
  canCreateMoreGyms: () => boolean;
  selectGym: (gym: Gym) => void;
  createGym: (gymData: {
    name: string;
    description?: string;
    latitude: number;
    longitude: number;
    address?: string;
    opening_hours: OpeningHours;
  }) => Promise<{ success: boolean; error?: string }>;
  updateGym: (updates: Partial<Gym>) => Promise<{ success: boolean; error?: string }>;
  togglePublish: () => Promise<void>;
  addMachine: (machineId: string, quantity: number, maxWeight?: number, benchConfigs?: string[]) => Promise<{ success: boolean; error?: string }>;
  updateMachine: (gymMachineId: string, quantity: number, maxWeight?: number, benchConfigs?: string[]) => Promise<{ success: boolean }>;
  removeMachine: (gymMachineId: string) => Promise<{ success: boolean }>;
  refetch: () => Promise<void>;
}

const GymContext = createContext<GymContextType | undefined>(undefined);

const SELECTED_GYM_KEY = 'pumplo_selected_gym_id';

export const GymProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [selectedGym, setSelectedGym] = useState<Gym | null>(null);
  const [gymMachines, setGymMachines] = useState<GymMachine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [licenseCount, setLicenseCount] = useState(0);

  const fetchGyms = async () => {
    if (!user) {
      setGyms([]);
      setSelectedGym(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    // Fetch user's license count
    const { data: profileData } = await supabase
      .from('user_profiles')
      .select('gym_license_count')
      .eq('user_id', user.id)
      .single();
    
    setLicenseCount(profileData?.gym_license_count || 0);

    // Fetch all gyms owned by user
    const { data, error } = await supabase
      .from('gyms')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching gyms:', error);
      toast.error('Nepodařilo se načíst posilovny');
    } else {
       const processedGymList: Gym[] = (data || []).map(g => ({
         ...g,
         opening_hours: g.opening_hours as OpeningHours,
         pricing: g.pricing as unknown as GymPricing | null,
       }));
     setGyms(processedGymList);
      
      // Restore selected gym from localStorage or select first
      const savedGymId = localStorage.getItem(SELECTED_GYM_KEY);
     const savedGym = processedGymList.find(g => g.id === savedGymId);
      
      if (savedGym) {
        setSelectedGym(savedGym);
     } else if (processedGymList.length > 0 && !selectedGym) {
       setSelectedGym(processedGymList[0]);
       localStorage.setItem(SELECTED_GYM_KEY, processedGymList[0].id);
      }
    }
    setIsLoading(false);
  };

  const selectGym = (gym: Gym) => {
    setSelectedGym(gym);
    localStorage.setItem(SELECTED_GYM_KEY, gym.id);
  };

  const fetchGymMachines = async () => {
    if (!selectedGym) {
      setGymMachines([]);
      return;
    }

    const { data, error } = await supabase
      .from('gym_machines')
      .select(`
        *,
        machine:machines(id, name, description, image_url, requires_bench_config)
      `)
      .eq('gym_id', selectedGym.id);

    if (error) {
      console.error('Error fetching gym machines:', error);
    } else {
      setGymMachines(data as GymMachine[]);
    }
  };

  const canCreateMoreGyms = () => {
    return gyms.length < licenseCount;
  };

  const createGym = async (gymData: {
    name: string;
    description?: string;
    latitude: number;
    longitude: number;
    address?: string;
    opening_hours: OpeningHours;
  }) => {
    if (!user) return { success: false, error: 'Nie ste prihlásený' };
    
    if (!canCreateMoreGyms()) {
      return { success: false, error: `Dosiahli ste limit ${licenseCount} posilovní. Kontaktujte podporu pre navýšenie licencie.` };
    }

    const { data, error } = await supabase
      .from('gyms')
      .insert({
        owner_id: user.id,
        ...gymData,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating gym:', error);
      return { success: false, error: error.message };
    }

     const newGym: Gym = {
       ...data,
       opening_hours: data.opening_hours as OpeningHours,
       pricing: data.pricing as unknown as GymPricing | null,
     };
    setGyms(prev => [...prev, newGym]);
    setSelectedGym(newGym);
    localStorage.setItem(SELECTED_GYM_KEY, newGym.id);
    toast.success('Posilovna byla vytvořena');
    return { success: true };
  };

  const updateGym = async (updates: Partial<Gym>) => {
    if (!selectedGym) return { success: false, error: 'Posilňovňa neexistuje' };

     // Build updates object, properly casting types for Supabase
     const dbUpdates: Record<string, unknown> = {};
     for (const [key, value] of Object.entries(updates)) {
       if (key === 'pricing') {
         dbUpdates[key] = value as unknown;
       } else if (key === 'opening_hours') {
         dbUpdates[key] = value as unknown;
       } else {
         dbUpdates[key] = value;
       }
     }
 
     const { data, error } = await supabase
      .from('gyms')
       .update(dbUpdates)
      .eq('id', selectedGym.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating gym:', error);
      return { success: false, error: error.message };
    }

     const updatedGym: Gym = {
       ...data,
       opening_hours: data.opening_hours as OpeningHours,
       pricing: data.pricing as unknown as GymPricing | null,
     };
     setGyms(prev => prev.map(g => g.id === updatedGym.id ? updatedGym : g));
     setSelectedGym(updatedGym);
    toast.success('Posilovna byla aktualizována');
    return { success: true };
  };

  const togglePublish = async () => {
    if (!selectedGym) return;
    
    const { error } = await supabase
      .from('gyms')
      .update({ is_published: !selectedGym.is_published })
      .eq('id', selectedGym.id);

    if (error) {
      toast.error('Nepodařilo se změnit stav zveřejnění');
    } else {
      const updatedGym = { ...selectedGym, is_published: !selectedGym.is_published };
      setGyms(prev => prev.map(g => g.id === updatedGym.id ? updatedGym : g));
      setSelectedGym(updatedGym);
      toast.success(selectedGym.is_published ? 'Posilovna je nyní soukromá' : 'Posilovna byla zveřejněna');
    }
  };

  const addMachine = async (machineId: string, quantity: number, maxWeight?: number, benchConfigs?: string[]) => {
    if (!selectedGym) return { success: false, error: 'Posilňovňa neexistuje' };

    const { error } = await supabase
      .from('gym_machines')
      .insert({
        gym_id: selectedGym.id,
        machine_id: machineId,
        quantity,
        max_weight_kg: maxWeight || null,
        bench_configs: benchConfigs || null,
      });

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'Tento stroj už máte pridaný' };
      }
      return { success: false, error: error.message };
    }

    await fetchGymMachines();
    toast.success('Stroj bol pridaný');
    return { success: true };
  };

  const updateMachine = async (gymMachineId: string, quantity: number, maxWeight?: number, benchConfigs?: string[]) => {
    const { error } = await supabase
      .from('gym_machines')
      .update({
        quantity,
        max_weight_kg: maxWeight || null,
        bench_configs: benchConfigs || null,
      })
      .eq('id', gymMachineId);

    if (error) {
      toast.error('Nepodarilo sa aktualizovať stroj');
      return { success: false };
    }

    await fetchGymMachines();
    toast.success('Stroj bol aktualizovaný');
    return { success: true };
  };

  const removeMachine = async (gymMachineId: string) => {
    const { error } = await supabase
      .from('gym_machines')
      .delete()
      .eq('id', gymMachineId);

    if (error) {
      toast.error('Nepodarilo sa odstrániť stroj');
      return { success: false };
    }

    await fetchGymMachines();
    toast.success('Stroj bol odstránený');
    return { success: true };
  };

  useEffect(() => {
    fetchGyms();
  }, [user]);

  useEffect(() => {
    if (selectedGym) {
      fetchGymMachines();
    }
  }, [selectedGym?.id]);

  return (
    <GymContext.Provider value={{
      gym: selectedGym,
      gyms,
      gymMachines,
      isLoading,
      licenseCount,
      canCreateMoreGyms,
      selectGym,
      createGym,
      updateGym,
      togglePublish,
      addMachine,
      updateMachine,
      removeMachine,
      refetch: fetchGyms,
    }}>
      {children}
    </GymContext.Provider>
  );
};

export const useGym = (): GymContextType => {
  const context = useContext(GymContext);
  if (context === undefined) {
    throw new Error('useGym must be used within a GymProvider');
  }
  return context;
};

// Re-export types for backwards compatibility
export type { OpeningHours as OpeningHoursType, Gym as GymType, GymMachine as GymMachineType };
