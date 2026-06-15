/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Target, Dumbbell, MapPin, Calendar, RefreshCw, Settings, Check, Loader2, Flame, Zap, Leaf, Activity, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useWorkoutPlan } from '@/hooks/useWorkoutPlan';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useWorkoutGenerator } from '@/hooks/useWorkoutGenerator';
import { supabase } from '@/integrations/supabase/client';
import { PRIMARY_GOAL_TO_TRAINING_GOAL, getRIRGuidance, PLAN_DURATION_WEEKS, SPLIT_INFO } from '@/lib/trainingGoals';
import { getCurrentDayLetter } from '@/lib/workoutRotation';
import PageTransition from '@/components/PageTransition';
import OnboardingDrawer from '@/components/OnboardingDrawer';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

// Week type based on RIR methodology
type WeekType = 'normal' | 'moderate' | 'hardcore' | 'deload';

const getWeekType = (weekNumber: number): WeekType => {
  const { rir, label } = getRIRGuidance(weekNumber);
  if (label === 'Deload') return 'deload';
  if (rir === 1) return 'hardcore';
  if (rir === 2) return 'moderate';
  return 'normal';
};

const weekTypeStyles: Record<WeekType, { bg: string; border: string; text: string; icon: React.ReactNode }> = {
  normal: { bg: 'bg-muted/50', border: 'border-border', text: 'text-muted-foreground', icon: <Activity className="w-3 h-3" /> },
  moderate: { bg: 'bg-amber-500/20', border: 'border-amber-500/30', text: 'text-amber-600', icon: <Zap className="w-3 h-3" /> },
  hardcore: { bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'text-red-600', icon: <Flame className="w-3 h-3" /> },
  deload: { bg: 'bg-green-500/20', border: 'border-green-500/30', text: 'text-green-600', icon: <Leaf className="w-3 h-3" /> }
};

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const DAY_NAME_EN: Record<string, string> = {
  'Horní tělo': 'Upper body',
  'Dolní tělo': 'Lower body',
  'Celé tělo': 'Full body',
  'Celé tělo A': 'Full body A',
  'Celé tělo B': 'Full body B',
  'Tlak': 'Push',
  'Tah': 'Pull',
  'Nohy': 'Legs',
  'Odpočinek': 'Rest',
};

