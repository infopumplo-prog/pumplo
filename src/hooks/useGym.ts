import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface OpeningHours {
  [day: string]: { open: string; close: string; closed: boolean };
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
  created_at: string;
  updated_at: string;
}

export interface GymMachine {
  id: string;
  gym_id: string;
  machine_id: string;
  quantity: number;
  max_weight_kg: number | null;
  machine?: {
    id: string;
    name: string;
    description: string | null;
    target_muscles: string[];
    image_url: string | null;
    equipment_type: string;
  };
}

export const useGym = () => {
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
      const gymList = (data || []).map(g => ({ ...g, opening_hours: g.opening_hours as OpeningHours })) as Gym[];
      setGyms(gymList);
      // Auto-select first gym if none selected
      if (gymList.length > 0 && !selectedGym) {
        setSelectedGym(gymList[0]);
      }
    }
    setIsLoading(false);
  };

  const selectGym = (gym: Gym) => {
    setSelectedGym(gym);
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
        machine:machines(id, name, description, target_muscles, image_url, equipment_type)
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

    const newGym = { ...data, opening_hours: data.opening_hours as OpeningHours } as Gym;
    setGyms(prev => [...prev, newGym]);
    setSelectedGym(newGym);
    toast.success('Posilovna byla vytvořena');
    return { success: true };
  };

  const updateGym = async (updates: Partial<Gym>) => {
    if (!selectedGym) return { success: false, error: 'Posilňovňa neexistuje' };

    const { data, error } = await supabase
      .from('gyms')
      .update(updates)
      .eq('id', selectedGym.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating gym:', error);
      return { success: false, error: error.message };
    }

    const updatedGym = { ...data, opening_hours: data.opening_hours as OpeningHours } as Gym;
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

  const addMachine = async (machineId: string, quantity: number, maxWeight?: number) => {
    if (!selectedGym) return { success: false, error: 'Posilňovňa neexistuje' };

    const { error } = await supabase
      .from('gym_machines')
      .insert({
        gym_id: selectedGym.id,
        machine_id: machineId,
        quantity,
        max_weight_kg: maxWeight || null,
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

  const updateMachine = async (gymMachineId: string, quantity: number, maxWeight?: number) => {
    const { error } = await supabase
      .from('gym_machines')
      .update({
        quantity,
        max_weight_kg: maxWeight || null,
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

  // For backwards compatibility, expose 'gym' as selectedGym
  return {
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
  };
};
