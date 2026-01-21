import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from './useUserProfile';

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/**
 * Hook for managing workout streaks
 * Streak activates after 3 consecutive training days
 * Streak resets when user misses a scheduled training day
 * Streak persists across plan regenerations
 */
export const useStreak = () => {
  const { user } = useAuth();
  const { profile, updateProfile } = useUserProfile();

  /**
   * Get the weekday string from a Date object
   */
  const getWeekdayFromDate = (date: Date): string => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
  };

  /**
   * Check if a day should have been a training day
   */
  const isTrainingDay = useCallback((dayOfWeek: string, trainingDays: string[]): boolean => {
    return trainingDays.includes(dayOfWeek);
  }, []);

  /**
   * Get consecutive training days count ending at the given date
   */
  const getConsecutiveTrainingDays = useCallback(async (
    trainingDays: string[],
    endDate: Date = new Date()
  ): Promise<number> => {
    if (!user) return 0;

    // Get recent workout sessions (last 30 days)
    const thirtyDaysAgo = new Date(endDate);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: sessions } = await supabase
      .from('workout_sessions')
      .select('started_at, is_bonus')
      .eq('user_id', user.id)
      .not('completed_at', 'is', null)
      .eq('is_bonus', false)
      .gte('started_at', thirtyDaysAgo.toISOString())
      .order('started_at', { ascending: false });

    if (!sessions || sessions.length === 0) return 0;

    // Create a set of dates when user worked out (YYYY-MM-DD format)
    const workoutDates = new Set<string>();
    sessions.forEach(s => {
      const date = new Date(s.started_at);
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      workoutDates.add(dateKey);
    });

    // Count consecutive training days backward from today
    let consecutiveDays = 0;
    let checkDate = new Date(endDate);
    
    // Start from today and go backward
    while (true) {
      const dateKey = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
      const dayOfWeek = getWeekdayFromDate(checkDate);
      
      const wasTrainingDay = isTrainingDay(dayOfWeek, trainingDays);
      const didWorkout = workoutDates.has(dateKey);
      
      if (wasTrainingDay) {
        if (didWorkout) {
          consecutiveDays++;
        } else {
          // Missed a training day - streak broken
          break;
        }
      }
      // Non-training days don't affect streak
      
      // Move to previous day
      checkDate.setDate(checkDate.getDate() - 1);
      
      // Don't go back more than 30 days
      if (checkDate < thirtyDaysAgo) break;
    }

    return consecutiveDays;
  }, [user, isTrainingDay]);

  /**
   * Update streak after completing a workout
   * Called from WorkoutSession when workout is completed
   */
  const updateStreakOnWorkoutComplete = useCallback(async (): Promise<{
    newStreak: number;
    isNewRecord: boolean;
    justActivated: boolean;
  }> => {
    if (!user || !profile?.training_days) {
      return { newStreak: 0, isNewRecord: false, justActivated: false };
    }

    const consecutiveDays = await getConsecutiveTrainingDays(profile.training_days);
    
    // Streak activates after 3 consecutive days
    const newStreak = consecutiveDays >= 3 ? consecutiveDays : 0;
    const previousStreak = profile.current_streak || 0;
    const maxStreak = Math.max(profile.max_streak || 0, newStreak);
    const isNewRecord = newStreak > (profile.max_streak || 0);
    const justActivated = previousStreak < 3 && newStreak >= 3;

    await supabase
      .from('user_profiles')
      .update({
        current_streak: newStreak,
        max_streak: maxStreak,
        streak_updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id);

    return { newStreak, isNewRecord, justActivated };
  }, [user, profile, getConsecutiveTrainingDays]);

  /**
   * Check if streak should be reset (called on app load or page visit)
   * Resets streak if user missed a training day since last update
   */
  const checkAndResetStreakIfNeeded = useCallback(async (): Promise<boolean> => {
    if (!user || !profile?.training_days || !profile.current_streak) {
      return false;
    }

    const consecutiveDays = await getConsecutiveTrainingDays(profile.training_days);
    const shouldReset = consecutiveDays < 3 && profile.current_streak > 0;

    if (shouldReset) {
      await supabase
        .from('user_profiles')
        .update({
          current_streak: 0,
          streak_updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);
      return true;
    }

    return false;
  }, [user, profile, getConsecutiveTrainingDays]);

  return {
    currentStreak: profile?.current_streak || 0,
    maxStreak: profile?.max_streak || 0,
    isStreakActive: (profile?.current_streak || 0) >= 3,
    updateStreakOnWorkoutComplete,
    checkAndResetStreakIfNeeded,
    getConsecutiveTrainingDays
  };
};
