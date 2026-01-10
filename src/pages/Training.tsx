import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Dumbbell, MapPin, RefreshCw, Play, CheckCircle2, AlertCircle, Target } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useWorkoutPlan } from '@/hooks/useWorkoutPlan';
import { useWorkoutGenerator } from '@/hooks/useWorkoutGenerator';
import { usePublishedGyms } from '@/hooks/usePublishedGyms';
import { TRAINING_ROLE_NAMES } from '@/lib/trainingRoles';
import { PRIMARY_GOAL_TO_TRAINING_GOAL, TrainingGoalId } from '@/lib/trainingGoals';
import { getTrainingSchedule, getCurrentDayLetter } from '@/lib/workoutRotation';
import { supabase } from '@/integrations/supabase/client';
import PageTransition from '@/components/PageTransition';
import OnboardingWarning from '@/components/OnboardingWarning';
import OnboardingDrawer from '@/components/OnboardingDrawer';
import { cn } from '@/lib/utils';

interface TrainingGoalOption {
  id: string;
  name: string;
  description: string | null;
  day_count: number;
  duration_weeks: number | null;
}

const Training = () => {
  const navigate = useNavigate();
  const { profile, isLoading: profileLoading, updateProfile } = useUserProfile();
  const { plan, isLoading: planLoading, getCurrentDayExercises, advanceToNextDay, refetch: refetchPlan } = useWorkoutPlan();
  const { generateWorkoutPlan, isGenerating, error: generatorError } = useWorkoutGenerator();
  const { gyms } = usePublishedGyms();
  
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [isStartingWorkout, setIsStartingWorkout] = useState(false);
  const [availableGoals, setAvailableGoals] = useState<TrainingGoalOption[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [isLoadingGoals, setIsLoadingGoals] = useState(true);

  const isOnboardingComplete = profile?.onboarding_completed ?? false;
  const selectedGym = gyms.find(g => g.id === profile?.selected_gym_id);
  const currentExercises = getCurrentDayExercises();
  
  // User's training frequency (days per week)
  const trainingDays = profile?.training_days || [];
  const trainingFrequency = trainingDays.length || 3;

  // Fetch available goals
  useEffect(() => {
    const fetchGoals = async () => {
      const { data } = await supabase
        .from('training_goals')
        .select('*')
        .order('day_count');
      
      if (data) {
        setAvailableGoals(data);
      }
      setIsLoadingGoals(false);
    };
    fetchGoals();
  }, []);

  // Set default goal from profile
  useEffect(() => {
    if (profile?.primary_goal && availableGoals.length > 0) {
      const mappedGoalId = PRIMARY_GOAL_TO_TRAINING_GOAL[profile.primary_goal];
      if (mappedGoalId && !selectedGoalId) {
        setSelectedGoalId(mappedGoalId);
      }
    }
  }, [profile?.primary_goal, availableGoals, selectedGoalId]);

  const handleGeneratePlan = async () => {
    if (!profile?.selected_gym_id || !selectedGoalId || !profile?.user_level) return;
    
    await generateWorkoutPlan(
      profile.selected_gym_id,
      selectedGoalId as TrainingGoalId,
      profile.user_level,
      profile.injuries || [],
      profile.equipment_preference || null
    );
    refetchPlan();
  };

  const handleRegeneratePlan = async () => {
    if (!profile?.selected_gym_id || !profile?.user_level) return;
    
    const goalId = plan?.goalId || selectedGoalId || 'general_fitness';
    await generateWorkoutPlan(
      profile.selected_gym_id,
      goalId as TrainingGoalId,
      profile.user_level,
      profile.injuries || [],
      profile.equipment_preference || null
    );
    refetchPlan();
  };

  const handleCompleteDay = async () => {
    await advanceToNextDay();
    setIsStartingWorkout(false);
  };

  const handleSelectGym = () => {
    navigate('/map');
  };

  // Loading state
  if (profileLoading) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background p-4 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </PageTransition>
    );
  }

  // Onboarding not complete
  if (!isOnboardingComplete) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background safe-top p-4">
          <OnboardingWarning onClick={() => setOnboardingOpen(true)} />
          
          <div className="flex flex-col items-center justify-center py-16">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
                <Dumbbell className="w-10 h-10 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">Trénink je uzamčený</h2>
              <p className="text-muted-foreground mb-6">
                Pro přístup k tréninku nejdříve vyplň dotazník
              </p>
              <Button onClick={() => setOnboardingOpen(true)}>
                Vyplnit dotazník
              </Button>
            </motion.div>
          </div>

          <OnboardingDrawer open={onboardingOpen} onOpenChange={setOnboardingOpen} />
        </div>
      </PageTransition>
    );
  }

  // No gym selected
  if (!profile?.selected_gym_id) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background p-4">
          <h1 className="text-2xl font-bold mb-6">Trénink</h1>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <MapPin className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-xl font-bold mb-2">Vyber si posilovnu</h2>
            <p className="text-muted-foreground mb-6 max-w-xs mx-auto">
              Pro vygenerování tréninku potřebujeme vědět, kde budeš cvičit
            </p>
            <Button onClick={handleSelectGym} size="lg" className="gap-2">
              <MapPin className="w-5 h-5" />
              Vybrat posilovnu
            </Button>
          </motion.div>
        </div>
      </PageTransition>
    );
  }

  // No plan yet - show goal selection
  if (!plan && !planLoading && !isGenerating) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background p-4 pb-24">
          <h1 className="text-2xl font-bold mb-2">Trénink</h1>
          
          {/* Gym info */}
          <button 
            onClick={handleSelectGym}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <MapPin className="w-4 h-4" />
            <span className="text-sm">{selectedGym?.name || 'Vyber posilovnu'}</span>
            <ChevronRight className="w-4 h-4" />
          </button>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Target className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-bold mb-2">Vyber si cíl</h2>
              <p className="text-muted-foreground text-sm">
                Tvůj plán na {trainingFrequency}× týdně
              </p>
            </div>

            {/* Goal Selection */}
            <div className="space-y-3 mb-8">
              {isLoadingGoals ? (
                <>
                  <Skeleton className="h-20 w-full rounded-xl" />
                  <Skeleton className="h-20 w-full rounded-xl" />
                  <Skeleton className="h-20 w-full rounded-xl" />
                </>
              ) : (
                availableGoals.map((goal) => (
                  <motion.button
                    key={goal.id}
                    onClick={() => setSelectedGoalId(goal.id)}
                    className={cn(
                      "w-full p-4 rounded-xl border-2 transition-all text-left",
                      selectedGoalId === goal.id
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary/50"
                    )}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{goal.name}</h3>
                        {goal.description && (
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {goal.description}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {goal.day_count} tréninkové dny • {goal.duration_weeks || 8} týdnů
                        </p>
                      </div>
                      <div className={cn(
                        "w-6 h-6 rounded-full border-2 flex items-center justify-center",
                        selectedGoalId === goal.id
                          ? "border-primary bg-primary"
                          : "border-muted-foreground"
                      )}>
                        {selectedGoalId === goal.id && (
                          <CheckCircle2 className="w-4 h-4 text-primary-foreground" />
                        )}
                      </div>
                    </div>
                  </motion.button>
                ))
              )}
            </div>

            <Button 
              onClick={handleGeneratePlan} 
              size="lg" 
              className="w-full gap-2"
              disabled={!selectedGoalId || isGenerating}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Generuji plán...
                </>
              ) : (
                <>
                  <Dumbbell className="w-5 h-5" />
                  Vygenerovat plán
                </>
              )}
            </Button>
          </motion.div>
        </div>
      </PageTransition>
    );
  }

  // Plan loading or generating
  if (planLoading || isGenerating) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background p-4">
          <h1 className="text-2xl font-bold mb-6">Trénink</h1>
          
          <div className="text-center py-12">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-16 h-16 mx-auto mb-4"
            >
              <RefreshCw className="w-16 h-16 text-primary" />
            </motion.div>
            <h2 className="text-lg font-medium mb-2">Generuji tréninkový plán...</h2>
            <p className="text-muted-foreground text-sm">
              Vybíráme nejlepší cviky pro {selectedGym?.name}
            </p>
          </div>
        </div>
      </PageTransition>
    );
  }

  // Error state
  if (generatorError) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background p-4">
          <h1 className="text-2xl font-bold mb-6">Trénink</h1>
          
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-lg font-medium mb-2">Chyba při generování plánu</h2>
            <p className="text-muted-foreground text-sm mb-4">{generatorError}</p>
            <Button onClick={handleRegeneratePlan} variant="outline">
              Zkusit znovu
            </Button>
          </div>
        </div>
      </PageTransition>
    );
  }

  if (!plan) return null;

  // Get training schedule based on user's frequency
  const schedule = getTrainingSchedule(trainingDays, plan.dayCount, plan.currentDayIndex);
  const currentDayLetter = getCurrentDayLetter(plan.dayCount, plan.currentDayIndex);

  // Day names in Czech
  const dayNamesCz: Record<string, string> = {
    monday: 'Po',
    tuesday: 'Út',
    wednesday: 'St',
    thursday: 'Čt',
    friday: 'Pá',
    saturday: 'So',
    sunday: 'Ne'
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-32">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold">Trénink</h1>
            <Button variant="ghost" size="icon" onClick={handleRegeneratePlan} disabled={isGenerating}>
              <RefreshCw className={cn("w-5 h-5", isGenerating && "animate-spin")} />
            </Button>
          </div>
          
          {/* Gym info */}
          <button 
            onClick={handleSelectGym}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <MapPin className="w-4 h-4" />
            <span className="text-sm">{selectedGym?.name || 'Vyber posilovnu'}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Weekly Schedule */}
        <div className="p-4">
          <p className="text-sm text-muted-foreground mb-3">Tento týden</p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {schedule.map((day, index) => {
              const isCurrentDay = day.dayLetter === currentDayLetter && index === 0;
              const isCompleted = index < 0; // TODO: track completed days
              const dayInfo = plan.allDays.find(d => d.dayLetter === day.dayLetter);
              const dayTypeName = dayInfo?.dayName || '';
              
              return (
                <div
                  key={`${day.dayOfWeek}-${index}`}
                  className={cn(
                    "flex-shrink-0 flex flex-col items-center p-3 rounded-xl min-w-[70px] transition-all",
                    isCurrentDay
                      ? "bg-primary text-primary-foreground shadow-lg"
                      : isCompleted
                        ? "bg-muted/50 text-muted-foreground"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  <span className="text-xs font-medium mb-1">
                    {dayNamesCz[day.dayOfWeek] || day.dayOfWeek}
                  </span>
                  <span className={cn(
                    "text-lg font-bold",
                    isCurrentDay ? "text-primary-foreground" : "text-foreground"
                  )}>
                    {day.dayLetter}
                  </span>
                  {dayTypeName && (
                    <span className={cn(
                      "text-[10px] mt-0.5",
                      isCurrentDay ? "opacity-80" : "text-muted-foreground"
                    )}>
                      {dayTypeName}
                    </span>
                  )}
                  {isCurrentDay && (
                    <span className="text-[10px] mt-0.5 opacity-80">dnes</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Current Day Info */}
        {(() => {
          const currentDayInfo = plan.allDays.find(d => d.dayLetter === currentDayLetter);
          const dayTypeName = currentDayInfo?.dayName || '';
          return (
            <div className="px-4 mb-3">
              <h2 className="text-lg font-bold">
                Den {currentDayLetter} {dayTypeName && `• ${dayTypeName}`}
              </h2>
              <p className="text-sm text-muted-foreground">
                {currentExercises.length} cviků
              </p>
            </div>
          );
        })()}

        {/* Exercises List */}
        <div className="px-4 space-y-3">
          <AnimatePresence mode="wait">
            {currentExercises.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-8 text-muted-foreground"
              >
                Žádné cviky pro tento den
              </motion.div>
            ) : (
              currentExercises.map((exercise, index) => (
                <motion.div
                  key={exercise.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-base font-bold text-primary">{index + 1}</span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">
                          {exercise.exerciseName}
                        </h3>
                        
                        {/* Equipment info */}
                        {(exercise.equipment && exercise.equipment.length > 0) && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {exercise.machineName || exercise.equipment.map(eq => {
                              const eqNames: Record<string, string> = {
                                'barbell': 'Velká činka',
                                'dumbbell': 'Jednoručky',
                                'kettlebell': 'Kettlebell',
                                'cable': 'Kabel',
                                'machine': 'Stroj',
                                'bodyweight': 'Vlastní váha',
                                'free_weights': 'Volné váhy',
                              };
                              return eqNames[eq] || eq;
                            }).join(', ')}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="secondary" className="text-xs">
                            {TRAINING_ROLE_NAMES[exercise.roleId as keyof typeof TRAINING_ROLE_NAMES] || exercise.roleId}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {exercise.sets} sérií × {exercise.repMin}-{exercise.repMax} opakování
                        </p>
                      </div>

                      <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-2" />
                    </div>
                  </Card>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Action Button */}
        {currentExercises.length > 0 && (
          <div className="fixed bottom-24 left-4 right-4">
            <Button 
              size="lg" 
              className="w-full gap-2 shadow-lg"
              onClick={() => setIsStartingWorkout(true)}
            >
              <Play className="w-5 h-5" />
              Začít trénink
            </Button>
          </div>
        )}

        {/* Simple completion modal for now */}
        {isStartingWorkout && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card rounded-2xl p-6 max-w-sm w-full"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Dumbbell className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-xl font-bold mb-2">Trénink Den {currentDayLetter}</h2>
                <p className="text-muted-foreground text-sm mb-6">
                  {currentExercises.length} cviků připraveno
                </p>
                <div className="space-y-3">
                  <Button className="w-full gap-2" onClick={handleCompleteDay}>
                    <CheckCircle2 className="w-5 h-5" />
                    Dokončit trénink
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => setIsStartingWorkout(false)}>
                    Zrušit
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </PageTransition>
  );
};

export default Training;