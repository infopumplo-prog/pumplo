import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface WorkoutSession {
  id: string;
  day_letter: string;
  goal_id: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  total_sets: number | null;
  total_reps: number | null;
  total_weight_kg: number | null;
  gym_id: string | null;
}

interface DailyStats {
  totalWorkouts: number;
  totalDuration: number; // in minutes
  totalWeight: number; // in kg
  totalSets: number;
  totalReps: number;
}

interface WorkoutStats {
  today: DailyStats;
  thisWeek: DailyStats;
  allTime: DailyStats;
  recentSessions: WorkoutSession[];
  lastDays: { date: string; dayLetter: string; duration: number; completed: boolean }[];
}

const emptyStats: DailyStats = {
  totalWorkouts: 0,
  totalDuration: 0,
  totalWeight: 0,
  totalSets: 0,
  totalReps: 0,
};

export const useWorkoutStats = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<WorkoutStats>({
    today: { ...emptyStats },
    thisWeek: { ...emptyStats },
    allTime: { ...emptyStats },
    recentSessions: [],
    lastDays: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get all workout sessions for this user
      const { data: sessions, error: sessionsError } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false });

      if (sessionsError) throw sessionsError;

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Calculate start of week (Monday)
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);

      const todayStats: DailyStats = { ...emptyStats };
      const weekStats: DailyStats = { ...emptyStats };
      const allTimeStats: DailyStats = { ...emptyStats };

      (sessions || []).forEach(session => {
        const sessionDate = new Date(session.started_at);
        const isToday = sessionDate >= todayStart;
        const isThisWeek = sessionDate >= weekStart;

        const duration = Math.floor((session.duration_seconds || 0) / 60);
        const weight = Number(session.total_weight_kg) || 0;
        const sets = session.total_sets || 0;
        const reps = session.total_reps || 0;

        // All time
        allTimeStats.totalWorkouts++;
        allTimeStats.totalDuration += duration;
        allTimeStats.totalWeight += weight;
        allTimeStats.totalSets += sets;
        allTimeStats.totalReps += reps;

        // This week
        if (isThisWeek) {
          weekStats.totalWorkouts++;
          weekStats.totalDuration += duration;
          weekStats.totalWeight += weight;
          weekStats.totalSets += sets;
          weekStats.totalReps += reps;
        }

        // Today
        if (isToday) {
          todayStats.totalWorkouts++;
          todayStats.totalDuration += duration;
          todayStats.totalWeight += weight;
          todayStats.totalSets += sets;
          todayStats.totalReps += reps;
        }
      });

      // Get last 7 days of sessions for history
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const lastDays = (sessions || [])
        .filter(s => new Date(s.started_at) >= sevenDaysAgo)
        .map(s => ({
          date: s.started_at,
          dayLetter: s.day_letter,
          duration: Math.floor((s.duration_seconds || 0) / 60),
          completed: !!s.completed_at,
        }));

      setStats({
        today: todayStats,
        thisWeek: weekStats,
        allTime: allTimeStats,
        recentSessions: (sessions || []).slice(0, 10) as WorkoutSession[],
        lastDays,
      });
    } catch (err) {
      console.error('Error fetching workout stats:', err);
      setError('Nepodařilo se načíst statistiky');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    isLoading,
    error,
    refetch: fetchStats,
  };
};