const MyPlan = () => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';
  const navigate = useNavigate();

  const weekTypeLabels: Record<WeekType, string> = {
    normal: t('myplan.week_type_normal'),
    moderate: t('myplan.week_type_moderate'),
    hardcore: t('myplan.week_type_hardcore'),
    deload: t('myplan.week_type_deload'),
  };

  const GOAL_LABELS: Record<string, string> = {
    muscle_gain: t('myplan.goal_muscle_gain'),
    hypertrophy: t('myplan.goal_muscle_gain'),
    strength: t('myplan.goal_strength'),
    fat_loss: t('myplan.goal_fat_loss'),
    weight_loss: t('myplan.goal_fat_loss'),
    general_fitness: t('myplan.goal_general_fitness'),
    endurance: t('myplan.goal_general_fitness'),
  };


  const DAY_NAMES_SHORT: Record<string, string> = {
    monday: t('myplan.day_short_monday'),
    tuesday: t('myplan.day_short_tuesday'),
    wednesday: t('myplan.day_short_wednesday'),
    thursday: t('myplan.day_short_thursday'),
    friday: t('myplan.day_short_friday'),
    saturday: t('myplan.day_short_saturday'),
    sunday: t('myplan.day_short_sunday'),
  };
  const { plan, isLoading: planLoading, refetch: refetchPlan } = useWorkoutPlan();
  const { profile, isLoading: profileLoading, refetch: refetchProfile } = useUserProfile();
  const { generateWorkoutPlan, isGenerating } = useWorkoutGenerator();
  
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [viewingWeek, setViewingWeek] = useState<number>(1);
  const [planSessions, setPlanSessions] = useState<{ day_letter: string; started_at: string }[]>([]);

  const totalWeeks = PLAN_DURATION_WEEKS;

  // Training days from plan or profile
  const trainingDays = useMemo(() => {
    const days = plan?.trainingDays || profile?.training_days || [];
    return [...days].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
  }, [plan, profile]);

  const trainingDaysCount = trainingDays.length || 3;
  const totalPlanSessions = totalWeeks * trainingDaysCount;

  // Fetch actual completed sessions from DB (source of truth)
  useEffect(() => {
    const fetchSessions = async () => {
      if (!plan?.id) { setPlanSessions([]); return; }
      const { data } = await supabase
        .from('workout_sessions')
        .select('day_letter, started_at')
        .eq('plan_id', plan.id)
        .not('completed_at', 'is', null)
        .eq('is_bonus', false)
        .order('started_at', { ascending: true });
      setPlanSessions(data || []);
    };
    fetchSessions();
  }, [plan?.id]);

  const completedSessions = planSessions.length;

  // Plan = a QUEUE of workouts (like Hevy/Strong), NOT a weekday calendar.
  // Week N groups trainings (N-1)*count .. N*count-1. A week is "done" by
  // completing its trainings, so the plan stretches in real time to all of them.
  const completedCountByWeek = useMemo(() => {
    const map = new Map<number, number>();
    for (let p = 0; p < completedSessions; p++) {
      const wk = Math.floor(p / trainingDaysCount) + 1;
      map.set(wk, (map.get(wk) || 0) + 1);
    }
    return map;
  }, [completedSessions, trainingDaysCount]);

  const currentWeek = useMemo(() => {
    if (!plan) return 1;
    return Math.min(Math.floor(completedSessions / trainingDaysCount) + 1, totalWeeks);
  }, [plan, completedSessions, trainingDaysCount, totalWeeks]);

  // Initialize viewing week to current week
  useEffect(() => {
    setViewingWeek(currentWeek);
  }, [currentWeek]);

  // Progress calculation based on actual sessions
  const progressPercent = totalPlanSessions > 0 ? (completedSessions / totalPlanSessions) * 100 : 0;

  // Each card is a queue slot (no weekday lock, no "missed"):
  // - completed slots (slot < completed) show the letter actually trained ✓
  // - the slot at `completed` is the NEXT workout to do (matches Home)
  // - later slots continue the live rotation from currentDayIndex
  const weekSchedule = useMemo(() => {
    if (!plan || trainingDays.length === 0) return [];
    const dayCount = plan.dayCount || 2;
    const queueHead = plan.currentDayIndex ?? completedSessions;
    const weekStartSlot = (viewingWeek - 1) * trainingDaysCount;

    return trainingDays.map((dayOfWeek, i) => {
      const slot = weekStartSlot + i;
      const isCompleted = slot < completedSessions;
      const isNext = slot === completedSessions;

      let dayLetter: string;
      if (isCompleted) {
        const s = planSessions[slot];
        dayLetter = s ? s.day_letter.replace('_EXT', '') : getCurrentDayLetter(dayCount, slot);
      } else {
        dayLetter = getCurrentDayLetter(dayCount, queueHead + (slot - completedSessions));
      }

      return { dayOfWeek, dayLetter, isCompleted, isNext, ordinal: slot + 1 };
    });
  }, [plan, trainingDays, trainingDaysCount, viewingWeek, planSessions, completedSessions]);

  // Gym name
  const [gymName, setGymName] = useState<string | null>(null);
  
  useMemo(() => {
    const fetchGymName = async () => {
      const gymId = plan?.gymId || profile?.selected_gym_id;
      if (!gymId) {
        setGymName(null);
        return;
      }
      
      const { data } = await supabase
        .from('gyms')
        .select('name')
        .eq('id', gymId)
        .single();
      
      setGymName(data?.name || null);
    };
    
    fetchGymName();
  }, [plan?.gymId, profile?.selected_gym_id]);

  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

  // Handle plan regeneration
  const handleRegeneratePlan = useCallback(async () => {
    if (!profile?.primary_goal) {
      toast.error(t('myplan.questionnaire_missing'));
      return;
    }
    
    setIsRegenerating(true);
    
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      
      const mappedGoalId = PRIMARY_GOAL_TO_TRAINING_GOAL[profile.primary_goal];
      if (!mappedGoalId) {
        toast.error(t('myplan.invalid_goal'));
        return;
      }
      
      if (plan?.id) {
        await supabase
          .from('user_workout_plans')
          .update({ is_active: false })
          .eq('id', plan.id);
      }
      
      const selectedGymId = profile.selected_gym_id;
      const durationMinutes = profile.training_duration_minutes || 60;
      
      if (selectedGymId && profile.user_level) {
        const planId = await generateWorkoutPlan(
          selectedGymId,
          mappedGoalId,
          profile.user_level as any,
          profile.injuries || [],
          profile.equipment_preference,
          durationMinutes,
          profile.training_days || []
        );
        
        if (planId) {
          await supabase
            .from('user_workout_plans')
            .update({ training_days: profile.training_days })
            .eq('id', planId);
        }
      } else {
        await supabase
          .from('user_workout_plans')
          .insert({
            user_id: userData.user.id,
            goal_id: mappedGoalId,
            is_active: true,
            started_at: new Date().toISOString(),
            current_week: 1,
            gym_id: null,
            training_days: profile.training_days
          });
      }
      
      await supabase
        .from('user_profiles')
        .update({ current_day_index: 0 })
        .eq('user_id', userData.user.id);
      
      await refetchProfile();
      await refetchPlan();
      
      toast.success(t('myplan.new_plan_created'));
    } catch (err) {
      console.error('Error regenerating plan:', err);
      toast.error(t('myplan.plan_create_failed'));
    } finally {
      setIsRegenerating(false);
    }
  }, [profile, plan, generateWorkoutPlan, refetchProfile, refetchPlan]);

  // Loading state
  if (planLoading || profileLoading) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background safe-top">
          <div className="gradient-hero px-6 pt-8 pb-6">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-xl" />
              <Skeleton className="h-8 w-32" />
            </div>
          </div>
          <div className="px-6 py-6 space-y-6">
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        </div>
      </PageTransition>
    );
  }

  // No plan state
  if (!plan) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background safe-top">
          <div className="gradient-hero px-6 pt-8 pb-6">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="bg-background/50 backdrop-blur-sm rounded-xl"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-2xl font-bold text-foreground">{t('myplan.title')}</h1>
            </div>
          </div>
          <div className="px-6 py-6">
            <Card className="border-border rounded-2xl">
              <CardContent className="p-6 text-center">
                <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">{t('myplan.no_plan')}</h3>
                <p className="text-muted-foreground mb-4">
                  {t('myplan.no_plan_desc')}
                </p>
                <Button onClick={() => setOnboardingOpen(true)}>
                  {t('myplan.fill_questionnaire')}
                </Button>
              </CardContent>
            </Card>
          </div>
          <OnboardingDrawer open={onboardingOpen} onOpenChange={setOnboardingOpen} />
        </div>
      </PageTransition>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background safe-top pb-nav">
        {/* Header */}
        <div className="gradient-hero px-6 pt-8 pb-6">
          <motion.div
            className="flex items-center gap-3"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="bg-background/50 backdrop-blur-sm rounded-xl"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{GOAL_LABELS[plan.goalId] || plan.goalName}</h1>
              <p className="text-sm text-muted-foreground">
                {t('myplan.weeks_per_frequency', { weeks: totalWeeks, days: trainingDaysCount })}
              </p>
            </div>
          </motion.div>
        </div>

        <motion.div
          className="px-6 py-6 space-y-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Card 1: Přehled plánu (Progress + Detaily) */}
          <motion.div variants={itemVariants}>
            <Card className="border-border rounded-2xl shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  {t('myplan.plan_overview')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Progress */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">{t('myplan.total_progress')}</span>
                    <span className="text-lg font-bold text-primary">{Math.round(progressPercent)}%</span>
                  </div>
                  <Progress value={progressPercent} className="h-2" />
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('myplan.sessions_progress', { completed: completedSessions, total: totalPlanSessions })}
                  </p>
                </div>

                {/* Detaily */}
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-2">
                    <Dumbbell className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{(isEn ? SPLIT_INFO[plan.splitType]?.label : SPLIT_INFO[plan.splitType]?.labelCz) || plan.splitType}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm truncate">{gymName || t('myplan.no_gym')}</span>
                  </div>
                </div>

                {/* Tréninkové dny */}
                <div className="flex flex-wrap gap-1">
                  {trainingDays.map((day) => (
                    <Badge key={day} variant="secondary" className="text-xs">
                      {DAY_NAMES_SHORT[day]}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Card 2: Týdenní přehled s přepínáním */}
          <motion.div variants={itemVariants}>
            <Card className={cn(
              "rounded-2xl shadow-card border-2 transition-colors",
              weekTypeStyles[getWeekType(viewingWeek)].bg,
              weekTypeStyles[getWeekType(viewingWeek)].border
            )}>
              <CardContent className="p-4">
                {/* Week navigation header */}
                {(() => {
                  const weekType = getWeekType(viewingWeek);
                  const styles = weekTypeStyles[weekType];
                  const weekCompletedCount = completedCountByWeek.get(viewingWeek) || 0;
                  const isWeekCompleted = weekCompletedCount >= trainingDaysCount;
                  const isCurrent = viewingWeek === currentWeek;

                  return (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setViewingWeek(Math.max(1, viewingWeek - 1))}
                          disabled={viewingWeek <= 1}
                          className="h-9 w-9 rounded-xl"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </Button>

                        <div className="flex items-center gap-2">
                          {isWeekCompleted && (
                            <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                          <span className="text-lg font-bold">
                            {t('myplan.week', { n: viewingWeek })}
                          </span>
                          <span className={cn("text-sm", styles.text)}>
                            {weekTypeLabels[weekType]}
                          </span>
                          <Badge className={cn(
                            "text-xs",
                            styles.bg, styles.text,
                            "border", styles.border
                          )}>
                            RIR {getRIRGuidance(viewingWeek).rir}
                          </Badge>
                          {isCurrent && (
                            <Badge className="text-xs bg-primary/15 text-primary border-0">{t('myplan.current')}</Badge>
                          )}
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setViewingWeek(Math.min(totalWeeks, viewingWeek + 1))}
                          disabled={viewingWeek >= totalWeeks}
                          className="h-9 w-9 rounded-xl"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </Button>
                      </div>

                      {/* Week progress dots */}
                      <div className="flex justify-center gap-1 mb-4">
                        {Array.from({ length: totalWeeks }, (_, i) => {
                          const wn = i + 1;
                          const wCompleted = (completedCountByWeek.get(wn) || 0) >= trainingDaysCount;
                          const wCurrent = wn === currentWeek;
                          const wViewing = wn === viewingWeek;
                          return (
                            <button
                              key={wn}
                              onClick={() => setViewingWeek(wn)}
                              className={cn(
                                "h-2 rounded-full transition-all",
                                wViewing ? "w-6" : "w-2",
                                wCompleted
                                  ? "bg-green-500"
                                  : wCurrent
                                  ? "bg-primary"
                                  : "bg-muted-foreground/20"
                              )}
                            />
                          );
                        })}
                      </div>

                      {/* Days list */}
                      <div className="space-y-2">
                        {weekSchedule.length === 0 ? (
                          <div className="text-center py-4 text-muted-foreground">
                            <p className="text-sm">{t('myplan.set_training_days')}</p>
                          </div>
                        ) : (
                          weekSchedule.map((day, index) => {
                            const isDayCompleted = day.isCompleted;
                            const isToday = day.isNext; // highlight the next workout to do
                            const dayTemplate = plan.allDays?.find(d => d.dayLetter === day.dayLetter);
                            const workoutName = dayTemplate?.dayName
                              ? ((isEn && DAY_NAME_EN[dayTemplate.dayName]) ? DAY_NAME_EN[dayTemplate.dayName] : dayTemplate.dayName)
                              : t('training.workout_letter', { letter: day.dayLetter });

                            return (
                              <div
                                key={`${day.dayOfWeek}-${index}`}
                                className={cn(
                                  "flex items-center justify-between p-3 rounded-xl",
                                  isDayCompleted
                                    ? "bg-green-500/10 border border-green-500/20"
                                    : isToday
                                    ? "bg-primary/10 border border-primary/30"
                                    : "bg-background/60 border border-border/50"
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm",
                                    isDayCompleted
                                      ? "bg-green-500 text-white"
                                      : isToday
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-background text-foreground"
                                  )}>
                                    {isDayCompleted ? <Check className="w-4 h-4" /> : day.dayLetter}
                                  </div>
                                  <div>
                                    <p className={cn("font-medium text-sm", isDayCompleted && "text-green-700")}>{workoutName}</p>
                                    <p className="text-xs text-muted-foreground">{t('myplan.workout_n', { n: day.ordinal })}</p>
                                  </div>
                                </div>
                                {isDayCompleted ? (
                                  <Check className="w-4 h-4 text-green-500" />
                                ) : isToday ? (
                                  <Badge className="bg-primary/20 text-primary border-0 text-xs">{t('myplan.next_workout')}</Badge>
                                ) : null}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          </motion.div>

          {/* Action Buttons */}
          <motion.div variants={itemVariants} className="space-y-3">
            <Button
              className="w-full"
              size="lg"
              onClick={() => setShowRegenerateConfirm(true)}
              disabled={isRegenerating || isGenerating}
            >
              {(isRegenerating || isGenerating) ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{t('myplan.generating')}</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  <span>{t('myplan.regenerate')}</span>
                </>
              )}
            </Button>

            <Button
              variant="outline"
              className="w-full"
              size="lg"
              onClick={() => setOnboardingOpen(true)}
            >
              <Settings className="w-5 h-5" />
              <span>{t('myplan.change_plan')}</span>
            </Button>
          </motion.div>
        </motion.div>

        {/* Onboarding Drawer */}
        <OnboardingDrawer open={onboardingOpen} onOpenChange={setOnboardingOpen} />

        {/* Regenerate Plan Confirmation */}
        <AlertDialog open={showRegenerateConfirm} onOpenChange={setShowRegenerateConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                {t('myplan.regenerate_confirm_title')}
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2" asChild>
                <div>
                  <p>{t('myplan.regenerate_confirm_desc')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('myplan.regenerate_history_note')}
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel>{t('myplan.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setShowRegenerateConfirm(false);
                  handleRegeneratePlan();
                }}
                disabled={isRegenerating || isGenerating}
                className="gap-2 bg-amber-500 hover:bg-amber-600"
              >
                {(isRegenerating || isGenerating) ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('myplan.generating_plan')}
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    {t('myplan.yes_regenerate')}
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PageTransition>
  );
};

export default MyPlan;
