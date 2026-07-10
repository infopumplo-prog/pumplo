import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { cs, enUS } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Flame, Trophy, Target, Search, X, ChevronDown, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import PageTransition from '@/components/PageTransition';
import { useStatistics } from '@/hooks/useStatistics';
import { MuscleBodySvg } from '@/components/workout/MuscleBodySvg';
import { computeMuscleDistribution, muscleIntensities } from '@/lib/muscleDistribution';
import { translateMuscle } from '@/lib/muscleTranslation';
import { cn } from '@/lib/utils';

type MetricKey = 'weight' | 'duration' | 'sets';
type Period = 'today' | 'week' | 'month' | '3m' | 'all';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, metric, metricColor, metricUnit, isEn }: any) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  const dateLocale = isEn ? enUS : cs;
  return (
    <div className="bg-background border border-border rounded-lg px-3 py-2 shadow-lg">
      <p className="text-[10px] text-muted-foreground">{format(new Date(data.date), isEn ? 'MMM d, yyyy' : 'd. MMM yyyy', { locale: dateLocale })}</p>
      <p className="text-sm font-bold" style={{ color: metricColor }}>
        {data[metric].toLocaleString(isEn ? 'en' : 'cs')} {metricUnit}
      </p>
    </div>
  );
};

// Start of the selected period (null = all time).
const periodStart = (period: Period, now: Date): Date | null => {
  const d = new Date(now);
  switch (period) {
    case 'today': d.setHours(0, 0, 0, 0); return d;
    case 'week': d.setDate(d.getDate() - 7); return d;
    case 'month': d.setMonth(d.getMonth() - 1); return d;
    case '3m': d.setMonth(d.getMonth() - 3); return d;
    case 'all': return null;
  }
};

// ▲/▼ percentage vs the previous period of the same length.
const TrendBadge = ({ current, previous }: { current: number; previous: number | null }) => {
  if (previous == null) return null;
  if (previous === 0 && current === 0) return null;
  const pct = previous === 0 ? 100 : Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground"><Minus className="w-3 h-3" />0 %</span>;
  const up = pct > 0;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[11px] font-semibold', up ? 'text-emerald-500' : 'text-red-500')}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {up ? '+' : ''}{pct} %
    </span>
  );
};

