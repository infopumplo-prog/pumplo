import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';

export interface FeedbackContext {
  // App context
  app_version: string;
  platform: string;
  locale: string;
  timezone: string;
  current_route: string;
  
  // User context
  user_id: string | null;
  
  // Workout context (if available)
  plan_id?: string;
  week_index?: number;
  day_index?: number;
  day_letter?: string;
  gym_id?: string;
}

export const useFeedbackContext = (): FeedbackContext => {
  const location = useLocation();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  
  return {
    // App context
    app_version: '1.0.0',
    platform: 'web',
    locale: navigator.language || 'cs-CZ',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    current_route: location.pathname,
    
    // User context
    user_id: user?.id || null,
    
    // Workout context (from profile if available)
    day_index: profile?.current_day_index ?? undefined,
    gym_id: profile?.selected_gym_id ?? undefined,
  };
};
