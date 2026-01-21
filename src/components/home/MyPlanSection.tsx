import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Calendar, CheckCircle2, Circle, MapPin, Dumbbell, Sparkles, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useWorkoutPlan } from '@/hooks/useWorkoutPlan';
import { useWorkoutStats } from '@/hooks/useWorkoutStats';
import { getTrainingSchedule, getCurrentWeekday } from '@/lib/workoutRotation';
import { cn } from '@/lib/utils';

interface TrainingGoalWithDuration {
  id: string;
  name: string;
  description: string;
  day_count: number;
  duration_weeks: number;
}

const MyPlanSection = () => {
  const navigate = useNavigate();
  const { profile } = useUserProfile();
  const { plan, isLoading: planLoading } = useWorkoutPlan();
  const { stats } = useWorkoutStats();
  const [goals, setGoals] = useState<TrainingGoalWithDuration[]>([]);
  const [isSelectingPlan, setIsSelectingPlan] = useState(false);
  const [goalInfo, setGoalInfo] = useState<TrainingGoalWithDuration | null>(null);
  
  // Check if workout was completed today
  const todaySession = stats.today.totalWorkouts > 0 
    ? stats.lastDays.find(d => {
        const sessionDate = new Date(d.date);
        const today = new Date();
        return sessionDate.getFullYear() === today.getFullYear() &&
               sessionDate.getMonth() === today.getMonth() &&
               sessionDate.getDate() === today.getDate() &&
               d.completed;
      }) || null
    : null;
  
  const completedTodayDayLetter = todaySession?.dayLetter || null;
  const wasCompletedToday = completedTodayDayLetter !== null;

  // Fetch all available goals
  useEffect(() => {
    const fetchGoals = async () => {
      const { data } = await supabase
        .from('training_goals')
        .select('*')
        .order('day_count');
      
      if (data) {
        setGoals(data as TrainingGoalWithDuration[]);
      }
    };
    fetchGoals();
  }, []);

  // Fetch current goal info when plan exists
  useEffect(() => {
    if (plan?.goalId && goals.length > 0) {
      const currentGoal = goals.find(g => g.id === plan.goalId);
      setGoalInfo(currentGoal || null);
    }
  }, [plan?.goalId, goals]);

  const handleSelectPlan = () => {
    if (!profile?.selected_gym_id) {
      navigate('/map');
    } else {
      setIsSelectingPlan(true);
    }
  };

  const handleGoToTraining = () => {
    navigate('/training');
  };

  const weekProgress = goalInfo 
    ? ((plan?.currentDayIndex || 0) / (goalInfo.duration_weeks * goalInfo.day_count)) * 100
    : 0;

  const currentWeek = plan 
    ? Math.floor((plan.currentDayIndex || 0) / (goalInfo?.day_count || 2)) + 1
    : 1;

  // Get training days from profile
  const trainingDays = profile?.training_days || [];
  
  // Adjust display index if workout was completed today
  const adjustedDisplayIndex = wasCompletedToday && plan
    ? (plan.currentDayIndex - 1 + plan.dayCount) % plan.dayCount
    : (plan?.currentDayIndex || 0);
  
  // Get schedule with proper day rotation (use adjusted index if completed today)
  const schedule = plan ? getTrainingSchedule(trainingDays, plan.dayCount, adjustedDisplayIndex) : [];
  
  // Map day letters to day names from allDays (shows split name, e.g., "Push", "Pull & Ramena")
  const getDayName = (dayLetter: string) => {
    const dayTemplate = plan?.allDays?.find(d => d.dayLetter === dayLetter);
    return dayTemplate?.dayName || `Trénink ${dayLetter}`;
  };

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

  // Loading state
  if (planLoading) {
    return (
      <Card className="p-6 animate-pulse">
        <div className="h-6 bg-muted rounded w-1/3 mb-4" />
        <div className="h-4 bg-muted rounded w-1/2 mb-6" />
        <div className="h-32 bg-muted rounded-xl" />
      </Card>
    );
  }

  // No gym selected - prompt to select
  if (!profile?.selected_gym_id) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Můj plán</h3>
            <p className="text-sm text-muted-foreground">Vyber posilovnu pro trénink</p>
          </div>
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-6"
        >
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <MapPin className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground mb-4">
            Pro vytvoření plánu nejdříve vyber posilovnu
          </p>
          <Button onClick={() => navigate('/map')} className="gap-2">
            <MapPin className="w-4 h-4" />
            Vybrat posilovnu
          </Button>
        </motion.div>
      </Card>
    );
  }

  // No plan yet - show plan selection
  if (!plan) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Můj plán</h3>
            <p className="text-sm text-muted-foreground">Zatím nemáš aktivní plán</p>
          </div>
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-6"
        >
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Dumbbell className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground mb-4">
            Vyber si tréninkový plán a začni cvičit
          </p>
          <Button onClick={handleGoToTraining}>
            Vytvořit plán
          </Button>
        </motion.div>
      </Card>
    );
  }

  // Active plan display
  return (
    <Card className="overflow-hidden bg-gradient-to-br from-card to-muted/30">
      {/* Header with week progress */}
      <div className="p-5 pb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-foreground">Týden {currentWeek}</span>
                <span className="text-sm text-muted-foreground">z {goalInfo?.duration_weeks || 8}</span>
              </div>
              <button 
                onClick={handleGoToTraining}
                className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
              >
                <span className="text-xs font-medium">{goalInfo?.name || 'Tréninkový plán'}</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-1">
          <Progress value={weekProgress} className="h-1.5" />
        </div>
        <p className="text-xs text-muted-foreground text-right">
          {Math.round(weekProgress)}% dokončeno
        </p>
      </div>

      {/* Day cards - using training schedule */}
      <div className="px-4 pb-4 space-y-2">
        {schedule.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nastav si tréningové dni v profile
          </p>
        ) : (
          schedule.map((day, index) => {
            const isCurrentDay = index === 0 && day.dayOfWeek === today;
            const isNextUp = index === 0;
            const isCompletedToday = isCurrentDay && completedTodayDayLetter === day.dayLetter;
            
            // Get split name from allDays - use getDayName helper
            const splitName = getDayName(day.dayLetter);
            
            return (
              <motion.button
                key={`${day.dayOfWeek}-${index}`}
                onClick={handleGoToTraining}
                className={cn(
                  "w-full p-4 rounded-xl border text-left transition-all",
                  isCompletedToday
                    ? "border-green-500 bg-green-500/10"
                    : isNextUp 
                      ? "border-primary bg-primary/5 shadow-sm" 
                      : "border-border/50 bg-card/50 hover:border-border"
                )}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm",
                      isCompletedToday
                        ? "bg-green-500 text-white"
                        : isNextUp 
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                    )}>
                      {isCompletedToday ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        day.dayLetter
                      )}
                    </div>
                    
                    <div>
                      <h4 className={cn(
                        "font-semibold text-sm",
                        isCompletedToday ? "text-green-600" : isNextUp ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {dayNamesCz[day.dayOfWeek] || day.dayOfWeek}
                      </h4>
                      {splitName && (
                        <p className={cn(
                          "text-xs",
                          isCompletedToday ? "text-green-600/70" : "text-muted-foreground"
                        )}>
                          {splitName}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {isCompletedToday && (
                      <span className="text-xs font-medium text-green-600 bg-green-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Hotovo
                      </span>
                    )}
                    {isCurrentDay && !isCompletedToday && (
                      <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        Dnes
                      </span>
                    )}
                  </div>
                </div>
              </motion.button>
            );
          })
        )}
      </div>
    </Card>
  );
};

export default MyPlanSection;