const fmtDuration = (minutes: number, isEn: boolean): string => {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} ${isEn ? 'm' : 'm'}`;
};
const fmtVolume = (kg: number, isEn: boolean): { value: string; unit: string } => {
  if (kg >= 10000) return { value: (kg / 1000).toLocaleString(isEn ? 'en' : 'cs', { maximumFractionDigits: 1 }), unit: 't' };
  return { value: Math.round(kg).toLocaleString(isEn ? 'en' : 'cs'), unit: 'kg' };
};

const Statistics = () => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';
  const dateLocale = isEn ? enUS : cs;
  const { stats, isLoading } = useStatistics();

  const METRICS: { key: MetricKey; label: string; unit: string; color: string }[] = [
    { key: 'weight', label: t('stats.volume'), unit: 'kg', color: '#4CC9FF' },
    { key: 'duration', label: t('stats.time'), unit: 'min', color: '#34D399' },
    { key: 'sets', label: t('stats.series_count'), unit: '', color: '#FBBF24' },
  ];
  const PERIODS: { key: Period; label: string }[] = [
    { key: 'today', label: t('stats.period_today') },
    { key: 'week', label: t('stats.period_week') },
    { key: 'month', label: t('stats.period_month') },
    { key: '3m', label: t('stats.period_3m') },
    { key: 'all', label: t('stats.period_all') },
  ];

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const [period, setPeriod] = useState<Period>('month');
  const [activeMetric, setActiveMetric] = useState<MetricKey>('weight');
  const [prSearch, setPrSearch] = useState('');
  const [prDrawerOpen, setPrDrawerOpen] = useState(false);
  const [expandedPrId, setExpandedPrId] = useState<string | null>(null);

  const now = useMemo(() => new Date(), []);
  const from = useMemo(() => periodStart(period, now), [period, now]);
  // Previous window of the same length, right before `from` (null for all-time).
  const prevFrom = useMemo(() => {
    if (!from) return null;
    return new Date(from.getTime() - (now.getTime() - from.getTime()));
  }, [from, now]);

  const timeline = useMemo(() => stats?.sessionTimeline || [], [stats]);
  const inPeriod = useMemo(
    () => timeline.filter(d => !from || new Date(d.date) >= from),
    [timeline, from]
  );
  const inPrevPeriod = useMemo(() => {
    if (!from || !prevFrom) return null;
    return timeline.filter(d => { const t2 = new Date(d.date); return t2 >= prevFrom && t2 < from; });
  }, [timeline, from, prevFrom]);

  // --- Period summary + trends ---
  const summary = useMemo(() => {
    const sum = (arr: typeof timeline) => ({
      workouts: arr.length,
      duration: arr.reduce((a, d) => a + d.duration, 0),
      weight: arr.reduce((a, d) => a + d.weight, 0),
      sets: arr.reduce((a, d) => a + d.sets, 0),
    });
    return { cur: sum(inPeriod), prev: inPrevPeriod ? sum(inPrevPeriod) : null };
  }, [inPeriod, inPrevPeriod]);

  // --- Chart: per session for week, per calendar week otherwise ---
  const chartData = useMemo(() => {
    if (period === 'today' || period === 'week') return inPeriod;
    const byWeek = new Map<string, { date: string; label: string; weight: number; duration: number; sets: number }>();
    inPeriod.forEach(d => {
      const dt = new Date(d.date);
      const monday = new Date(dt);
      monday.setDate(dt.getDate() - (dt.getDay() === 0 ? 6 : dt.getDay() - 1));
      monday.setHours(0, 0, 0, 0);
      const key = monday.toISOString();
      const cur = byWeek.get(key) || { date: key, label: `${monday.getDate()}.${monday.getMonth() + 1}.`, weight: 0, duration: 0, sets: 0 };
      cur.weight += d.weight; cur.duration += d.duration; cur.sets += d.sets;
      byWeek.set(key, cur);
    });
    return [...byWeek.values()].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [inPeriod, period]);

  const metric = METRICS.find(m => m.key === activeMetric)!;
  const chartTotal = useMemo(() => inPeriod.reduce((a, d) => a + d[activeMetric], 0), [inPeriod, activeMetric]);

  // --- Muscles for the period (shared figure + labels) ---
  const setRowsInPeriod = useMemo(
    () => (stats?.setRows || []).filter(r => !from || new Date(r.date) >= from),
    [stats?.setRows, from]
  );
  const muscleDist = useMemo(() => computeMuscleDistribution(
    setRowsInPeriod.map(r => ({ primaryMuscles: r.muscles, secondaryMuscles: [], completedSets: 1 }))
  ), [setRowsInPeriod]);
  const muscleIntens = useMemo(() => muscleIntensities(muscleDist), [muscleDist]);
  const muscleMax = muscleDist[0]?.value || 1;

  // --- Top exercises for the period ---
  const topExercises = useMemo(() => {
    const map = new Map<string, { name: string; nameEn: string | null; sets: number }>();
    setRowsInPeriod.forEach(r => {
      const key = r.exerciseId || r.name;
      const cur = map.get(key);
      if (cur) cur.sets++;
      else map.set(key, { name: r.name, nameEn: r.nameEn, sets: 1 });
    });
    return [...map.values()].sort((a, b) => b.sets - a.sets).slice(0, 5);
  }, [setRowsInPeriod]);

  // --- PRs (all-time by nature), sorted by most recently beaten ---
  const recentPRs = useMemo(() => {
    if (!stats) return [];
    return [...stats.personalRecords]
      .sort((a, b) => new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime())
      .slice(0, 3);
  }, [stats]);
  const filteredPRs = useMemo(() => {
    if (!stats) return [];
    if (!prSearch.trim()) return stats.personalRecords;
    const q = prSearch.toLowerCase();
    return stats.personalRecords.filter(pr => pr.exerciseName.toLowerCase().includes(q));
  }, [stats, prSearch]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats || stats.allTime.workouts === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <p className="text-muted-foreground text-center">{t('stats.no_data')}</p>
      </div>
    );
  }

  const vol = fmtVolume(summary.cur.weight, isEn);

  return (
    <PageTransition>
      <div className="min-h-screen bg-background safe-top pb-nav">
        {/* Header + streak chip (streak is timeless) */}
        <div className="px-6 pt-8 pb-3 flex items-start justify-between">
          <div>
            <motion.h1
              className="text-2xl font-bold text-foreground"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {t('stats.title')}
            </motion.h1>
            <p className="text-sm text-muted-foreground mt-1">{t('stats.subtitle')}</p>
          </div>
          {stats.streak.current > 0 && (
            <div className="flex items-center gap-1.5 bg-orange-500/10 text-orange-500 rounded-full px-3 py-1.5">
              <Flame className="w-4 h-4" />
              <span className="text-sm font-bold">{stats.streak.current}</span>
            </div>
          )}
        </div>

        <motion.div className="px-4 space-y-4" variants={containerVariants} initial="hidden" animate="visible">
          {/* Period switcher — drives everything below */}
          <motion.div variants={itemVariants}>
            <div className="flex bg-muted rounded-xl p-1">
              {PERIODS.map(p => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={cn(
                    'flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all',
                    period === p.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Period summary with trends */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <p className="text-[11px] text-muted-foreground">{t('stats.trainings')}</p>
                    <p className="text-xl font-bold text-foreground tabular-nums">{summary.cur.workouts}</p>
                    <TrendBadge current={summary.cur.workouts} previous={summary.prev?.workouts ?? null} />
                  </div>
                  <div className="text-center">
                    <p className="text-[11px] text-muted-foreground">{t('stats.time')}</p>
                    <p className="text-xl font-bold text-foreground tabular-nums">{fmtDuration(summary.cur.duration, isEn)}</p>
                    <TrendBadge current={summary.cur.duration} previous={summary.prev?.duration ?? null} />
                  </div>
                  <div className="text-center">
                    <p className="text-[11px] text-muted-foreground">{t('stats.volume')}</p>
                    <p className="text-xl font-bold text-foreground tabular-nums">{vol.value} <span className="text-xs font-medium text-muted-foreground">{vol.unit}</span></p>
                    <TrendBadge current={summary.cur.weight} previous={summary.prev?.weight ?? null} />
                  </div>
                </div>
                {summary.prev && (
                  <p className="text-[10px] text-muted-foreground/70 mt-2 text-center">{t('stats.vs_previous')}</p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Weekday Activity (always the current week) */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader className="pb-2 px-4 pt-4">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  {t('stats.this_week')}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="flex justify-between gap-1">
                  {stats.weekdayActivity.map((day) => (
                    <div key={day.day} className="flex flex-col items-center gap-1.5">
                      <span className="text-[11px] text-muted-foreground">{day.short}</span>
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors',
                          day.trained
                            ? 'bg-primary text-primary-foreground'
                            : day.missed
                            ? 'bg-red-100 text-red-500 border-2 border-red-300'
                            : day.planned
                            ? 'bg-primary/15 text-primary border-2 border-dashed border-primary/30'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {day.trained ? '✓' : day.missed ? '✗' : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Progress chart (aggregated per week beyond the week view) */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader className="pb-1 px-4 pt-4">
                <div>
                  <p className="text-2xl font-bold text-foreground tabular-nums">
                    {chartTotal.toLocaleString(isEn ? 'en' : 'cs')}
                    <span className="text-sm font-normal text-muted-foreground ml-1">{metric.unit}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">{t('stats.chart_total')}</p>
                </div>
                <div className="flex gap-1.5 mt-3">
                  {METRICS.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => setActiveMetric(m.key)}
                      className={cn(
                        'flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all',
                        activeMetric === m.key ? 'text-white shadow-sm' : 'bg-muted text-muted-foreground'
                      )}
                      style={activeMetric === m.key ? { backgroundColor: m.color } : undefined}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="px-0 pb-3 pt-2">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={chartData} margin={{ top: 5, right: 16, left: 16, bottom: 0 }}>
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
                        interval="preserveStartEnd"
                      />
                      <YAxis hide domain={['auto', 'auto']} />
                      <Tooltip content={<CustomTooltip metric={activeMetric} metricColor={metric.color} metricUnit={metric.unit} isEn={isEn} />} />
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
                    <p className="text-sm text-muted-foreground">{t('stats.no_data_yet')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Muscle distribution — body figure + top groups, for the period */}
          {muscleDist.length > 0 && (
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader className="pb-2 px-4 pt-4">
                  <CardTitle className="text-sm font-medium">{t('stats.muscle_distribution')}</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="flex justify-center gap-8 mb-4">
                    <MuscleBodySvg intensities={muscleIntens} side="front" width={92} />
                    <MuscleBodySvg intensities={muscleIntens} side="back" width={92} />
                  </div>
                  <div className="space-y-2">
                    {muscleDist.slice(0, 5).map((m) => (
                      <div key={(m.key ?? m.raw)} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-20 shrink-0 truncate">
                          {m.key ? t(`custom_plan.muscle_${m.key}`) : translateMuscle(m.raw, isEn)}
                        </span>
                        <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-primary rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${(m.value / muscleMax) * 100}%` }}
                            transition={{ duration: 0.5 }}
                          />
                        </div>
                        <span className="text-[11px] font-medium text-muted-foreground w-8 text-right tabular-nums">{Math.round(m.value)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Personal Records — 3 most recently beaten + searchable drawer */}
          {stats.personalRecords.length > 0 && (
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader className="pb-2 px-4 pt-4">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    {t('stats.personal_records')}
                    <button
                      onClick={() => { setPrDrawerOpen(true); setPrSearch(''); }}
                      className="ml-auto flex items-center gap-1 text-xs text-primary font-medium"
                    >
                      <Search className="w-3.5 h-3.5" />
                      {stats.personalRecords.length} {t('stats.exercises_count')}
                    </button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-1">
                  {recentPRs.map((pr) => (
                    <div key={pr.exerciseId} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{(isEn && pr.exerciseNameEn) ? pr.exerciseNameEn : pr.exerciseName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {format(new Date(pr.achievedAt), isEn ? 'MMM d, yyyy' : 'd. MMM yyyy', { locale: dateLocale })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-foreground">{pr.maxWeight} kg × {pr.maxWeightReps}</p>
                        {pr.previousMax && (
                          <p className="text-[11px] text-emerald-500">+{(pr.maxWeight - pr.previousMax).toFixed(1)} kg</p>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Top exercises for the period */}
          {topExercises.length > 0 && (
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader className="pb-2 px-4 pt-4">
                  <CardTitle className="text-sm font-medium">{t('stats.top_exercises')}</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {topExercises.map((ex, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-primary w-5">{i + 1}.</span>
                        <span className="text-sm text-foreground">{(isEn && ex.nameEn) ? ex.nameEn : ex.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{ex.sets} {t('stats.metric_sets')}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </motion.div>

        {/* PR Drawer — full searchable list */}
        <Drawer open={prDrawerOpen} onOpenChange={setPrDrawerOpen}>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader className="pb-2">
              <DrawerTitle className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                {t('stats.personal_records')}
              </DrawerTitle>
              <div className="relative mt-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={t('stats.search_exercise')}
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
                        <p className="text-sm font-medium text-foreground truncate">{(isEn && pr.exerciseNameEn) ? pr.exerciseNameEn : pr.exerciseName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {pr.totalSets} {t('stats.metric_sets')} · {format(new Date(pr.achievedAt), isEn ? 'MMM d, yyyy' : 'd. MMM yyyy', { locale: dateLocale })}
                        </p>
                      </div>
                      <div className="text-right mr-2">
                        <p className="text-sm font-bold text-foreground">{pr.maxWeight} kg × {pr.maxWeightReps}</p>
                        {pr.previousMax && (
                          <p className="text-[11px] text-emerald-500">+{(pr.maxWeight - pr.previousMax).toFixed(1)} kg</p>
                        )}
                      </div>
                      <ChevronDown className={cn('w-4 h-4 text-muted-foreground shrink-0 transition-transform', isOpen && 'rotate-180')} />
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
                                <p className="text-[10px] text-muted-foreground">{t('stats.max_weight')}</p>
                              </div>
                              <div className="flex-1 bg-muted/50 rounded-lg p-2 text-center">
                                <p className="text-xs font-bold text-foreground">{pr.estimated1RM} kg</p>
                                <p className="text-[10px] text-muted-foreground">{t('stats.estimated_1rm')}</p>
                              </div>
                              <div className="flex-1 bg-muted/50 rounded-lg p-2 text-center">
                                <p className="text-xs font-bold text-foreground">{pr.totalSets}</p>
                                <p className="text-[10px] text-muted-foreground">{t('stats.total_sets')}</p>
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] font-medium text-muted-foreground mb-1">{t('stats.last_sets')}</p>
                              <div className="flex flex-wrap gap-1.5">
                                {pr.bestSets.slice(0, 12).map((s, i) => (
                                  <span key={i} className="text-[10px] bg-muted px-2 py-1 rounded-md text-foreground">
                                    {s.weight}kg × {s.reps}
                                    <span className="text-muted-foreground ml-1">
                                      {format(new Date(s.date), isEn ? 'M/d' : 'd.M.', { locale: dateLocale })}
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
                <p className="text-sm text-muted-foreground text-center py-4">{t('stats.no_results')}</p>
              )}
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </PageTransition>
  );
};

export default Statistics;
