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
  const [gym, setGym] = useState<Gym | null>(null);
  const [gymMachines, setGymMachines] = useState<GymMachine[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchGym = async () => {
    if (!user) {
      setGym(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase
      .from('gyms')
      .select('*')
      .eq('owner_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching gym:', error);
      toast.error('Nepodarilo sa načítať posilňovňu');
    } else {
      setGym(data as Gym | null);
    }
    setIsLoading(false);
  };

  const fetchGymMachines = async () => {
    if (!gym) {
      setGymMachines([]);
      return;
    }

    const { data, error } = await supabase
      .from('gym_machines')
      .select(`
        *,
        machine:machines(id, name, description, target_muscles, image_url, equipment_type)
      `)
      .eq('gym_id', gym.id);

    if (error) {
      console.error('Error fetching gym machines:', error);
    } else {
      setGymMachines(data as GymMachine[]);
    }
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

    setGym(data as Gym);
    toast.success('Posilňovňa bola vytvorená');
    return { success: true };
  };

  const updateGym = async (updates: Partial<Gym>) => {
    if (!gym) return { success: false, error: 'Posilňovňa neexistuje' };

    const { data, error } = await supabase
      .from('gyms')
      .update(updates)
      .eq('id', gym.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating gym:', error);
      return { success: false, error: error.message };
    }

    setGym(data as Gym);
    toast.success('Posilňovňa bola aktualizovaná');
    return { success: true };
  };

  const togglePublish = async () => {
    if (!gym) return;
    
    const { error } = await supabase
      .from('gyms')
      .update({ is_published: !gym.is_published })
      .eq('id', gym.id);

    if (error) {
      toast.error('Nepodarilo sa zmeniť stav publikovania');
    } else {
      setGym({ ...gym, is_published: !gym.is_published });
      toast.success(gym.is_published ? 'Posilňovňa je teraz súkromná' : 'Posilňovňa bola zverejnená');
    }
  };

  const addMachine = async (machineId: string, quantity: number, maxWeight?: number) => {
    if (!gym) return { success: false, error: 'Posilňovňa neexistuje' };

    const { error } = await supabase
      .from('gym_machines')
      .insert({
        gym_id: gym.id,
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
    fetchGym();
  }, [user]);

  useEffect(() => {
    if (gym) {
      fetchGymMachines();
    }
  }, [gym?.id]);

  return {
    gym,
    gymMachines,
    isLoading,
    createGym,
    updateGym,
    togglePublish,
    addMachine,
    updateMachine,
    removeMachine,
    refetch: fetchGym,
  };
};
