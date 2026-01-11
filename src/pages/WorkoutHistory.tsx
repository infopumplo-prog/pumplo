import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Dumbbell, Clock, Flame, TrendingUp, Calendar } from 'lucide-react';
import { useWorkoutStats } from '@/hooks/useWorkoutStats';
import { useWorkoutHistory } from '@/hooks/useWorkoutHistoryDetails';
import PageTransition from '@/components/PageTransition';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';
import { format, subDays, startOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { cs } from 'date-fns/locale';

const WorkoutHistory = () => {
  const navigate = useNavigate();
  const { stats, isLoading } = useWorkoutStats();
  const { sessions, exerciseStats, isLoading: historyLoading } = useWorkoutHistory();
  const [activeTab, setActiveTab] = useState('overview');

  // Prepare chart data for last 7 days
  const last7Days = eachDayOfInterval({
    start: subDays(new Date(), 6),
    end: new Date(),
  });

  const weeklyChartData = last7Days.map(day => {
    const daySession = sessions.find(s => isSameDay(new Date(s.started_at), day));
    return {
      day: format(day, 'EEE', { locale: cs }),
      date: format(day, 'd.M.'),
      duration: daySession ? Math.round((daySession.duration_seconds || 0) / 60) : 0,
      weight: daySession ? (daySession.total_weight_kg || 0) : 0,
      sets: daySession ? (daySession.total_sets || 0) : 0,
    };
  });

  // Prepare monthly trend data (last 4 weeks)
  const monthlyData = Array.from({ length: 4 }, (_, i) => {
    const weekStart = startOfWeek(subDays(new Date(), i * 7), { weekStartsOn: 1 });
    const weekSessions = sessions.filter(s => {
      const sessionDate = new Date(s.started_at);
      return sessionDate >= weekStart && sessionDate < subDays(weekStart, -7);
    });
    
    return {
      week: `Týden ${4 - i}`,
      workouts: weekSessions.length,
      totalWeight: weekSessions.reduce((acc, s) => acc + (s.total_weight_kg || 0), 0),
      totalDuration: Math.round(weekSessions.reduce((acc, s) => acc + (s.duration_seconds || 0), 0) / 60),
    };
  }).reverse();

  const chartConfig = {
    duration: { label: 'Čas (min)', color: 'hsl(var(--primary))' },
    weight: { label: 'Váha (kg)', color: 'hsl(var(--chart-2))' },
    sets: { label: 'Série', color: 'hsl(var(--chart-3))' },
    workouts: { label: 'Tréninky', color: 'hsl(var(--primary))' },
    totalWeight: { label: 'Celková váha', color: 'hsl(var(--chart-2))' },
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  if (isLoading || historyLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-background safe-top pb-8">
        {/* Header */}
        <div className="gradient-hero px-6 pt-8 pb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/profile')}
              className="w-10 h-10 bg-card/80 backdrop-blur rounded-xl flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <motion.h1
              className="text-2xl font-bold text-foreground"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              Historie tréninků
            </motion.h1>
          </div>
        </div>

        <motion.div
          className="px-6 py-6 space-y-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Summary Cards */}
          <motion.div variants={itemVariants} className="grid grid-cols-2 gap-3">
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="p-4 text-center">
                <Dumbbell className="w-6 h-6 text-primary mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">{stats.allTime.totalWorkouts}</p>
                <p className="text-xs text-muted-foreground">Celkem tréninků</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-chart-2/10 to-chart-2/5 border-chart-2/20">
              <CardContent className="p-4 text-center">
                <Clock className="w-6 h-6 text-chart-2 mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">{Math.round(stats.allTime.totalDuration / 60)}h</p>
                <p className="text-xs text-muted-foreground">Hodin cvičení</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-chart-3/10 to-chart-3/5 border-chart-3/20">
              <CardContent className="p-4 text-center">
                <TrendingUp className="w-6 h-6 text-chart-3 mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">{Math.round(stats.allTime.totalWeight).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">kg zvednuto</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-chart-4/10 to-chart-4/5 border-chart-4/20">
              <CardContent className="p-4 text-center">
                <Flame className="w-6 h-6 text-chart-4 mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">{stats.allTime.totalSets}</p>
                <p className="text-xs text-muted-foreground">Celkem sérií</p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Tabs */}
          <motion.div variants={itemVariants}>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="overview">Přehled</TabsTrigger>
                <TabsTrigger value="exercises">Cviky</TabsTrigger>
                <TabsTrigger value="sessions">Tréninky</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                {/* Weekly Chart */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Posledních 7 dní
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={chartConfig} className="h-[200px] w-full">
                      <BarChart data={weeklyChartData}>
                        <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                        <YAxis hide />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="duration" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                  </CardContent>
                </Card>

                {/* Weight Trend */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Trend váhy (kg)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={chartConfig} className="h-[180px] w-full">
                      <AreaChart data={weeklyChartData}>
                        <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                        <YAxis hide />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Area 
                          type="monotone" 
                          dataKey="weight" 
                          stroke="hsl(var(--chart-2))" 
                          fill="hsl(var(--chart-2))" 
                          fillOpacity={0.2}
                        />
                      </AreaChart>
                    </ChartContainer>
                  </CardContent>
                </Card>

                {/* Monthly Progress */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium">Měsíční progres</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={chartConfig} className="h-[180px] w-full">
                      <LineChart data={monthlyData}>
                        <XAxis dataKey="week" tickLine={false} axisLine={false} fontSize={12} />
                        <YAxis hide />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Line 
                          type="monotone" 
                          dataKey="workouts" 
                          stroke="hsl(var(--primary))" 
                          strokeWidth={2}
                          dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
                        />
                      </LineChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="exercises" className="space-y-3">
                {exerciseStats.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center text-muted-foreground">
                      Zatím nemáte žádné zaznamenané cviky
                    </CardContent>
                  </Card>
                ) : (
                  exerciseStats.map((exercise, index) => (
                    <motion.div
                      key={exercise.exerciseId}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium text-foreground">{exercise.exerciseName}</h4>
                            <span className="text-xs text-muted-foreground">{exercise.totalSets}x</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-sm">
                            <div className="text-center bg-muted/50 rounded-lg p-2">
                              <p className="font-semibold text-foreground">{exercise.maxWeight}</p>
                              <p className="text-xs text-muted-foreground">Max kg</p>
                            </div>
                            <div className="text-center bg-muted/50 rounded-lg p-2">
                              <p className="font-semibold text-foreground">{exercise.avgWeight.toFixed(1)}</p>
                              <p className="text-xs text-muted-foreground">Prům. kg</p>
                            </div>
                            <div className="text-center bg-muted/50 rounded-lg p-2">
                              <p className="font-semibold text-foreground">{exercise.totalReps}</p>
                              <p className="text-xs text-muted-foreground">Opakování</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="sessions" className="space-y-3">
                {sessions.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center text-muted-foreground">
                      Zatím nemáte žádné dokončené tréninky
                    </CardContent>
                  </Card>
                ) : (
                  sessions.slice(0, 20).map((session, index) => (
                    <motion.div
                      key={session.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                                <span className="text-lg font-bold text-primary">{session.day_letter}</span>
                              </div>
                              <div>
                                <p className="font-medium text-foreground">
                                  {format(new Date(session.started_at), 'EEEE d. MMMM', { locale: cs })}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(session.started_at), 'HH:mm')}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-sm mt-3">
                            <div className="text-center">
                              <p className="font-semibold text-foreground">
                                {Math.round((session.duration_seconds || 0) / 60)} min
                              </p>
                              <p className="text-xs text-muted-foreground">Čas</p>
                            </div>
                            <div className="text-center">
                              <p className="font-semibold text-foreground">{session.total_sets || 0}</p>
                              <p className="text-xs text-muted-foreground">Série</p>
                            </div>
                            <div className="text-center">
                              <p className="font-semibold text-foreground">{session.total_weight_kg || 0} kg</p>
                              <p className="text-xs text-muted-foreground">Váha</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </motion.div>
        </motion.div>
      </div>
    </PageTransition>
  );
};

export default WorkoutHistory;
