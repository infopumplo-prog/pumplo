import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Users, Calendar, TrendingUp, Clock, AlertCircle, UserX, Trophy, ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useGym } from '@/contexts/GymContext';
import BusinessLayout from './BusinessLayout';

interface GymStatsData {
  totalMembers: number;
  todayWorkouts: number;
  weeklyWorkouts: number;
  avgDurationMinutes: number;
  missedWorkoutsToday: MissedUser[];
  topUsers: TopUser[];
}

interface MissedUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  expectedDay: string;
}

interface TopUser {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  workoutCount: number;
}

const DAY_NAMES_CZ: Record<string, string> = {
  monday: 'Pondělí',
  tuesday: 'Úterý',
  wednesday: 'Středa',
  thursday: 'Čtvrtek',
  friday: 'Pátek',
  saturday: 'Sobota',
  sunday: 'Neděle'
};

const GymStats = () => {
  const { gyms, gym, selectGym, isLoading: gymsLoading } = useGym();
  const [stats, setStats] = useState<GymStatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Get today's weekday
  const todayWeekday = useMemo(() => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[new Date().getDay()];
  }, []);

  useEffect(() => {
    if (!gym?.id) {
      setIsLoading(false);
      return;
    }

    const fetchStats = async () => {
      setIsLoading(true);

      try {
        const gymId = gym.id;
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

        // 1. Total members (users with this gym selected)
        const { count: memberCount } = await supabase
          .from('user_profiles')
          .select('*', { count: 'exact', head: true })
          .eq('selected_gym_id', gymId);

        // 2. Today's workouts
        const { count: todayCount } = await supabase
          .from('workout_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('gym_id', gymId)
          .gte('started_at', todayStart);

        // 3. Weekly workouts
        const { count: weeklyCount } = await supabase
          .from('workout_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('gym_id', gymId)
          .gte('started_at', weekAgo);

        // 4. Average duration
        const { data: durationData } = await supabase
          .from('workout_sessions')
          .select('duration_seconds')
          .eq('gym_id', gymId)
          .not('duration_seconds', 'is', null)
          .gte('started_at', weekAgo);

        const avgDuration = durationData && durationData.length > 0
          ? durationData.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / durationData.length / 60
          : 0;

        // 5. Missed workouts today - users who have this gym selected, 
        // have today in their training_days, but no session today
        const { data: membersWithSchedule } = await supabase
          .from('user_profiles')
          .select('user_id, first_name, last_name, training_days')
          .eq('selected_gym_id', gymId)
          .contains('training_days', [todayWeekday]);

        // Get users who already worked out today at this gym
        const { data: todaySessions } = await supabase
          .from('workout_sessions')
          .select('user_id')
          .eq('gym_id', gymId)
          .gte('started_at', todayStart);

        const todayUserIds = new Set(todaySessions?.map(s => s.user_id) || []);
        
        const missedUsers: MissedUser[] = (membersWithSchedule || [])
          .filter(m => !todayUserIds.has(m.user_id))
          .map(m => ({
            id: m.user_id,
            firstName: m.first_name,
            lastName: m.last_name,
            expectedDay: todayWeekday
          }));

        // 6. Top users (by workout count at this gym)
        const { data: topUserData } = await supabase
          .from('workout_sessions')
          .select('user_id')
          .eq('gym_id', gymId)
          .not('completed_at', 'is', null);

        // Count workouts per user
        const userWorkoutCounts: Record<string, number> = {};
        topUserData?.forEach(session => {
          userWorkoutCounts[session.user_id] = (userWorkoutCounts[session.user_id] || 0) + 1;
        });

        // Get top 5 users
        const topUserIds = Object.entries(userWorkoutCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([userId]) => userId);

        // Fetch user details for top users
        let topUsers: TopUser[] = [];
        if (topUserIds.length > 0) {
          const { data: userDetails } = await supabase
            .from('user_profiles')
            .select('user_id, first_name, last_name')
            .in('user_id', topUserIds);

          topUsers = topUserIds.map(userId => {
            const user = userDetails?.find(u => u.user_id === userId);
            return {
              userId,
              firstName: user?.first_name || null,
              lastName: user?.last_name || null,
              workoutCount: userWorkoutCounts[userId]
            };
          });
        }

        setStats({
          totalMembers: memberCount || 0,
          todayWorkouts: todayCount || 0,
          weeklyWorkouts: weeklyCount || 0,
          avgDurationMinutes: Math.round(avgDuration),
          missedWorkoutsToday: missedUsers,
          topUsers
        });
      } catch (err) {
        console.error('Error fetching gym stats:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [gym?.id, todayWeekday]);

  if (gymsLoading) {
    return (
      <BusinessLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        </div>
      </BusinessLayout>
    );
  }

  return (
    <BusinessLayout>
      <div className="space-y-6">
        {/* Header with gym selector */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">Statistiky</h1>
          
          {gyms.length > 1 && (
            <Select value={gym?.id || ''} onValueChange={(id) => {
              const selected = gyms.find(g => g.id === id);
              if (selected) selectGym(selected);
            }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Vyber posilovnu" />
              </SelectTrigger>
              <SelectContent>
                {gyms.map(g => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {!gym ? (
          <Card className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nejdříve vytvoř posilovnu pro zobrazení statistik</p>
          </Card>
        ) : isLoading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
            <Skeleton className="h-64" />
          </div>
        ) : stats && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Stat Cards */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                </div>
                <p className="text-2xl font-bold">{stats.totalMembers}</p>
                <p className="text-sm text-muted-foreground">aktivních členů</p>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-chart-2/10 rounded-xl flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-chart-2" />
                  </div>
                </div>
                <p className="text-2xl font-bold">{stats.todayWorkouts}</p>
                <p className="text-sm text-muted-foreground">tréninků dnes</p>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-chart-4/10 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-chart-4" />
                  </div>
                </div>
                <p className="text-2xl font-bold">{stats.weeklyWorkouts}</p>
                <p className="text-sm text-muted-foreground">za posledních 7 dní</p>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-chart-3/10 rounded-xl flex items-center justify-center">
                    <Clock className="w-5 h-5 text-chart-3" />
                  </div>
                </div>
                <p className="text-2xl font-bold">{stats.avgDurationMinutes} min</p>
                <p className="text-sm text-muted-foreground">průměrný trénink</p>
              </Card>
            </div>

            {/* Missed Workouts Today */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <UserX className="w-5 h-5 text-destructive" />
                <h3 className="font-semibold">Zmeškaný trénink dnes</h3>
                <span className="ml-auto text-sm text-muted-foreground">
                  {DAY_NAMES_CZ[todayWeekday]}
                </span>
              </div>
              
              {stats.missedWorkoutsToday.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Všichni naplánovaní uživatelé už dnes cvičili! 🎉
                </p>
              ) : (
                <div className="space-y-2">
                  {stats.missedWorkoutsToday.slice(0, 5).map(user => (
                    <div key={user.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                      <div className="w-8 h-8 bg-destructive/10 rounded-full flex items-center justify-center">
                        <UserX className="w-4 h-4 text-destructive" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {user.firstName || 'Neznámý'} {user.lastName || ''}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Měl cvičit v {DAY_NAMES_CZ[user.expectedDay]}
                        </p>
                      </div>
                    </div>
                  ))}
                  {stats.missedWorkoutsToday.length > 5 && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      a dalších {stats.missedWorkoutsToday.length - 5} uživatelů
                    </p>
                  )}
                </div>
              )}
            </Card>

            {/* Top Users */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5 text-chart-4" />
                <h3 className="font-semibold">Top cvičenci</h3>
              </div>
              
              {stats.topUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Zatím žádné dokončené tréninky
                </p>
              ) : (
                <div className="space-y-2">
                  {stats.topUsers.map((user, index) => (
                    <div key={user.userId} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        index === 0 ? 'bg-chart-4 text-chart-4-foreground' :
                        index === 1 ? 'bg-muted-foreground/20 text-foreground' :
                        index === 2 ? 'bg-chart-1/20 text-chart-1' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {user.firstName || 'Neznámý'} {user.lastName || ''}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-primary">
                        {user.workoutCount} tréninků
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </div>
    </BusinessLayout>
  );
};

export default GymStats;