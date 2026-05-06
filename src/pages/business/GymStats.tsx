import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Users, Calendar, TrendingUp, Clock, AlertCircle, UserX, Trophy, History, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useGym } from '@/contexts/GymContext';
import BusinessLayout from './BusinessLayout';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { cs } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

interface GymStatsData {
  totalMembers: number;
  todayWorkouts: number;
  weeklyWorkouts: number;
  avgDurationMinutes: number;
  missedWorkoutsToday: MissedUser[];
  topUsers: TopUser[];
  weeklyTrend: WeeklyTrendData[];
  dayDistribution: DayDistributionData[];
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

interface WeeklyTrendData {
  date: string;
  label: string;
  workouts: number;
}

interface DayDistributionData {
  day: string;
  dayKey: string;
  workouts: number;
  fill: string;
}

interface MissedHistoryEntry {
  date: string;
  dateLabel: string;
  users: MissedUser[];
}

const DAY_KEYS_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

const DAY_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--primary))',
  'hsl(var(--accent))',
];

const DAY_NAMES: Record<string, (t: ReturnType<typeof useTranslation>['t']) => string> = {
  monday: (t) => t('admin.day_monday'),
  tuesday: (t) => t('admin.day_tuesday'),
  wednesday: (t) => t('admin.day_wednesday'),
  thursday: (t) => t('admin.day_thursday'),
  friday: (t) => t('admin.day_friday'),
  saturday: (t) => t('admin.day_saturday'),
  sunday: (t) => t('admin.day_sunday'),
};

const DAY_SHORT: Record<string, (t: ReturnType<typeof useTranslation>['t']) => string> = {
  monday: (t) => t('business.day_short_mon'),
  tuesday: (t) => t('business.day_short_tue'),
  wednesday: (t) => t('business.day_short_wed'),
  thursday: (t) => t('business.day_short_thu'),
  friday: (t) => t('business.day_short_fri'),
  saturday: (t) => t('business.day_short_sat'),
  sunday: (t) => t('business.day_short_sun'),
};

