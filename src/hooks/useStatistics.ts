import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from './useUserProfile';

interface WeeklyVolume {
  weekLabel: string;
  totalWeight: number;
  totalDuration: number;
  workoutCount: number;
}

interface SetHistory {
  weight: number;
  reps: number;
  date: string;
  estimated1RM: number;
}

interface PersonalRecord {
  exerciseId: string;
  exerciseName: string;
  maxWeight: number;
  maxWeightReps: number;
  achievedAt: string;
  previousMax: number | null;
  estimated1RM: number;
  bestSets: SetHistory[];
  totalSets: number;
}

interface MuscleDistribution {
  muscle: string;
  sets: number;
}

interface MonthComparison {
  thisMonth: { workouts: number; weight: number; duration: number; sets: number };
  lastMonth: { workouts: number; weight: number; duration: number; sets: number };
}

interface WeekdayActivity {
  day: string;
  short: string;
  trained: boolean;
  planned: boolean;
  missed: boolean;
}

export interface SessionDataPoint {
  date: string;
  label: string;
  weight: number;
  duration: number;
  sets: number;
  workouts: number;
}

export interface Statistics {
  streak: { current: number; max: number };
  thisMonth: { workouts: number; weight: number; duration: number };
  allTime: { workouts: number; weight: number };
  weeklyVolume: WeeklyVolume[];
  sessionTimeline: SessionDataPoint[];
  personalRecords: PersonalRecord[];
  muscleDistribution: MuscleDistribution[];
  monthComparison: MonthComparison;
  weekdayActivity: WeekdayActivity[];
  topExercises: { name: string; sets: number }[];
}

