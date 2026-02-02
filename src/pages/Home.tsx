import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useUserRole } from '@/hooks/useUserRole';
import { useWorkoutPlan } from '@/hooks/useWorkoutPlan';
import { useWorkoutStats } from '@/hooks/useWorkoutStats';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Shield, ChevronRight, Calendar, Sparkles, Check, MapPin, Dumbbell, TrendingUp, Target, Building2, Trophy } from 'lucide-react';
import pumploLogo from '@/assets/pumplo-logo.png';
import OnboardingWarning from '@/components/OnboardingWarning';
import OnboardingDrawer from '@/components/OnboardingDrawer';
import PageTransition from '@/components/PageTransition';
import HomePageSkeleton from '@/components/skeletons/HomePageSkeleton';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { WorkoutSessionCard } from '@/components/workout/WorkoutSessionCard';
import { StartWorkoutButton } from '@/components/home/StartWorkoutButton';
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
    role
  } = useUserRole();
  const {
    plan,
    isLoading: planLoading
  } = useWorkoutPlan();
  const {
    stats
  } = useWorkoutStats();
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [showSessionDetail, setShowSessionDetail] = useState(false);
  const [todayWorkoutSession, setTodayWorkoutSession] = useState<TodayWorkoutSession | null>(null);
  
  const isOnboardingComplete = profile?.onboarding_completed ?? false;

  // Check if workout was completed today
  const todaySession = stats.today.totalWorkouts > 0 ? stats.lastDays.find(d => {
    const sessionDate = new Date(d.date);
    const today = new Date();
    return sessionDate.getFullYear() === today.getFullYear() && sessionDate.getMonth() === today.getMonth() && sessionDate.getDate() === today.getDate() && d.completed;
  }) || null : null;
  const completedTodayDayLetter = todaySession?.dayLetter || null;
  const wasCompletedToday = completedTodayDayLetter !== null;

  // Fetch today's completed workout session
  useEffect(() => {
    const fetchTodaySession = async () => {
      if (!user || !wasCompletedToday) {
        setTodayWorkoutSession(null);
        return;
      }
      
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
      
      const { data } = await supabase
        .from('workout_sessions')
        .select('id, day_letter, goal_id, started_at, completed_at, duration_seconds, total_sets, total_reps, total_weight_kg')
        .eq('user_id', user.id)
        .gte('started_at', startOfDay.toISOString())
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(1)
        .single();
      
      if (data) {
        setTodayWorkoutSession(data);
      }
    };
    
    fetchTodaySession();
  }, [user, wasCompletedToday]);

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
  const currentWeek = plan ? Math.floor((plan.currentDayIndex || 0) / (plan.dayCount || 2)) + 1 : 1;
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
      <div className="min-h-screen bg-background safe-top pb-24">
        {/* Header */}
        <div className="px-6 pt-8 pb-4">
          <motion.div className="flex items-center justify-between" initial={{
          opacity: 0,
          y: -10
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          duration: 0.4
        }}>
            <div className="flex items-center gap-4">
              <img src={pumploLogo} alt="Pumplo" className="h-12 w-auto object-contain" />
            </div>
            <div className="flex items-center gap-3">
              {role === 'business' && <Link to="/business" className="flex items-center gap-2 px-3 py-2 bg-primary/10 text-primary rounded-xl text-sm font-medium">
                  <Building2 className="w-4 h-4" />
                  Business
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

        {/* Content */}
        <motion.div className="px-6 py-6 space-y-6" variants={containerVariants} initial="hidden" animate="visible">
          {/* My Plan Section */}
          {isOnboardingComplete && <>
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
                      <Button onClick={() => navigate('/training')} size="lg" className="gap-2 rounded-xl">
                        <Target className="w-5 h-5" />
                        Vytvořit plán
                      </Button>
                    </div>
                  </div>
                </motion.div>) : plan ? (/* Active plan */
          <>
                  {/* Week Progress Card */}
                  <motion.div variants={itemVariants}>
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary/90 to-accent p-6">
                      <div className="absolute right-0 top-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                      <div className="absolute left-0 bottom-0 w-32 h-32 bg-white/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
                      
                      <div className="relative">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
                              <Sparkles className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <h3 className="text-2xl font-bold text-white">Týden {currentWeek}</h3>
                              <p className="text-white/70 text-sm">{plan.goalName}</p>
                            </div>
                          </div>
                          <button onClick={() => navigate('/profile/plan')} className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center text-white hover:bg-white/30 transition-colors">
                            <ChevronRight className="w-5 h-5" />
                          </button>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-white/70">Celkový progress</span>
                            <span className="text-white font-semibold">{Math.round(weekProgress)}%</span>
                          </div>
                          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                            <motion.div className="h-full bg-white rounded-full" initial={{
                        width: 0
                      }} animate={{
                        width: `${Math.min(weekProgress, 100)}%`
                      }} transition={{
                        duration: 1,
                        ease: "easeOut"
                      }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Upcoming Training Days */}
                  <motion.div variants={itemVariants}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-foreground">Nadcházející tréninky</h3>
                      <button onClick={() => navigate('/profile/plan')} className="text-sm text-primary flex items-center gap-1 hover:underline">
                        Vše
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    {schedule.length === 0 ? <div className="bg-muted/50 rounded-2xl p-6 text-center">
                        <Calendar className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">Nastav si tréninkové dny v profilu</p>
                      </div> : <div className="space-y-3">
                        {schedule.slice(0, 4).map((day, index) => {
                  const isCurrentDay = index === 0 && day.dayOfWeek === today;
                  const isNextUp = index === 0;
                  const isCompletedToday = isCurrentDay && completedTodayDayLetter === day.dayLetter;
                  const dayTemplate = plan.allDays?.find(d => d.dayLetter === day.dayLetter);
                  const dayTypeName = dayTemplate?.dayName || '';
                  
                  // Only completed trainings are clickable
                  const isClickable = isCompletedToday;
                  
                  return <motion.div 
                    key={`${day.dayOfWeek}-${index}`} 
                    className={cn(
                      "w-full p-4 rounded-2xl text-left transition-all flex items-center justify-between",
                      isCompletedToday ? "bg-green-500/10 border-2 border-green-500/30 cursor-pointer" : 
                      isNextUp ? "bg-gradient-to-r from-primary/10 to-primary/5 border-2 border-primary/30" : 
                      "bg-card border border-border"
                    )} 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={isClickable ? () => setShowSessionDetail(true) : undefined}
                    whileTap={isClickable ? { scale: 0.98 } : undefined}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-lg", 
                        isCompletedToday ? "bg-green-500 text-white" : 
                        isNextUp ? "bg-primary text-white" : 
                        "bg-muted text-muted-foreground"
                      )}>
                        {isCompletedToday ? <Check className="w-6 h-6" /> : day.dayLetter}
                      </div>
                      
                      <div>
                        <h4 className={cn(
                          "font-semibold", 
                          isCompletedToday ? "text-green-600" : 
                          isNextUp ? "text-foreground" : 
                          "text-muted-foreground"
                        )}>
                          {dayNamesCz[day.dayOfWeek] || day.dayOfWeek}
                        </h4>
                        {dayTypeName && (
                          <p className={cn(
                            "text-sm", 
                            isCompletedToday ? "text-green-600/70" : "text-muted-foreground"
                          )}>
                            {dayTypeName}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {isCompletedToday && (
                        <span className="text-xs font-medium text-green-600 bg-green-500/20 px-3 py-1 rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Hotovo
                        </span>
                      )}
                      {isCurrentDay && !isCompletedToday && (
                        <span className="text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">
                          Dnes
                        </span>
                      )}
                    </div>
                  </motion.div>;
                })}
                      </div>}

                    {/* Start Training Button */}
                    {plan && !wasCompletedToday && (
                      <StartWorkoutButton 
                        selectedGymId={profile?.selected_gym_id || null}
                        className="mt-6"
                      />
                    )}
                  </motion.div>

                </>) : null}
            </>}
        </motion.div>

        {/* Onboarding Drawer */}
        <OnboardingDrawer open={onboardingOpen} onOpenChange={setOnboardingOpen} />

        {/* Today's Workout Detail Drawer */}
        <Drawer open={showSessionDetail} onOpenChange={setShowSessionDetail}>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader>
              <DrawerTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-green-500" />
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