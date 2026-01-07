import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type AppRole = 'user' | 'business' | 'admin';

export const useUserRole = () => {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRole = async () => {
    if (!user) {
      setRole(null);
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Error fetching role:', error);
      setRole('user'); // Default to user
    } else {
      setRole(data.role as AppRole);
    }
    setIsLoading(false);
  };

  const isAdmin = role === 'admin';
  const isBusiness = role === 'business' || role === 'admin';

  useEffect(() => {
    fetchRole();
  }, [user]);

  return { role, isAdmin, isBusiness, isLoading, refetch: fetchRole };
};
