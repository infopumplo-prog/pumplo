import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UserProfile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  gender: string | null;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  primary_goal: string | null;
  secondary_goals: string[] | null;
  training_days: string[] | null;
  preferred_time: string | null;
  training_duration_minutes: number | null;
  injuries: string[] | null;
  training_split: string | null;
  equipment_preference: string | null;
  motivations: string[] | null;
  onboarding_completed: boolean;
  current_step: number;
  gym_license_count: number;
  user_level: 'beginner' | 'intermediate' | 'advanced' | null;
  selected_gym_id: string | null;
  current_day_index: number;
  // Streak fields
  current_streak: number;
  max_streak: number;
  streak_updated_at: string | null;
  // Notification fields
  notification_morning_reminder: boolean;
  notification_missed_workout: boolean;
  notification_closing_soon: boolean;
  notification_onboarding_shown: boolean;
  push_subscription: Record<string, unknown> | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export const useUserProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async () => {
    if (!user) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      // If no profile exists, create one
      if (error.code === 'PGRST116') {
        const { data: newProfile, error: insertError } = await supabase
          .from('user_profiles')
          .insert({ user_id: user.id })
          .select()
          .single();
        
        if (!insertError && newProfile) {
          setProfile(newProfile as UserProfile);
        }
      }
    } else {
      setProfile(data as UserProfile);
    }
    setIsLoading(false);
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return { success: false };

    const { error } = await supabase
      .from('user_profiles')
      .update(updates as any)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error updating profile:', error);
      return { success: false, error: error.message };
    }

    await fetchProfile();
    return { success: true };
  };

  useEffect(() => {
    fetchProfile();
    
    // Listen for auth state changes to refetch profile
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        // Small delay to ensure trigger has created/updated profile
        setTimeout(() => fetchProfile(), 500);
      }
    });
    
    return () => subscription.unsubscribe();
  }, [user]);

  return { profile, isLoading, updateProfile, refetch: fetchProfile };
};
