import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useUserRole } from '@/hooks/useUserRole';
import { useWorkoutPlan } from '@/hooks/useWorkoutPlan';
import { useWorkoutStats } from '@/hooks/useWorkoutStats';
import { useAuth } from '@/contexts/AuthContext';
import { usePausedWorkout } from '@/hooks/usePausedWorkout';
import { usePausedCustomWorkout } from '@/hooks/usePausedCustomWorkout';
import { supabase } from '@/integrations/supabase/client';
import { Shield, ChevronRight, Calendar, Sparkles, Check, MapPin, Dumbbell, TrendingUp, Target, Building2, Trophy, Flame, Zap, Star } from 'lucide-react';
import pumploWordmark from '@/assets/pumplo-wordmark.png';
import OnboardingWarning from '@/components/OnboardingWarning';
import OnboardingDrawer from '@/components/OnboardingDrawer';
import PageTransition from '@/components/PageTransition';
import HomePageSkeleton from '@/components/skeletons/HomePageSkeleton';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { WorkoutSessionCard } from '@/components/workout/WorkoutSessionCard';
import { StartWorkoutButton } from '@/components/home/StartWorkoutButton';
import { PausedWorkoutCard } from '@/components/home/PausedWorkoutCard';
import CustomPlansTab from '@/components/home/CustomPlansTab';
import { getTrainingSchedule, getCurrentWeekday } from '@/lib/workoutRotation';
import { cn } from '@/lib/utils';
interface TrainingGoalWithDuration {
  id: string;
  name: string;
  description: string;
  day_count: number;
  duration_weeks: number;
}
interface TodayWorkoutSession {
  id: string;
  day_letter: string;
  goal_id: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  total_sets: number | null;
  total_reps: number | null;
  total_weight_kg: number | null;
}