const GymStats = () => {
  const { t } = useTranslation();
  const { gyms, gym, selectGym, isLoading: gymsLoading } = useGym();
  const [stats, setStats] = useState<GymStatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [missedHistory, setMissedHistory] = useState<MissedHistoryEntry[]>([]);
  const [showMissedHistory, setShowMissedHistory] = useState(false);
  const [loadingMissedHistory, setLoadingMissedHistory] = useState(false);

  const chartConfig = {
    workouts: {
      label: t('business.chart_workouts'),
      color: 'hsl(var(--primary))',
    },
  };

  const todayWeekday = useMemo(() => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[new Date().getDay()];
  }, []);

  const fetchMissedHistory = async () => {
    if (!gym?.id || loadingMissedHistory) return;

    setLoadingMissedHistory(true);
    try {
      const history: MissedHistoryEntry[] = [];
      const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

      for (let i = 1; i <= 7; i++) {
        const date = subDays(new Date(), i);
        const dayKey = daysOfWeek[date.getDay()];
        const dateStart = startOfDay(date).toISOString();
        const dateEnd = endOfDay(date).toISOString();

        const { data: membersWithSchedule } = await supabase
          .from('user_profiles')
          .select('user_id, first_name, last_name, training_days')
          .eq('selected_gym_id', gym.id)
          .contains('training_days', [dayKey]);

        if (!membersWithSchedule?.length) continue;

        const { data: sessionsOnDay } = await supabase
          .from('workout_sessions')
          .select('user_id')
          .eq('gym_id', gym.id)
          .gte('started_at', dateStart)
          .lte('started_at', dateEnd);

        const workedOutUserIds = new Set(sessionsOnDay?.map(s => s.user_id) || []);

        const missedUsers = membersWithSchedule
          .filter(m => !workedOutUserIds.has(m.user_id))
          .map(m => ({
            id: m.user_id,
            firstName: m.first_name,
            lastName: m.last_name,
            expectedDay: dayKey
          }));

        if (missedUsers.length > 0) {
          history.push({
            date: date.toISOString(),
            dateLabel: format(date, 'EEEE d. MMMM', { locale: cs }),
            users: missedUsers
          });
        }
      }

      setMissedHistory(history);
    } catch (err) {
      console.error('Error fetching missed history:', err);
    } finally {
      setLoadingMissedHistory(false);
    }
  };

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
        const todayStart = startOfDay(now).toISOString();
        const weekAgo = subDays(now, 7).toISOString();

        const { count: memberCount } = await supabase
          .from('user_profiles')
          .select('*', { count: 'exact', head: true })
          .eq('selected_gym_id', gymId);

        const { count: todayCount } = await supabase
          .from('workout_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('gym_id', gymId)
          .gte('started_at', todayStart);

        const { count: weeklyCount } = await supabase
          .from('workout_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('gym_id', gymId)
          .gte('started_at', weekAgo);

        const { data: durationData } = await supabase
          .from('workout_sessions')
          .select('duration_seconds')
          .eq('gym_id', gymId)
          .not('duration_seconds', 'is', null)
          .gte('started_at', weekAgo);

        const avgDuration = durationData && durationData.length > 0
          ? durationData.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / durationData.length / 60
          : 0;

        const { data: membersWithSchedule } = await supabase
          .from('user_profiles')
          .select('user_id, first_name, last_name, training_days')
          .eq('selected_gym_id', gymId)
          .contains('training_days', [todayWeekday]);

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

        const { data: topUserData } = await supabase
          .from('workout_sessions')
          .select('user_id')
          .eq('gym_id', gymId)
          .not('completed_at', 'is', null);

        const userWorkoutCounts: Record<string, number> = {};
        topUserData?.forEach(session => {
          userWorkoutCounts[session.user_id] = (userWorkoutCounts[session.user_id] || 0) + 1;
        });

        const topUserIds = Object.entries(userWorkoutCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([userId]) => userId);

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

        const weeklyTrend: WeeklyTrendData[] = [];
        for (let i = 6; i >= 0; i--) {
          const date = subDays(now, i);
          const dayStart = startOfDay(date).toISOString();
          const dayEnd = endOfDay(date).toISOString();

          const { count } = await supabase
            .from('workout_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('gym_id', gymId)
            .gte('started_at', dayStart)
            .lte('started_at', dayEnd);

          weeklyTrend.push({
            date: date.toISOString(),
            label: format(date, 'EEE', { locale: cs }),
            workouts: count || 0
          });
        }

        const { data: allSessions } = await supabase
          .from('workout_sessions')
          .select('started_at')
          .eq('gym_id', gymId);

        const dayCountMap: Record<string, number> = {
          monday: 0, tuesday: 0, wednesday: 0, thursday: 0,
          friday: 0, saturday: 0, sunday: 0
        };

        allSessions?.forEach(session => {
          const dayIndex = new Date(session.started_at).getDay();
          const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          dayCountMap[days[dayIndex]]++;
        });

        const dayDistribution: DayDistributionData[] = DAY_KEYS_ORDER.map((day, index) => ({
          dayKey: day,
          day: DAY_SHORT[day](t),
          workouts: dayCountMap[day],
          fill: DAY_COLORS[index]
        }));

        setStats({
          totalMembers: memberCount || 0,
          todayWorkouts: todayCount || 0,
          weeklyWorkouts: weeklyCount || 0,
          avgDurationMinutes: Math.round(avgDuration),
          missedWorkoutsToday: missedUsers,
          topUsers,
          weeklyTrend,
          dayDistribution
        });
      } catch (err) {
        console.error('Error fetching gym stats:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [gym?.id, todayWeekday]);

  useEffect(() => {
    if (showMissedHistory && missedHistory.length === 0 && !loadingMissedHistory) {
      fetchMissedHistory();
    }
  }, [showMissedHistory]);

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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">{t('business.stats_title')}</h1>

          {gyms.length > 1 && (
            <Select value={gym?.id || ''} onValueChange={(id) => {
              const selected = gyms.find(g => g.id === id);
              if (selected) selectGym(selected);
            }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={t('business.select_gym_placeholder')} />
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
            <p className="text-muted-foreground">{t('business.create_gym_first')}</p>
          </Card>
        ) : isLoading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        ) : stats && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                </div>
                <p className="text-2xl font-bold">{stats.totalMembers}</p>
                <p className="text-sm text-muted-foreground">{t('business.active_members')}</p>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-chart-2/10 rounded-xl flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-chart-2" />
                  </div>
                </div>
                <p className="text-2xl font-bold">{stats.todayWorkouts}</p>
                <p className="text-sm text-muted-foreground">{t('business.workouts_today')}</p>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-chart-4/10 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-chart-4" />
                  </div>
                </div>
                <p className="text-2xl font-bold">{stats.weeklyWorkouts}</p>
                <p className="text-sm text-muted-foreground">{t('business.workouts_7days')}</p>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-chart-3/10 rounded-xl flex items-center justify-center">
                    <Clock className="w-5 h-5 text-chart-3" />
                  </div>
                </div>
                <p className="text-2xl font-bold">{stats.avgDurationMinutes} min</p>
                <p className="text-sm text-muted-foreground">{t('business.avg_workout')}</p>
              </Card>
            </div>

            <Card className="p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                {t('business.weekly_trend')}
              </h3>
              <ChartContainer config={chartConfig} className="h-[200px] w-full">
                <BarChart data={stats.weeklyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12 }}
                    allowDecimals={false}
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                    cursor={{ fill: 'hsl(var(--muted))' }}
                  />
                  <Bar
                    dataKey="workouts"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                    name={t('business.chart_workouts')}
                  />
                </BarChart>
              </ChartContainer>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-chart-2" />
                {t('business.by_day_of_week')}
              </h3>
              <div className="flex flex-col md:flex-row items-center gap-4">
                <ChartContainer config={chartConfig} className="h-[200px] w-full md:w-1/2">
                  <PieChart>
                    <Pie
                      data={stats.dayDistribution.filter(d => d.workouts > 0)}
                      dataKey="workouts"
                      nameKey="day"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ day, percent }) => `${day} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {stats.dayDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string) => [t('business.workouts_count', { n: value }), name]}
                    />
                  </PieChart>
                </ChartContainer>
                <div className="grid grid-cols-2 gap-2 w-full md:w-1/2">
                  {stats.dayDistribution.map((day) => (
                    <div
                      key={day.dayKey}
                      className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: day.fill }}
                      />
                      <span className="text-sm">{DAY_NAMES[day.dayKey]?.(t)}</span>
                      <span className="text-sm font-semibold ml-auto">{day.workouts}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <UserX className="w-5 h-5 text-destructive" />
                <h3 className="font-semibold">{t('business.missed_today')}</h3>
                <span className="ml-auto text-sm text-muted-foreground">
                  {DAY_NAMES[todayWeekday]?.(t)}
                </span>
              </div>

              {stats.missedWorkoutsToday.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {t('business.all_trained')}
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
                          {user.firstName || t('business.unknown')} {user.lastName || ''}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t('business.should_workout_day', { day: DAY_NAMES[user.expectedDay]?.(t) })}
                        </p>
                      </div>
                    </div>
                  ))}
                  {stats.missedWorkoutsToday.length > 5 && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      {t('business.and_more', { n: stats.missedWorkoutsToday.length - 5 })}
                    </p>
                  )}
                </div>
              )}
            </Card>

            <Card className="p-4">
              <Button
                variant="ghost"
                className="w-full flex items-center justify-between p-0 h-auto hover:bg-transparent"
                onClick={() => setShowMissedHistory(!showMissedHistory)}
              >
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-muted-foreground" />
                  <h3 className="font-semibold">{t('business.missed_history')}</h3>
                </div>
                {showMissedHistory ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </Button>

              {showMissedHistory && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 space-y-4"
                >
                  {loadingMissedHistory ? (
                    <div className="space-y-2">
                      <Skeleton className="h-16" />
                      <Skeleton className="h-16" />
                      <Skeleton className="h-16" />
                    </div>
                  ) : missedHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      {t('business.no_missed')}
                    </p>
                  ) : (
                    missedHistory.map((entry) => (
                      <div key={entry.date} className="border-l-2 border-destructive/30 pl-4">
                        <p className="text-sm font-medium text-muted-foreground mb-2 capitalize">
                          {entry.dateLabel}
                        </p>
                        <div className="space-y-1">
                          {entry.users.slice(0, 3).map(user => (
                            <div key={user.id} className="flex items-center gap-2 text-sm">
                              <UserX className="w-3 h-3 text-destructive/70" />
                              <span>{user.firstName || t('business.unknown')} {user.lastName || ''}</span>
                            </div>
                          ))}
                          {entry.users.length > 3 && (
                            <p className="text-xs text-muted-foreground">
                              +{entry.users.length - 3} {t('business.and_more', { n: entry.users.length - 3 }).replace(`${entry.users.length - 3} `, '')}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </motion.div>
              )}
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5 text-chart-4" />
                <h3 className="font-semibold">{t('business.top_athletes')}</h3>
              </div>

              {stats.topUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {t('business.no_completed')}
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
                          {user.firstName || t('business.unknown')} {user.lastName || ''}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-primary">
                        {t('business.workouts_count', { n: user.workoutCount })}
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
