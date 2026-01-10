import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Calendar, CheckCircle2, Circle, MapPin, Dumbbell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useWorkoutPlan } from '@/hooks/useWorkoutPlan';
import { getAllDayLetters } from '@/lib/workoutRotation';
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
  const [goals, setGoals] = useState<TrainingGoalWithDuration[]>([]);
  const [isSelectingPlan, setIsSelectingPlan] = useState(false);
  const [goalInfo, setGoalInfo] = useState<TrainingGoalWithDuration | null>(null);

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

  const dayLetters = plan ? getAllDayLetters(plan.dayCount) : [];

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
    <Card className="overflow-hidden">
      {/* Header with week progress */}
      <div className="p-6 pb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">Týden {currentWeek}</span>
            <span className="text-lg text-muted-foreground">z {goalInfo?.duration_weeks || 8}</span>
          </div>
          <button 
            onClick={handleSelectPlan}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {/* Chat icon placeholder */}
          </button>
        </div>
        
        <button 
          onClick={handleGoToTraining}
          className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors mb-4"
        >
          <span className="text-sm font-medium">{goalInfo?.name || 'Tréninkový plán'}</span>
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Progress bar */}
        <Progress value={weekProgress} className="h-2" />
      </div>

      {/* Day cards */}
      <div className="px-4 pb-4 space-y-2">
        {dayLetters.map((letter, index) => {
          const isCurrentDay = letter === plan.currentDayLetter;
          const isDayCompleted = index < plan.currentDayIndex % plan.dayCount;
          
          // Get day name from allDays if available
          const dayTemplate = plan.allDays?.find(d => d.dayLetter === letter);
          const dayName = dayTemplate?.dayName || `Den ${letter}`;
          
          return (
            <motion.button
              key={letter}
              onClick={handleGoToTraining}
              className={cn(
                "w-full p-4 rounded-xl border-2 text-left transition-all",
                isCurrentDay 
                  ? "border-primary bg-primary/5 shadow-md" 
                  : "border-border bg-card hover:border-muted-foreground/30"
              )}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center border-2",
                  isDayCompleted 
                    ? "bg-primary border-primary text-primary-foreground"
                    : isCurrentDay
                    ? "border-primary text-primary"
                    : "border-muted-foreground/30 text-muted-foreground"
                )}>
                  {isDayCompleted ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </div>
                
                <div>
                  <h4 className={cn(
                    "font-semibold",
                    isCurrentDay ? "text-foreground" : "text-muted-foreground"
                  )}>
                    Den {index + 1}
                  </h4>
                  <p className={cn(
                    "text-sm",
                    isCurrentDay ? "text-muted-foreground" : "text-muted-foreground/70"
                  )}>
                    {dayName}
                  </p>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </Card>
  );
};

export default MyPlanSection;