const Home = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    profile,
    isLoading
  } = useUserProfile();
  const {
    isAdmin,
    isBusiness,
    isTrainer,
    role
  } = useUserRole();
  const {
    plan,
    isLoading: planLoading,
    refetch: refetchPlan
  } = useWorkoutPlan();
  const {
    stats,
    refetch: refetchStats
  } = useWorkoutStats();
  const { pausedWorkout, clearPausedWorkout } = usePausedWorkout();
  const { pausedWorkout: pausedCustomWorkout } = usePausedCustomWorkout();
  const location = useLocation();
  const [favoriteTab, setFavoriteTab] = useState<'pumplo' | 'custom'>(() => {
    return (localStorage.getItem('pumplo_favorite_tab') as 'pumplo' | 'custom') || 'pumplo';
  });
  const [activeTab, setActiveTab] = useState<'pumplo' | 'custom'>(
    pausedCustomWorkout ? 'custom' : favoriteTab
  );

  const toggleFavorite = (tab: 'pumplo' | 'custom') => {
    setFavoriteTab(tab);
    localStorage.setItem('pumplo_favorite_tab', tab);
  };
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [showSessionDetail, setShowSessionDetail] = useState(false);
  const [todayWorkoutSession, setTodayWorkoutSession] = useState<TodayWorkoutSession | null>(null);
  
  const isOnboardingComplete = profile?.onboarding_completed ?? false;

  // Refetch plan and stats when navigating back to Home
  useEffect(() => {
    refetchPlan();
    refetchStats();
  }, [location.key]);

  // Completed today is derived from todayWorkoutSession (filtered by current plan)
  const completedTodayDayLetter = todayWorkoutSession?.day_letter || null;
  const wasCompletedToday = completedTodayDayLetter !== null;

  // Fetch today's completed workout session for the CURRENT plan
  useEffect(() => {
    const fetchTodaySession = async () => {
      if (!user || !plan) {
        setTodayWorkoutSession(null);
        return;
      }

      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);

      const { data } = await supabase
        .from('workout_sessions')
        .select('id, day_letter, goal_id, started_at, completed_at, duration_seconds, total_sets, total_reps, total_weight_kg')
        .eq('user_id', user.id)
        .eq('plan_id', plan.id)
        .gte('started_at', startOfDay.toISOString())
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setTodayWorkoutSession(data);
      } else {
        setTodayWorkoutSession(null);
      }
    };
    
    fetchTodaySession();
  }, [user, plan?.id]);

  if (isLoading) {
    return <HomePageSkeleton />;
  }

  // Training days - use snapshotted plan data when plan exists
  const trainingDays = plan?.trainingDays || profile?.training_days || [];

  // Get schedule with proper day rotation - use currentDayIndex directly for consistency with Training.tsx
  const schedule = plan ? getTrainingSchedule(trainingDays, plan.dayCount, plan.currentDayIndex || 0) : [];

  // Day names in Czech
  const dayNamesCz: Record<string, string> = {
    monday: 'Pondělí',
    tuesday: 'Úterý',
    wednesday: 'Středa',
    thursday: 'Čtvrtek',
    friday: 'Pátek',
    saturday: 'Sobota',
    sunday: 'Neděle'
  };
  const today = getCurrentWeekday();

  // Week progress calculation - use actual training days per week
  const trainingDaysCount = plan?.trainingDays?.length || trainingDays.length || 3;
  const goalDurationWeeks = 8; // default
  const totalPlanDays = goalDurationWeeks * trainingDaysCount;
  const weekProgress = plan ? (plan.currentDayIndex || 0) / totalPlanDays * 100 : 0;
  const currentWeek = plan ? Math.floor((plan.currentDayIndex || 0) / trainingDaysCount) + 1 : 1;
  const containerVariants = {
    hidden: {
      opacity: 0
    },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08
      }
    }
  };
  const itemVariants = {
    hidden: {
      opacity: 0,
      y: 20
    },
    visible: {
      opacity: 1,
      y: 0
    }
  };
  return <PageTransition>
      <div className="min-h-screen bg-background safe-top pb-24 relative">
        {/* Blue wave decoration */}
        <div className="absolute top-0 left-0 right-0 h-24 overflow-hidden pointer-events-none z-0">
          <svg viewBox="0 0 400 150" preserveAspectRatio="none" className="w-full h-full">
            <defs>
              <linearGradient id="waveGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5BC8F5" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#5BC8F5" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0,0 L400,0 L400,80 Q300,130 200,90 Q100,50 0,100 Z" fill="url(#waveGrad)" />
          </svg>
        </div>

        {/* Header */}
        <div className="relative z-10 px-6 pt-8 pb-4">
          <motion.div className="flex flex-col items-center" initial={{
          opacity: 0,
          y: -10
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          duration: 0.4
        }}>
            <div className="flex items-center">
              <img src={pumploWordmark} alt="Pumplo" className="h-8 object-contain" />
            </div>
            <div className="flex items-center gap-3 mt-3">
              {role === 'business' && <Link to="/business" className="flex items-center gap-2 px-3 py-2 bg-primary/10 text-primary rounded-xl text-sm font-medium">
                  <Building2 className="w-4 h-4" />
                  Business
                </Link>}
              {isTrainer && <Link to="/trainer-profile" className="flex items-center gap-2 px-3 py-2 bg-primary/10 text-primary rounded-xl text-sm font-medium">
                  <Dumbbell className="w-4 h-4" />
                  Trenér
                </Link>}
              {isAdmin && <Link to="/admin" className="flex items-center gap-2 px-3 py-2 bg-primary/10 text-primary rounded-xl text-sm font-medium">
                  <Shield className="w-4 h-4" />
                  Admin
                </Link>}
            </div>
          </motion.div>

          {/* Greeting */}
          <motion.div className="mt-6" initial={{
          opacity: 0,
          y: 10
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          duration: 0.4,
          delay: 0.1
        }}>
            <p className="text-muted-foreground text-sm">Ahoj,</p>
            <h1 className="text-3xl font-bold text-foreground">
              {profile?.first_name || 'Športovec'} 💪
            </h1>
          </motion.div>
        </div>

        {/* Onboarding Warning */}
        {profile && !profile.onboarding_completed && <div className="px-6">
            <OnboardingWarning onClick={() => setOnboardingOpen(true)} />
          </div>}

        {/* Tab Switch */}
        {isOnboardingComplete && (
          <div className="px-6 pt-2">
            <div className="flex gap-1 border-b border-border/50">
              <button
                onClick={() => setActiveTab('pumplo')}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all border-b-[3px] -mb-px",
                  activeTab === 'pumplo'
                    ? "border-[#5BC8F5] text-[#1A2744]"
                    : "border-transparent text-[#6B7280]"
                )}
              >
                <Zap className="w-3.5 h-3.5" />
                Pumplo trénink
                {activeTab === 'pumplo' && (
                  <span
                    onClick={(e) => { e.stopPropagation(); toggleFavorite('pumplo'); }}
                    className="ml-1"
                  >
                    <Star className={cn(
                      "w-3.5 h-3.5 transition-colors",
                      favoriteTab === 'pumplo'
                        ? "fill-amber-400 text-amber-400"
                        : "text-gray-300"
                    )} />
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('custom')}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all border-b-[3px] -mb-px",
                  activeTab === 'custom'
                    ? "border-[#5BC8F5] text-[#1A2744]"
                    : "border-transparent text-[#6B7280]"
                )}
              >
                <Dumbbell className="w-3.5 h-3.5" />
                Vlastní trénink
                {activeTab === 'custom' && (
                  <span
                    onClick={(e) => { e.stopPropagation(); toggleFavorite('custom'); }}
                    className="ml-1"
                  >
                    <Star className={cn(
                      "w-3.5 h-3.5 transition-colors",
                      favoriteTab === 'custom'
                        ? "fill-amber-400 text-amber-400"
                        : "text-gray-300"
                    )} />
                  </span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <motion.div className="px-6 py-6 space-y-6" variants={containerVariants} initial="hidden" animate="visible">
          {/* Custom Plans Tab */}
          {isOnboardingComplete && activeTab === 'custom' && (
            <motion.div variants={itemVariants}>
              <CustomPlansTab />
            </motion.div>
          )}

          {/* My Plan Section (Pumplo plán) */}
          {isOnboardingComplete && activeTab === 'pumplo' && <>
              {/* No gym selected */}
              {!profile?.selected_gym_id ? <motion.div variants={itemVariants}>
                  <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/20 p-6">
                    <div className="absolute -right-8 -top-8 w-32 h-32 bg-primary/20 rounded-full blur-3xl" />
                    <div className="absolute -left-8 -bottom-8 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
                    
                    <div className="relative">
                      <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mb-4">
                        <MapPin className="w-8 h-8 text-primary" />
                      </div>
                      <h3 className="text-xl font-bold text-foreground mb-2">Vyber si posilovnu</h3>
                      <p className="text-muted-foreground mb-6">
                        Pro vytvoření personalizovaného plánu nejdříve vyber posilovnu, kde budeš cvičit
                      </p>
                      <Button onClick={() => navigate('/map')} size="lg" className="gap-2 rounded-xl">
                        <MapPin className="w-5 h-5" />
                        Najít posilovnu
                      </Button>
                    </div>
                  </div>
                </motion.div> : !plan && !planLoading ? (/* No plan yet */
          <motion.div variants={itemVariants}>
                  <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-accent/20 via-primary/10 to-transparent border border-primary/20 p-6">
                    <div className="absolute -right-8 -top-8 w-32 h-32 bg-primary/20 rounded-full blur-3xl" />
                    <div className="absolute -left-8 -bottom-8 w-24 h-24 bg-accent/10 rounded-full blur-2xl" />
                    
                    <div className="relative">
                      <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mb-4">
                        <Dumbbell className="w-8 h-8 text-primary" />
                      </div>
                      <h3 className="text-xl font-bold text-foreground mb-2">Vytvoř si plán</h3>
                      <p className="text-muted-foreground mb-6">
                        Vyber si tréninkový cíl a začni cvičit podle personalizovaného plánu
                      </p>
                      <Button onClick={() => navigate('/my-plan')} size="lg" className="gap-2 rounded-xl">
                        <Target className="w-5 h-5" />
                        Vytvořit plán
                      </Button>
                    </div>
                  </div>
                </motion.div>) : plan ? (/* Active plan */
          <>
                  {/* Week Progress Card with next training inside */}
                  <motion.div variants={itemVariants}>
                    <div className="rounded-3xl bg-[#5BC8F5] overflow-hidden">
                      {/* Top section: Week + Goal */}
                      <div className="p-6 pb-4">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                              <Flame className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <h3 className="text-2xl font-bold text-white">Týden {currentWeek}</h3>
                              <p className="text-white/70 text-sm">{plan.goalName}</p>
                            </div>
                          </div>
                          <button onClick={() => navigate('/profile/plan')} className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white hover:bg-white/30 transition-colors">
                            <ChevronRight className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      {/* Progress section */}
                      <div className="mx-3 mb-3 rounded-2xl bg-[#3AAED8] px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white/80 text-xs font-medium">Celkový progress</span>
                          <span className="text-white font-bold text-sm">{Math.round(weekProgress)}%</span>
                        </div>
                        <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
                          <motion.div className="h-full rounded-full bg-white" initial={{
                        width: 0
                      }} animate={{
                        width: `${Math.min(weekProgress, 100)}%`
                      }} transition={{
                        duration: 1,
                        ease: "easeOut"
                      }} />
                        </div>
                      </div>

                      {/* Next training / Completed today card */}
                      <div className="mx-3 mb-3">
                        {(() => {
                          const nextDay = schedule[0];
                          if (!nextDay) return null;
                          const isCurrentDay = nextDay.dayOfWeek === today;
                          const isCompletedToday = isCurrentDay && completedTodayDayLetter === nextDay.dayLetter;
                          const dayTemplate = plan.allDays?.find(d => d.dayLetter === nextDay.dayLetter);
                          const dayTypeName = dayTemplate?.dayName || '';

                          if (isCompletedToday) {
                            const durationMin = todayWorkoutSession ? Math.round((todayWorkoutSession.duration_seconds || 0) / 60) : 0;
                            return (
                              <div
                                className="rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 p-4 cursor-pointer active:scale-[0.98] transition-transform"
                                onClick={() => setShowSessionDetail(true)}
                              >
                                <div className="flex items-center gap-3 mb-3">
                                  <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                                    <Trophy className="w-6 h-6 text-white" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-white text-base">
                                      Trénink dokončen!
                                    </p>
                                    <p className="text-white/70 text-xs">
                                      {dayNamesCz[nextDay.dayOfWeek] || nextDay.dayOfWeek}
                                      {dayTypeName && ` – ${dayTypeName}`}
                                    </p>
                                  </div>
                                  <ChevronRight className="w-5 h-5 text-white/60 shrink-0" />
                                </div>
                                {todayWorkoutSession && (
                                  <div className="grid grid-cols-3 gap-2">
                                    <div className="bg-white/15 rounded-xl px-3 py-2 text-center">
                                      <p className="text-white font-bold text-lg">{durationMin}</p>
                                      <p className="text-white/60 text-[10px] font-medium">minut</p>
                                    </div>
                                    <div className="bg-white/15 rounded-xl px-3 py-2 text-center">
                                      <p className="text-white font-bold text-lg">{todayWorkoutSession.total_sets || 0}</p>
                                      <p className="text-white/60 text-[10px] font-medium">sérií</p>
                                    </div>
                                    <div className="bg-white/15 rounded-xl px-3 py-2 text-center">
                                      <p className="text-white font-bold text-lg">{todayWorkoutSession.total_weight_kg || 0}</p>
                                      <p className="text-white/60 text-[10px] font-medium">kg celkem</p>
                                    </div>
                                  </div>
                                )}
                                <p className="text-white/50 text-[10px] text-center mt-2">Klikni pro zobrazení detailů</p>
                              </div>
                            );
                          }

                          return (
                            <div className="flex items-center gap-3 rounded-2xl p-3.5 bg-white">
                              <div className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 bg-[#5BC8F5] text-white">
                                {nextDay.dayLetter}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-[#1F2937]">
                                  {dayTypeName || `Den ${nextDay.dayLetter}`}
                                </p>
                                <p className="text-xs text-[#6B7280]">
                                  {isCurrentDay ? 'Dnešní trénink' : 'Další trénink'}
                                </p>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </motion.div>

                  {/* Paused Workout Card */}
                  {pausedWorkout && pausedWorkout.planId === plan?.id && (
                    <motion.div variants={itemVariants}>
                      <PausedWorkoutCard
                        pausedWorkout={pausedWorkout}
                        onResume={() => {
                          navigate('/training?resume=true');
                        }}
                        onDiscard={clearPausedWorkout}
                      />
                    </motion.div>
                  )}

                  {/* Start Training Button */}
                  {plan && !wasCompletedToday && !pausedWorkout && (
                    <motion.div variants={itemVariants}>
                      <StartWorkoutButton
                        selectedGymId={profile?.selected_gym_id || null}
                        className="[&_button]:bg-[#1A2744] [&_button]:h-16 [&_button]:text-lg [&_button]:font-bold [&_button]:shadow-lg [&_button]:shadow-[#1A2744]/25"
                      />
                    </motion.div>
                  )}

                </>) : null}
            </>}
        </motion.div>

        {/* Onboarding Drawer */}
        <OnboardingDrawer open={onboardingOpen} onOpenChange={setOnboardingOpen} />

        {/* Today's Workout Detail Drawer */}
        <Drawer open={showSessionDetail} onOpenChange={setShowSessionDetail}>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader className="pb-2">
              <DrawerTitle className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-green-500" />
                </div>
                Dnešní trénink dokončen
              </DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-6 overflow-y-auto">
              {todayWorkoutSession && (
                <WorkoutSessionCard
                  session={todayWorkoutSession}
                  variant="full"
                />
              )}
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </PageTransition>;
};
export default Home;