// AGENT TEST
import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Dumbbell, Clock, TrendingUp, Trophy, Target, Weight, Search, ChevronDown, X } from 'lucide-react';
import { useStatistics, type SessionDataPoint } from '@/hooks/useStatistics';
import PageTransition from '@/components/PageTransition';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';

const MUSCLE_LABELS: Record<string, string> = {
  chest: 'Prsa', back: 'Záda', shoulders: 'Ramena', biceps: 'Biceps',
  triceps: 'Triceps', quadriceps: 'Quadriceps', hamstrings: 'Hamstringy',
  glutes: 'Hýždě', core: 'Core', calves: 'Lýtka', forearms: 'Předloktí',
  traps: 'Trapézy', lats: 'Latissimus', abs: 'Břicho', hip_flexors: 'Kyčle',
  adductors: 'Adduktory', abductors: 'Abduktory',
};

type MetricKey = 'weight' | 'duration' | 'sets';

const METRICS: { key: MetricKey; label: string; unit: string; color: string; fill: string }[] = [
  { key: 'weight', label: 'Objem', unit: 'kg', color: '#4CC9FF', fill: '#4CC9FF' },
  { key: 'duration', label: 'Délka', unit: 'min', color: '#34D399', fill: '#34D399' },
  { key: 'sets', label: 'Série', unit: '', color: '#FBBF24', fill: '#FBBF24' },
];

const WINDOW_SIZE = 5; // sessions visible at once

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

const CustomTooltip = ({ active, payload, metric }: any) => {
  if (!active || !payload?.[0]) return null;
  const data = payload[0].payload as SessionDataPoint;
  const m = METRICS.find(m => m.key === metric)!;
  return (
    <div className="bg-background border border-border rounded-lg px-3 py-2 shadow-lg">
      <p className="text-[10px] text-muted-foreground">{format(new Date(data.date), 'd. MMM yyyy', { locale: cs })}</p>
      <p className="text-sm font-bold" style={{ color: m.color }}>
        {data[metric].toLocaleString('cs')} {m.unit}
      </p>
    </div>
  );
};

