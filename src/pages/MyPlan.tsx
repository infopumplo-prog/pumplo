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
import { PRIMARY_GOAL_TO_TRAINING_GOAL, getRIRGuidance, PLAN_DURATION_WEEKS } from '@/lib/trainingGoals';
import { getTrainingSchedule, getCurrentWeekday } from '@/lib/workoutRotation';
import PageTransition from '@/components/PageTransition';
import OnboardingDrawer from '@/components/OnboardingDrawer';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
  normal: { 
    bg: 'bg-muted/50', 
    border: 'border-border', 
    text: 'text-muted-foreground',
    icon: <Activity className="w-3 h-3" />
  },
  moderate: { 
    bg: 'bg-amber-500/20', 
    border: 'border-amber-500/30', 
    text: 'text-amber-600',
    icon: <Zap className="w-3 h-3" />
  },
  hardcore: { 
    bg: 'bg-red-500/20', 
    border: 'border-red-500/30', 
    text: 'text-red-600',
    icon: <Flame className="w-3 h-3" />
  },
  deload: { 
    bg: 'bg-green-500/20', 
    border: 'border-green-500/30', 
    text: 'text-green-600',
    icon: <Leaf className="w-3 h-3" />
  }
};

const weekTypeLabels: Record<WeekType, string> = {
  normal: 'Normální',
  moderate: 'Náročný',
  hardcore: 'Hardcore',
  deload: 'Deload'
};

// Split type labels in Czech
const SPLIT_TYPE_LABELS: Record<string, string> = {
  full_body: 'Full Body',
  upper_lower: 'Upper/Lower',
  ppl: 'Push/Pull/Legs'
};

// Goal labels in Czech
const GOAL_LABELS: Record<string, string> = {
  muscle_gain: 'Nabrat svaly',
  hypertrophy: 'Nabrat svaly',
  strength: 'Získat sílu',
  fat_loss: 'Zhubnout',
  weight_loss: 'Zhubnout',
  general_fitness: 'Celková kondice',
  endurance: 'Celková kondice'
};

// Day names in Czech
const DAY_NAMES_CZ: Record<string, string> = {
  monday: 'Pondělí',
  tuesday: 'Úterý',
  wednesday: 'Středa',
  thursday: 'Čtvrtek',
  friday: 'Pátek',
  saturday: 'Sobota',
  sunday: 'Neděle'
};

const DAY_NAMES_SHORT: Record<string, string> = {
  monday: 'Po',
  tuesday: 'Út',
  wednesday: 'St',
  thursday: 'Čt',
  friday: 'Pá',
  saturday: 'So',
  sunday: 'Ne'
};

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const MyPlan = () => {
  const navigate = useNavigate();
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

  // Map sessions to weeks: count how many sessions completed per week
  const completedCountByWeek = useMemo(() => {
    const map = new Map<number, number>();
    planSessions.forEach((_, i) => {
      const week = Math.floor(i / trainingDaysCount) + 1;
      map.set(week, (map.get(week) || 0) + 1);
    });
    return map;
  }, [planSessions, trainingDaysCount]);

  // Current week based on actual completed sessions
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

  // Get schedule for viewing
  const schedule = useMemo(() => {
    if (!plan) return [];
    return getTrainingSchedule(trainingDays, plan.dayCount, plan.currentDayIndex || 0);
  }, [plan, trainingDays]);

  const today = getCurrentWeekday();

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
      toast.error('Nejprve vyplňte dotazník');
      return;
    }
    
    setIsRegenerating(true);
    
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      
      const mappedGoalId = PRIMARY_GOAL_TO_TRAINING_GOAL[profile.primary_goal];
      if (!mappedGoalId) {
        toast.error('Neplatný cíl tréninku');
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
      
      toast.success('Nový plán byl vytvořen! 🎉');
    } catch (err) {
      console.error('Error regenerating plan:', err);
      toast.error('Nepodařilo se vytvořit nový plán');
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
              <h1 className="text-2xl font-bold text-foreground">Můj plán</h1>
            </div>
          </div>
          <div className="px-6 py-6">
            <Card className="border-border rounded-2xl">
              <CardContent className="p-6 text-center">
                <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Žádný aktivní plán</h3>
                <p className="text-muted-foreground mb-4">
                  Vyplňte dotazník pro vytvoření tréninkového plánu.
                </p>
                <Button onClick={() => setOnboardingOpen(true)}>
                  Vyplnit dotazník
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
      <div className="min-h-screen bg-background safe-top pb-24">
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
                {totalWeeks} týdnů • {trainingDaysCount}× týdně
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
                  Přehled plánu
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Progress */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">Celkový progress</span>
                    <span className="text-lg font-bold text-primary">{Math.round(progressPercent)}%</span>
                  </div>
                  <Progress value={progressPercent} className="h-2" />
                  <p className="text-sm text-muted-foreground mt-1">
                    {completedSessions}/{totalPlanSessions} tréninků
                  </p>
                </div>

                {/* Detaily */}
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-2">
                    <Dumbbell className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{SPLIT_TYPE_LABELS[plan.splitType] || plan.splitType}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm truncate">{gymName || 'Nevybráno'}</span>
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
                            Týden {viewingWeek}
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
                            <Badge className="text-xs bg-primary/15 text-primary border-0">Aktuální</Badge>
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
                        {schedule.length === 0 ? (
                          <div className="text-center py-4 text-muted-foreground">
                            <p className="text-sm">Nastav si tréninkové dny</p>
                          </div>
                        ) : (
                          schedule.slice(0, trainingDaysCount).map((day, index) => {
                            const isDayCompleted = index < weekCompletedCount;
                            const isToday = viewingWeek === currentWeek && day.dayOfWeek === today;
                            const dayTemplate = plan.allDays?.find(d => d.dayLetter === day.dayLetter);

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
                                    <p className={cn("font-medium text-sm", isDayCompleted && "text-green-700")}>{DAY_NAMES_CZ[day.dayOfWeek]}</p>
                                    {dayTemplate?.dayName && (
                                      <p className="text-xs text-muted-foreground">{dayTemplate.dayName}</p>
                                    )}
                                  </div>
                                </div>
                                {isDayCompleted ? (
                                  <Check className="w-4 h-4 text-green-500" />
                                ) : isToday ? (
                                  <Badge className="bg-primary/20 text-primary border-0 text-xs">Dnes</Badge>
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
                  <span>Generuji...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  <span>Regenerovat plán</span>
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
              <span>Změnit plán</span>
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
                Regenerovat plán?
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2" asChild>
                <div>
                  <p>
                    Aktuální tréninkový plán bude <strong>smazán a nepůjde obnovit</strong>.
                    Vytvoří se nový plán podle tvého profilu a aktuální posilovny.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Tvůj streak a historie tréninků zůstanou zachovány.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel>Zrušit</AlertDialogCancel>
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
                    Generuji plán...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Ano, regenerovat
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