const DAY_NAMES: Record<string, string> = {
  monday: 'Pondělí', tuesday: 'Úterý', wednesday: 'Středa',
  thursday: 'Čtvrtek', friday: 'Pátek', saturday: 'Sobota', sunday: 'Neděle',
};
const DAY_SHORTS: Record<string, string> = {
  monday: 'Po', tuesday: 'Út', wednesday: 'St',
  thursday: 'Čt', friday: 'Pá', saturday: 'So', sunday: 'Ne',
};
const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export const useStatistics = () => {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const [stats, setStats] = useState<Statistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!user) { setIsLoading(false); return; }
    setIsLoading(true);

    try {
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const eightWeeksAgo = new Date(now);
      eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

      // Fetch sessions
      const { data: sessions } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', user.id)
        .not('completed_at', 'is', null)
        .order('started_at', { ascending: false });

      // Fetch sets with exercise info
      const { data: sets } = await supabase
        .from('workout_session_sets')
        .select('*, workout_sessions!inner(user_id, started_at)')
        .eq('workout_sessions.user_id', user.id)
        .eq('completed', true);

      // Fetch exercise details for muscle groups
      const exerciseIds = [...new Set((sets || []).map(s => s.exercise_id).filter(Boolean))];
      let exerciseMap = new Map<string, { name: string; muscles: string[] }>();
      if (exerciseIds.length > 0) {
        const { data: exercises } = await supabase
          .from('exercises')
          .select('id, name, primary_muscles')
          .in('id', exerciseIds);
        (exercises || []).forEach(e => {
          exerciseMap.set(e.id, { name: e.name, muscles: e.primary_muscles || [] });
        });
      }

      const allSessions = sessions || [];
      const allSets = sets || [];

      console.log('[Stats] sessions:', allSessions.length, 'sets:', allSets.length, 'exercises in map:', exerciseMap.size);

      // --- Streak ---
      const streak = {
        current: profile?.current_streak || 0,
        max: profile?.max_streak || 0,
      };

      // --- This month stats ---
      const thisMonthSessions = allSessions.filter(s => new Date(s.started_at) >= thisMonthStart);
      const lastMonthSessions = allSessions.filter(s => {
        const d = new Date(s.started_at);
        return d >= lastMonthStart && d < thisMonthStart;
      });

      const sumSessions = (arr: typeof allSessions) => ({
        workouts: arr.length,
        weight: arr.reduce((a, s) => a + (Number(s.total_weight_kg) || 0), 0),
        duration: Math.round(arr.reduce((a, s) => a + ((s.duration_seconds || 0) / 60), 0)),
        sets: arr.reduce((a, s) => a + (s.total_sets || 0), 0),
      });

      const thisMonthData = sumSessions(thisMonthSessions);
      const lastMonthData = sumSessions(lastMonthSessions);

      // --- All time ---
      const allTime = {
        workouts: allSessions.length,
        weight: allSessions.reduce((a, s) => a + (Number(s.total_weight_kg) || 0), 0),
      };

      // --- Weekly volume (last 8 weeks) ---
      const weeklyVolume: WeeklyVolume[] = [];
      for (let i = 7; i >= 0; i--) {
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - (i * 7) - weekStart.getDay() + 1);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        const weekSessions = allSessions.filter(s => {
          const d = new Date(s.started_at);
          return d >= weekStart && d < weekEnd;
        });

        weeklyVolume.push({
          weekLabel: i === 0 ? 'Teď' : i === 1 ? 'Minulý' : `${i}t`,
          totalWeight: Math.round(weekSessions.reduce((a, s) => a + (Number(s.total_weight_kg) || 0), 0)),
          totalDuration: Math.round(weekSessions.reduce((a, s) => a + ((s.duration_seconds || 0) / 60), 0)),
          workoutCount: weekSessions.length,
        });
      }

      // --- Personal Records ---
      // Epley formula: estimated 1RM = weight × (1 + reps / 30)
      const calc1RM = (w: number, r: number) => r === 1 ? w : Math.round(w * (1 + r / 30));

      interface ExBest {
        maxWeight: number;
        maxWeightReps: number;
        achievedAt: string;
        name: string;
        previousMax: number | null;
        best1RM: number;
        sets: SetHistory[];
        totalSets: number;
      }
      const exerciseBests = new Map<string, ExBest>();

      // Sort sets by date ascending to track progression
      const sortedSets = [...allSets].sort((a, b) =>
        new Date((a.workout_sessions as any)?.started_at || a.created_at).getTime() -
        new Date((b.workout_sessions as any)?.started_at || b.created_at).getTime()
      );

      sortedSets.forEach(set => {
        if (!set.exercise_id || !set.weight_kg || set.weight_kg <= 0) return;
        const exInfo = exerciseMap.get(set.exercise_id);
        const name = exInfo?.name || set.exercise_name || 'Neznámý';
        const date = (set.workout_sessions as any)?.started_at || set.created_at;
        const reps = set.reps || 1;
        const est1RM = calc1RM(set.weight_kg, reps);
        const setEntry: SetHistory = { weight: set.weight_kg, reps, date, estimated1RM: est1RM };

        const existing = exerciseBests.get(set.exercise_id);
        if (!existing) {
          exerciseBests.set(set.exercise_id, {
            maxWeight: set.weight_kg, maxWeightReps: reps, achievedAt: date,
            name, previousMax: null, best1RM: est1RM, sets: [setEntry], totalSets: 1,
          });
        } else {
          existing.totalSets++;
          existing.sets.push(setEntry);
          if (set.weight_kg > existing.maxWeight) {
            existing.previousMax = existing.maxWeight;
            existing.maxWeight = set.weight_kg;
            existing.maxWeightReps = reps;
            existing.achievedAt = date;
          }
          if (est1RM > existing.best1RM) {
            existing.best1RM = est1RM;
          }
        }
      });

      const personalRecords: PersonalRecord[] = Array.from(exerciseBests.entries())
        .map(([id, data]) => {
          // Keep last 10 unique-date sets, sorted newest first
          const bestSets = [...data.sets]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 20);
          return {
            exerciseId: id,
            exerciseName: data.name,
            maxWeight: data.maxWeight,
            maxWeightReps: data.maxWeightReps,
            achievedAt: data.achievedAt,
            previousMax: data.previousMax,
            estimated1RM: data.best1RM,
            bestSets,
            totalSets: data.totalSets,
          };
        })
        .sort((a, b) => b.maxWeight - a.maxWeight);

      // --- Muscle distribution ---
      const muscleMap = new Map<string, number>();
      allSets.forEach(set => {
        if (!set.exercise_id) return;
        const ex = exerciseMap.get(set.exercise_id);
        if (!ex) return;
        ex.muscles.forEach(m => {
          muscleMap.set(m, (muscleMap.get(m) || 0) + 1);
        });
      });

      const muscleDistribution: MuscleDistribution[] = Array.from(muscleMap.entries())
        .map(([muscle, sets]) => ({ muscle, sets }))
        .sort((a, b) => b.sets - a.sets);

      // --- Weekday activity (this week) ---
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);

      const thisWeekSessions = allSessions.filter(s => new Date(s.started_at) >= weekStart);
      const trainedDays = new Set(thisWeekSessions.map(s => {
        const d = new Date(s.started_at);
        return DAY_ORDER[d.getDay() === 0 ? 6 : d.getDay() - 1];
      }));

      const trainingDays = new Set(profile?.training_days || []);

      // Determine today's index in DAY_ORDER (0=monday .. 6=sunday)
      const todayIndex = now.getDay() === 0 ? 6 : now.getDay() - 1;

      // Fetch active plan start date to hide days before plan started
      const { data: activePlan } = await supabase
        .from('user_workout_plans')
        .select('started_at')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      // If plan started this week, days before plan start should be empty (not planned, not missed)
      let planStartDayIndex = -1;
      if (activePlan?.started_at) {
        const planStart = new Date(activePlan.started_at);
        planStart.setHours(0, 0, 0, 0);
        if (planStart >= weekStart) {
          planStartDayIndex = planStart.getDay() === 0 ? 6 : planStart.getDay() - 1;
        }
      }

      const weekdayActivity: WeekdayActivity[] = DAY_ORDER.map((day, i) => {
        const isBeforePlanStart = planStartDayIndex >= 0 && i < planStartDayIndex;
        const isPlanned = trainingDays.has(day) && !isBeforePlanStart;
        const wasTrained = trainedDays.has(day);
        const isPast = i < todayIndex;
        const isToday = i === todayIndex;
        return {
          day: DAY_NAMES[day],
          short: DAY_SHORTS[day],
          trained: wasTrained,
          planned: isPlanned,
          missed: isPlanned && !wasTrained && (isPast || (isToday && !wasTrained)) && allSessions.length > 0,
        };
      });

      // --- Top exercises by sets ---
      const exerciseSetsMap = new Map<string, { name: string; sets: number }>();
      allSets.forEach(set => {
        const name = exerciseMap.get(set.exercise_id || '')?.name || set.exercise_name || 'Neznámý';
        const key = set.exercise_id || set.exercise_name;
        const existing = exerciseSetsMap.get(key);
        if (existing) {
          existing.sets++;
        } else {
          exerciseSetsMap.set(key, { name, sets: 1 });
        }
      });

      const topExercises = Array.from(exerciseSetsMap.values())
        .sort((a, b) => b.sets - a.sets)
        .slice(0, 5);

      // --- Session timeline (each session as a data point, chronological) ---
      const sessionTimeline: SessionDataPoint[] = [...allSessions]
        .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())
        .map(s => {
          const d = new Date(s.started_at);
          const day = d.getDate();
          const month = d.getMonth() + 1;
          return {
            date: s.started_at,
            label: `${day}.${month}.`,
            weight: Math.round(Number(s.total_weight_kg) || 0),
            duration: Math.round((s.duration_seconds || 0) / 60),
            sets: s.total_sets || 0,
            workouts: 1,
          };
        });

      setStats({
        streak,
        thisMonth: { workouts: thisMonthData.workouts, weight: thisMonthData.weight, duration: thisMonthData.duration },
        allTime,
        weeklyVolume,
        sessionTimeline,
        personalRecords,
        muscleDistribution,
        monthComparison: { thisMonth: thisMonthData, lastMonth: lastMonthData },
        weekdayActivity,
        topExercises,
      });
    } catch (err) {
      console.error('Error fetching statistics:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user, profile]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  return { stats, isLoading, refetch: fetchStats };
};
