import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Dumbbell, MapPin, RefreshCw, Play, CheckCircle2, AlertCircle } from 'lucide-react';
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
import { PRIMARY_GOAL_TO_TRAINING_GOAL } from '@/lib/trainingGoals';
import { getAllDayLetters } from '@/lib/workoutRotation';
import PageTransition from '@/components/PageTransition';
import OnboardingWarning from '@/components/OnboardingWarning';
import OnboardingDrawer from '@/components/OnboardingDrawer';
import { cn } from '@/lib/utils';

const Training = () => {
  const navigate = useNavigate();
  const { profile, isLoading: profileLoading, updateProfile } = useUserProfile();
  const { plan, isLoading: planLoading, getCurrentDayExercises, advanceToNextDay, refetch: refetchPlan } = useWorkoutPlan();
  const { generateWorkoutPlan, isGenerating, error: generatorError } = useWorkoutGenerator();
  const { gyms } = usePublishedGyms();
  
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [isStartingWorkout, setIsStartingWorkout] = useState(false);

  const isOnboardingComplete = profile?.onboarding_completed ?? false;
  const selectedGym = gyms.find(g => g.id === profile?.selected_gym_id);
  const currentExercises = getCurrentDayExercises();

  // Generate plan when gym is selected but no active plan
  useEffect(() => {
    const generatePlanIfNeeded = async () => {
      if (
        profile?.selected_gym_id && 
        profile?.primary_goal && 
        profile?.user_level &&
        !plan && 
        !planLoading && 
        !isGenerating
      ) {
        const goalId = PRIMARY_GOAL_TO_TRAINING_GOAL[profile.primary_goal] || 'general_fitness';
        await generateWorkoutPlan(
          profile.selected_gym_id,
          goalId,
          profile.user_level,
          profile.injuries || []
        );
        refetchPlan();
      }
    };
    
    generatePlanIfNeeded();
  }, [profile?.selected_gym_id, profile?.primary_goal, profile?.user_level, plan, planLoading, isGenerating]);

  const handleRegeneratePlan = async () => {
    if (!profile?.selected_gym_id || !profile?.primary_goal || !profile?.user_level) return;
    
    const goalId = PRIMARY_GOAL_TO_TRAINING_GOAL[profile.primary_goal] || 'general_fitness';
    await generateWorkoutPlan(
      profile.selected_gym_id,
      goalId,
      profile.user_level,
      profile.injuries || []
    );
    refetchPlan();
  };

  const handleCompleteDay = async () => {
    await advanceToNextDay();
    // Show success state
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

  // No plan yet
  if (!plan) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background p-4">
          <h1 className="text-2xl font-bold mb-6">Trénink</h1>
          
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Dumbbell className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-medium mb-2">Zatím nemáš plán</h2>
            <p className="text-muted-foreground text-sm mb-4">
              Vygeneruj si tréninkový plán pro svou posilovnu
            </p>
            <Button onClick={handleRegeneratePlan}>
              Vygenerovat plán
            </Button>
          </div>
        </div>
      </PageTransition>
    );
  }

  const dayLetters = getAllDayLetters(plan.dayCount);

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-24">
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

        {/* Day Selector */}
        <div className="p-4">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {dayLetters.map((letter) => (
              <button
                key={letter}
                className={cn(
                  "flex-shrink-0 w-12 h-12 rounded-full font-bold text-lg transition-all",
                  letter === plan.currentDayLetter
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {letter}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Aktuální den: <span className="font-medium text-foreground">Den {plan.currentDayLetter}</span>
          </p>
        </div>

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
                      <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <span className="text-lg font-bold text-primary">{index + 1}</span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">
                          {exercise.exerciseName || 'Cvičení nenalezeno'}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {TRAINING_ROLE_NAMES[exercise.roleId as keyof typeof TRAINING_ROLE_NAMES] || exercise.roleId}
                          </Badge>
                          {exercise.isFallback && (
                            <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                              Náhrada
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                          {exercise.sets} sérií × {exercise.repMin}-{exercise.repMax} opakování
                        </p>
                      </div>

                      <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
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
                <h2 className="text-xl font-bold mb-2">Trénink Den {plan.currentDayLetter}</h2>
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