const Statistics = () => {
  const { stats, isLoading } = useStatistics();

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  const [activeMetric, setActiveMetric] = useState<MetricKey>('weight');
  const [windowEnd, setWindowEnd] = useState<number | null>(null);
  const [prSearch, setPrSearch] = useState('');
  const [prDrawerOpen, setPrDrawerOpen] = useState(false);
  const [expandedPrId, setExpandedPrId] = useState<string | null>(null);
  const touchStartX = useRef(0);
  const touchStartTime = useRef(0);

  const filteredPRs = useMemo(() => {
    if (!stats) return [];
    if (!prSearch.trim()) return stats.personalRecords;
    const q = prSearch.toLowerCase();
    return stats.personalRecords.filter(pr => pr.exerciseName.toLowerCase().includes(q));
  }, [stats?.personalRecords, prSearch]);

  // 3 most recently achieved/beaten PRs
  const recentPRs = useMemo(() => {
    if (!stats) return [];
    return [...stats.personalRecords]
      .sort((a, b) => new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime())
      .slice(0, 3);
  }, [stats?.personalRecords]);

  const timeline = stats?.sessionTimeline || [];
  const totalPoints = timeline.length;

  // Current window position
  const end = windowEnd ?? totalPoints;
  const start = Math.max(0, end - WINDOW_SIZE);
  const visibleData = timeline.slice(start, end);

  const canGoLeft = start > 0;
  const canGoRight = end < totalPoints;

  const handleSwipe = useCallback((deltaX: number) => {
    if (Math.abs(deltaX) < 30) return;
    setWindowEnd(prev => {
      const current = prev ?? totalPoints;
      if (deltaX > 0 && canGoLeft) {
        // Swipe right = go back in time
        return Math.max(WINDOW_SIZE, current - 2);
      } else if (deltaX < 0 && canGoRight) {
        // Swipe left = go forward in time
        return Math.min(totalPoints, current + 2);
      }
      return current;
    });
  }, [totalPoints, canGoLeft, canGoRight]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartTime.current = Date.now();
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const elapsed = Date.now() - touchStartTime.current;
    if (elapsed < 500) handleSwipe(deltaX);
  };

  const metric = METRICS.find(m => m.key === activeMetric)!;

  // Summary value for current visible window
  const visibleSum = visibleData.reduce((a, d) => a + d[activeMetric], 0);
  const visibleAvg = visibleData.length > 0 ? Math.round(visibleSum / visibleData.length) : 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <p className="text-muted-foreground text-center">Zatím nemáš žádná data. Dokonči svůj první trénink!</p>
      </div>
    );
  }

  const maxMuscleSets = stats.muscleDistribution[0]?.sets || 1;

  return (
    <PageTransition>
      <div className="min-h-screen bg-background safe-top pb-28">
        {/* Header */}
        <div className="px-6 pt-8 pb-4">
          <motion.h1
            className="text-2xl font-bold text-foreground"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Statistiky
          </motion.h1>
          <p className="text-sm text-muted-foreground mt-1">Tvůj progres na jednom místě</p>
        </div>

        <motion.div
          className="px-4 space-y-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Hero Stats */}
          <motion.div variants={itemVariants} className="grid grid-cols-3 gap-2">
            <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
              <CardContent className="p-3 text-center">
                <Flame className="w-5 h-5 text-orange-500 mx-auto mb-1" />
                <p className="text-xl font-bold text-foreground">{stats.streak.current}</p>
                <p className="text-[10px] text-muted-foreground">Streak</p>
                <p className="text-[9px] text-muted-foreground/60">po sobě jdoucích</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="p-3 text-center">
                <Dumbbell className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-xl font-bold text-foreground">{stats.thisMonth.workouts}</p>
                <p className="text-[10px] text-muted-foreground">Tento měsíc</p>
                <p className="text-[9px] text-muted-foreground/60">dokončených</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
              <CardContent className="p-3 text-center">
                <TrendingUp className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                <p className="text-xl font-bold text-foreground">{stats.allTime.workouts}</p>
                <p className="text-[10px] text-muted-foreground">Celkem</p>
                <p className="text-[9px] text-muted-foreground/60">tréninků</p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Weekday Activity */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader className="pb-2 px-4 pt-4">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Tento týden
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="flex justify-between gap-1">
                  {stats.weekdayActivity.map((day) => (
                    <div key={day.day} className="flex flex-col items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground">{day.short}</span>
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                          day.trained
                            ? 'bg-primary text-primary-foreground'
                            : day.missed
                            ? 'bg-red-100 text-red-500 border-2 border-red-300'
                            : day.planned
                            ? 'bg-primary/15 text-primary border-2 border-dashed border-primary/30'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {day.trained ? '✓' : day.missed ? '✗' : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Unified Progress Chart */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader className="pb-1 px-4 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {visibleAvg.toLocaleString('cs')}
                      <span className="text-sm font-normal text-muted-foreground ml-1">{metric.unit}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">průměr na trénink</p>
                  </div>
                  {/* Swipe hint */}
                  <div className="flex items-center gap-0.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${canGoLeft ? 'bg-muted-foreground/40' : 'bg-muted'}`} />
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    <div className={`w-1.5 h-1.5 rounded-full ${canGoRight ? 'bg-muted-foreground/40' : 'bg-muted'}`} />
                  </div>
                </div>

                {/* Metric tabs */}
                <div className="flex gap-1.5 mt-3">
                  {METRICS.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => { setActiveMetric(m.key); setWindowEnd(null); }}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        activeMetric === m.key
                          ? 'text-white shadow-sm'
                          : 'bg-muted text-muted-foreground'
                      }`}
                      style={activeMetric === m.key ? { backgroundColor: m.color } : undefined}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </CardHeader>

              <CardContent className="px-0 pb-3 pt-2">
                <div
                  className="touch-pan-y"
                  onTouchStart={onTouchStart}
                  onTouchEnd={onTouchEnd}
                >
                  {visibleData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={160}>
                      <AreaChart data={visibleData} margin={{ top: 5, right: 16, left: 16, bottom: 0 }}>
                        <defs>
                          <linearGradient id={`gradient-${activeMetric}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={metric.color} stopOpacity={0.3} />
                            <stop offset="100%" stopColor={metric.color} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="label"
                          tickLine={false}
                          axisLine={false}
                          fontSize={10}
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <YAxis hide domain={['auto', 'auto']} />
                        <Tooltip content={<CustomTooltip metric={activeMetric} />} />
                        <Area
                          type="monotone"
                          dataKey={activeMetric}
                          stroke={metric.color}
                          strokeWidth={2.5}
                          fill={`url(#gradient-${activeMetric})`}
                          dot={{ r: 3, fill: metric.color, strokeWidth: 0 }}
                          activeDot={{ r: 5, fill: metric.color, stroke: '#fff', strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[160px] flex items-center justify-center">
                      <p className="text-sm text-muted-foreground">Zatím žádná data</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Personal Records — compact card with 3 recent + search drawer */}
          {stats.personalRecords.length > 0 && (
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader className="pb-2 px-4 pt-4">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    Osobní rekordy
                    <button
                      onClick={() => { setPrDrawerOpen(true); setPrSearch(''); }}
                      className="ml-auto flex items-center gap-1 text-xs text-primary font-medium"
                    >
                      <Search className="w-3.5 h-3.5" />
                      {stats.personalRecords.length} cviků
                    </button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-1">
                  {recentPRs.map((pr) => (
                    <div key={pr.exerciseId} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{pr.exerciseName}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {format(new Date(pr.achievedAt), 'd. MMM yyyy', { locale: cs })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-foreground">{pr.maxWeight} kg × {pr.maxWeightReps}</p>
                        {pr.previousMax && (
                          <p className="text-[10px] text-emerald-500">
                            +{(pr.maxWeight - pr.previousMax).toFixed(1)} kg
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* PR Drawer — full searchable list */}
          <Drawer open={prDrawerOpen} onOpenChange={setPrDrawerOpen}>
            <DrawerContent className="max-h-[85vh]">
              <DrawerHeader className="pb-2">
                <DrawerTitle className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  Osobní rekordy
                </DrawerTitle>
                <div className="relative mt-2">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Hledat cvik..."
                    value={prSearch}
                    onChange={(e) => setPrSearch(e.target.value)}
                    className="w-full pl-8 pr-8 py-2 text-sm bg-muted/50 border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary/50"
                  />
                  {prSearch && (
                    <button onClick={() => setPrSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                      <X className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </DrawerHeader>
              <div className="px-4 pb-6 overflow-y-auto space-y-1">
                {filteredPRs.map((pr) => {
                  const isOpen = expandedPrId === pr.exerciseId;
                  return (
                    <div key={pr.exerciseId} className="border-b border-border/50 last:border-0">
                      <button
                        onClick={() => setExpandedPrId(isOpen ? null : pr.exerciseId)}
                        className="flex items-center justify-between py-2.5 w-full text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{pr.exerciseName}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {pr.totalSets} sérií · {format(new Date(pr.achievedAt), 'd. MMM yyyy', { locale: cs })}
                          </p>
                        </div>
                        <div className="text-right mr-2">
                          <p className="text-sm font-bold text-foreground">{pr.maxWeight} kg × {pr.maxWeightReps}</p>
                          {pr.previousMax && (
                            <p className="text-[10px] text-emerald-500">
                              +{(pr.maxWeight - pr.previousMax).toFixed(1)} kg
                            </p>
                          )}
                        </div>
                        <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>

                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="pb-3 space-y-2">
                              <div className="flex gap-2">
                                <div className="flex-1 bg-muted/50 rounded-lg p-2 text-center">
                                  <p className="text-xs font-bold text-foreground">{pr.maxWeight} kg</p>
                                  <p className="text-[10px] text-muted-foreground">Max váha</p>
                                </div>
                                <div className="flex-1 bg-muted/50 rounded-lg p-2 text-center">
                                  <p className="text-xs font-bold text-foreground">{pr.estimated1RM} kg</p>
                                  <p className="text-[10px] text-muted-foreground">Odhad 1RM</p>
                                </div>
                                <div className="flex-1 bg-muted/50 rounded-lg p-2 text-center">
                                  <p className="text-xs font-bold text-foreground">{pr.totalSets}</p>
                                  <p className="text-[10px] text-muted-foreground">Celkem sérií</p>
                                </div>
                              </div>
                              <div>
                                <p className="text-[10px] font-medium text-muted-foreground mb-1">Poslední série</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {pr.bestSets.slice(0, 12).map((s, i) => (
                                    <span key={i} className="text-[10px] bg-muted px-2 py-1 rounded-md text-foreground">
                                      {s.weight}kg × {s.reps}
                                      <span className="text-muted-foreground ml-1">
                                        {format(new Date(s.date), 'd.M.', { locale: cs })}
                                      </span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
                {prSearch && filteredPRs.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Žádné výsledky</p>
                )}
              </div>
            </DrawerContent>
          </Drawer>

          {/* Muscle Distribution */}
          {stats.muscleDistribution.length > 0 && (
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader className="pb-2 px-4 pt-4">
                  <CardTitle className="text-sm font-medium">Rozložení svalových skupin</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-[10px] text-muted-foreground w-20 shrink-0">Sval</span>
                    <div className="flex-1" />
                    <span className="text-[10px] text-muted-foreground w-8 text-right">Sérií</span>
                  </div>
                  {stats.muscleDistribution.slice(0, 8).map((m) => (
                    <div key={m.muscle} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-20 shrink-0 truncate">
                        {MUSCLE_LABELS[m.muscle] || m.muscle}
                      </span>
                      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-primary rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${(m.sets / maxMuscleSets) * 100}%` }}
                          transition={{ duration: 0.6, delay: 0.2 }}
                        />
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground w-8 text-right">{m.sets}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Top Exercises */}
          {stats.topExercises.length > 0 && (
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader className="pb-2 px-4 pt-4">
                  <CardTitle className="text-sm font-medium">Nejčastější cviky</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {stats.topExercises.map((ex, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-primary w-5">{i + 1}.</span>
                        <span className="text-sm text-foreground">{ex.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{ex.sets} sérií</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </motion.div>
      </div>
    </PageTransition>
  );
};

export default Statistics;
