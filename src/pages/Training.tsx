import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Dumbbell, MapPin, RefreshCw, Play, CheckCircle2, AlertCircle, Target, X, Check, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useWorkoutPlan } from '@/hooks/useWorkoutPlan';
import { useWorkoutGenerator } from '@/hooks/useWorkoutGenerator';
import { useWorkoutStats } from '@/hooks/useWorkoutStats';
import { TRAINING_ROLE_NAMES, TrainingRoleId, TRAINING_ROLE_IDS } from '@/lib/trainingRoles';
import { PRIMARY_GOAL_TO_TRAINING_GOAL, TrainingGoalId, WorkoutExercise } from '@/lib/trainingGoals';
import { getTrainingSchedule, getCurrentDayLetter, getCurrentWeekday } from '@/lib/workoutRotation';
import { supabase } from '@/integrations/supabase/client';
import PageTransition from '@/components/PageTransition';
import OnboardingWarning from '@/components/OnboardingWarning';
import OnboardingDrawer from '@/components/OnboardingDrawer';
import { WorkoutSession } from '@/components/workout/WorkoutSession';
import { GymSelector } from '@/components/workout/GymSelector';
import { ExtendWorkoutSelector } from '@/components/workout/ExtendWorkoutSelector';
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
  const { stats } = useWorkoutStats();
  
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [showGymSelector, setShowGymSelector] = useState(false);
  const [selectedWorkoutGymId, setSelectedWorkoutGymId] = useState<string | null>(null);
  const [generatedExercises, setGeneratedExercises] = useState<WorkoutExercise[]>([]);
  const [isGeneratingDayExercises, setIsGeneratingDayExercises] = useState(false);
  const [availableGoals, setAvailableGoals] = useState<TrainingGoalOption[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [isLoadingGoals, setIsLoadingGoals] = useState(true);
  const [extendedExercises, setExtendedExercises] = useState<WorkoutExercise[]>([]);
  const [isGeneratingExtension, setIsGeneratingExtension] = useState(false);
  const [showExtendWorkout, setShowExtendWorkout] = useState(false);

  const isOnboardingComplete = profile?.onboarding_completed ?? false;
  
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

  // Set default goal from profile - prioritize training_split, then primary_goal
  useEffect(() => {
    if (availableGoals.length > 0 && !selectedGoalId) {
      // First check training_split (ppl = muscle_gain, full_body = fat_loss/general_fitness)
      if (profile?.training_split) {
        if (profile.training_split === 'ppl') {
          setSelectedGoalId('muscle_gain');
          return;
        } else if (profile.training_split === 'full_body') {
          // For full_body, use primary_goal to determine, default to general_fitness
          const mappedGoalId = profile.primary_goal ? PRIMARY_GOAL_TO_TRAINING_GOAL[profile.primary_goal] : 'general_fitness';
          setSelectedGoalId(mappedGoalId || 'general_fitness');
          return;
        }
      }
      
      // Fallback to primary_goal mapping
      if (profile?.primary_goal) {
        const mappedGoalId = PRIMARY_GOAL_TO_TRAINING_GOAL[profile.primary_goal];
        if (mappedGoalId) {
          setSelectedGoalId(mappedGoalId);
        }
      }
    }
  }, [profile?.primary_goal, profile?.training_split, availableGoals, selectedGoalId]);

  // Create a plan structure without exercises (just schedule)
  const handleCreatePlanSchedule = async () => {
    if (!selectedGoalId || !profile?.user_level) return;
    
    // Create plan without gym_id - exercises will be generated when gym is selected
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;

    // Deactivate existing plans
    await supabase
      .from('user_workout_plans')
      .update({ is_active: false })
      .eq('user_id', user.user.id);

    // Create new plan without gym_id (will be set when exercises are generated)
    const { error } = await supabase
      .from('user_workout_plans')
      .insert({
        user_id: user.user.id,
        goal_id: selectedGoalId,
        is_active: true,
        gym_id: null
      });

    if (!error) {
      refetchPlan();
    }
  };

  // Generate exercises for current day based on selected gym (without starting workout)
  const handleGenerateDayExercises = useCallback(async (gymId: string, startWorkoutAfter: boolean = false) => {
    if (!plan || !profile?.user_level) return;

    setIsGeneratingDayExercises(true);
    
    try {
      // Generate exercises using the workout generator for just this day
      const exercises = await generateExercisesForDay(
        gymId,
        plan.goalId,
        plan.currentDayLetter,
        profile.user_level,
        profile.injuries || [],
        profile.equipment_preference || null
      );
      
      setGeneratedExercises(exercises);
      setSelectedWorkoutGymId(gymId);
      setShowGymSelector(false);
      
      // Only start workout if explicitly requested (from button click)
      if (startWorkoutAfter) {
        setIsWorkoutActive(true);
      }
    } catch (err) {
      console.error('Error generating day exercises:', err);
    } finally {
      setIsGeneratingDayExercises(false);
    }
  }, [plan, profile]);

  // Generate exercises for a specific day
  const generateExercisesForDay = async (
    gymId: string,
    goalId: TrainingGoalId,
    dayLetter: string,
    userLevel: string,
    userInjuries: string[],
    equipmentPreference: string | null
  ): Promise<WorkoutExercise[]> => {
    // Get day template for this day
    const { data: templates } = await supabase
      .from('day_templates')
      .select('*')
      .eq('goal_id', goalId)
      .eq('day_letter', dayLetter)
      .order('slot_order');

    if (!templates || templates.length === 0) return [];

    // Get gym equipment
    const { data: gymMachines } = await supabase
      .from('gym_machines')
      .select('machine_id, machines(id, equipment_type)')
      .eq('gym_id', gymId);

    const rawEquipmentTypes = gymMachines?.map(m => (m.machines as any)?.equipment_type).filter(Boolean) || [];
    
    // Expand equipment types
    const expandedEquipment = new Set<string>(rawEquipmentTypes);
    if (rawEquipmentTypes.includes('free_weights')) {
      expandedEquipment.add('barbell');
      expandedEquipment.add('dumbbell');
      expandedEquipment.add('kettlebell');
    }
    if (rawEquipmentTypes.includes('machine')) {
      expandedEquipment.add('machine');
      expandedEquipment.add('cable');
      expandedEquipment.add('plate_loaded');
    }
    expandedEquipment.add('bodyweight');

    const availableEquipmentTypes = Array.from(expandedEquipment);
    const usedExerciseIds: string[] = [];
    const exercises: WorkoutExercise[] = [];

    for (const slot of templates) {
      // Fetch exercises for this role
      const { data: roleExercises } = await supabase
        .from('exercises')
        .select('*')
        .eq('primary_role', slot.role_id);

      if (!roleExercises || roleExercises.length === 0) continue;

      // Filter exercises
      const levelNumber = userLevel === 'beginner' ? 1 : userLevel === 'intermediate' ? 2 : 3;
      const activeInjuries = userInjuries.filter(i => i && i !== 'none');

      let filteredExercises = roleExercises.filter(ex => {
        if (ex.difficulty && ex.difficulty > levelNumber * 2) return false;
        if (usedExerciseIds.includes(ex.id)) return false;
        
        // Injury filter
        if (activeInjuries.length > 0 && ex.contraindicated_injuries?.length > 0) {
          const hasContraindication = ex.contraindicated_injuries.some((injury: string) =>
            activeInjuries.some(userInjury => 
              injury.toLowerCase().includes(userInjury.toLowerCase()) ||
              userInjury.toLowerCase().includes(injury.toLowerCase())
            )
          );
          if (hasContraindication) return false;
        }

        // Equipment filter
        const exEquipment = ex.equipment || [];
        if (exEquipment.includes('bodyweight')) return true;
        if (exEquipment.some((eq: string) => ['barbell', 'dumbbell', 'kettlebell', 'free_weights'].includes(eq))) {
          return rawEquipmentTypes.includes('free_weights') || availableEquipmentTypes.some(t => exEquipment.includes(t));
        }
        if (exEquipment.includes('cable')) {
          return availableEquipmentTypes.includes('cable') || rawEquipmentTypes.includes('machine');
        }
        if (exEquipment.some((eq: string) => ['machine', 'plate_loaded'].includes(eq))) {
          return rawEquipmentTypes.includes('machine') || rawEquipmentTypes.includes('plate_loaded');
        }
        return exEquipment.some((eq: string) => availableEquipmentTypes.includes(eq));
      });

      // Apply preference sorting
      if (equipmentPreference === 'machines') {
        const machineExercises = filteredExercises.filter(ex =>
          ex.equipment?.some((eq: string) => ['machine', 'cable', 'plate_loaded'].includes(eq))
        );
        if (machineExercises.length > 0) filteredExercises = machineExercises;
      } else if (equipmentPreference === 'free_weights') {
        const fwExercises = filteredExercises.filter(ex =>
          ex.equipment?.some((eq: string) => ['barbell', 'dumbbell', 'kettlebell', 'free_weights'].includes(eq))
        );
        if (fwExercises.length > 0) filteredExercises = fwExercises;
      } else if (equipmentPreference === 'bodyweight') {
        const bwExercises = filteredExercises.filter(ex => ex.equipment?.includes('bodyweight'));
        if (bwExercises.length > 0) filteredExercises = bwExercises;
      }

      if (filteredExercises.length === 0) continue;

      // Pick random exercise
      const randomIndex = Math.floor(Math.random() * Math.min(3, filteredExercises.length));
      const selectedExercise = filteredExercises[randomIndex];
      usedExerciseIds.push(selectedExercise.id);

      // Determine sets based on level
      const sets = userLevel === 'beginner' ? slot.beginner_sets :
                   userLevel === 'intermediate' ? slot.intermediate_sets : slot.advanced_sets;

      exercises.push({
        id: `temp-${slot.id}`,
        dayLetter: slot.day_letter,
        slotOrder: slot.slot_order,
        roleId: slot.role_id,
        exerciseId: selectedExercise.id,
        exerciseName: selectedExercise.name,
        equipment: selectedExercise.equipment || [],
        machineName: null,
        sets: sets,
        repMin: slot.rep_min || 8,
        repMax: slot.rep_max || 12,
        isFallback: false,
        fallbackReason: null
      });
    }

    return exercises;
  };

  // Get current exercises from plan
  const currentExercises = plan ? getCurrentDayExercises() : [];

  // Auto-generate exercises when gym is selected and plan exists but no exercises
  useEffect(() => {
    const autoGenerateExercises = async () => {
      const exercisesFromPlan = getCurrentDayExercises();
      if (plan && profile?.selected_gym_id && profile?.user_level && exercisesFromPlan.length === 0 && !isGeneratingDayExercises && generatedExercises.length === 0) {
        // Only auto-generate if we have a plan, gym selected, but no exercises yet
        handleGenerateDayExercises(profile.selected_gym_id);
      }
    };
    
    autoGenerateExercises();
  }, [plan?.id, profile?.selected_gym_id, profile?.user_level, generatedExercises.length]);

  const handleStartWorkout = () => {
    // Check if we have pre-generated exercises from the plan
    if (currentExercises.length > 0 && plan?.gymId) {
      // Plan already has exercises, use them
      setGeneratedExercises(currentExercises);
      setSelectedWorkoutGymId(plan.gymId);
      setIsWorkoutActive(true);
    } else if (generatedExercises.length > 0 && selectedWorkoutGymId) {
      // We have dynamically generated exercises ready - start workout
      setIsWorkoutActive(true);
    } else if (profile?.selected_gym_id) {
      // Generate exercises AND start workout after
      handleGenerateDayExercises(profile.selected_gym_id, true);
    } else {
      // Need to select gym first
      setShowGymSelector(true);
    }
  };

  const handleGymSelected = (gymId: string) => {
    // When user selects gym from selector, generate exercises AND start workout
    handleGenerateDayExercises(gymId, true);
  };

  const handleCompleteWorkout = async (results: any) => {
    console.log('Workout completed:', results);
    await advanceToNextDay();
    setIsWorkoutActive(false);
    setGeneratedExercises([]);
    setExtendedExercises([]);
    setSelectedWorkoutGymId(null);
  };

  const handleCancelWorkout = () => {
    setIsWorkoutActive(false);
    setGeneratedExercises([]);
    setExtendedExercises([]);
    setSelectedWorkoutGymId(null);
  };

  const handleCancelPlan = async () => {
    if (!plan) return;
    
    // Delete the current plan (exercises will cascade)
    await supabase
      .from('user_workout_exercises')
      .delete()
      .eq('plan_id', plan.id);
    
    await supabase
      .from('user_workout_plans')
      .delete()
      .eq('id', plan.id);
    
    // Reset selection and refetch
    setSelectedGoalId(null);
    refetchPlan();
  };

  // Generate extension exercises (extra exercises for today)
  const generateExtensionExercises = async (count: number) => {
    if (!plan || !profile?.selected_gym_id || !profile?.user_level) return;
    
    setIsGeneratingExtension(true);
    
    try {
      const gymId = profile.selected_gym_id;
      
      // Get gym equipment
      const { data: gymMachines } = await supabase
        .from('gym_machines')
        .select('machine_id, machines(id, equipment_type)')
        .eq('gym_id', gymId);

      const rawEquipmentTypes = gymMachines?.map(m => (m.machines as any)?.equipment_type).filter(Boolean) || [];
      
      // Expand equipment types
      const expandedEquipment = new Set<string>(rawEquipmentTypes);
      if (rawEquipmentTypes.includes('free_weights')) {
        expandedEquipment.add('barbell');
        expandedEquipment.add('dumbbell');
        expandedEquipment.add('kettlebell');
      }
      if (rawEquipmentTypes.includes('machine')) {
        expandedEquipment.add('machine');
        expandedEquipment.add('cable');
        expandedEquipment.add('plate_loaded');
      }
      expandedEquipment.add('bodyweight');

      const availableEquipmentTypes = Array.from(expandedEquipment);
      
      // Get all available roles to pick from
      const availableRoles = [...TRAINING_ROLE_IDS];
      
      // Shuffle roles for variety
      const shuffledRoles = availableRoles.sort(() => Math.random() - 0.5);
      
      const exercises: WorkoutExercise[] = [];
      const usedExerciseIds: string[] = [];
      const userLevel = profile.user_level;
      const userInjuries = profile.injuries || [];
      const equipmentPreference = profile.equipment_preference || null;
      const levelNumber = userLevel === 'beginner' ? 1 : userLevel === 'intermediate' ? 2 : 3;
      const activeInjuries = userInjuries.filter(i => i && i !== 'none');

      for (let i = 0; i < count && i < shuffledRoles.length; i++) {
        const roleId = shuffledRoles[i];
        
        // Fetch exercises for this role
        const { data: roleExercises } = await supabase
          .from('exercises')
          .select('*')
          .eq('primary_role', roleId);

        if (!roleExercises || roleExercises.length === 0) continue;

        // Filter exercises
        let filteredExercises = roleExercises.filter(ex => {
          if (ex.difficulty && ex.difficulty > levelNumber * 2) return false;
          if (usedExerciseIds.includes(ex.id)) return false;
          
          // Injury filter
          if (activeInjuries.length > 0 && ex.contraindicated_injuries?.length > 0) {
            const hasContraindication = ex.contraindicated_injuries.some((injury: string) =>
              activeInjuries.some(userInjury => 
                injury.toLowerCase().includes(userInjury.toLowerCase()) ||
                userInjury.toLowerCase().includes(injury.toLowerCase())
              )
            );
            if (hasContraindication) return false;
          }

          // Equipment filter
          const exEquipment = ex.equipment || [];
          if (exEquipment.includes('bodyweight')) return true;
          if (exEquipment.some((eq: string) => ['barbell', 'dumbbell', 'kettlebell', 'free_weights'].includes(eq))) {
            return rawEquipmentTypes.includes('free_weights') || availableEquipmentTypes.some(t => exEquipment.includes(t));
          }
          if (exEquipment.includes('cable')) {
            return availableEquipmentTypes.includes('cable') || rawEquipmentTypes.includes('machine');
          }
          if (exEquipment.some((eq: string) => ['machine', 'plate_loaded'].includes(eq))) {
            return rawEquipmentTypes.includes('machine') || rawEquipmentTypes.includes('plate_loaded');
          }
          return exEquipment.some((eq: string) => availableEquipmentTypes.includes(eq));
        });

        // Apply preference sorting
        if (equipmentPreference === 'machines') {
          const machineExercises = filteredExercises.filter(ex =>
            ex.equipment?.some((eq: string) => ['machine', 'cable', 'plate_loaded'].includes(eq))
          );
          if (machineExercises.length > 0) filteredExercises = machineExercises;
        } else if (equipmentPreference === 'free_weights') {
          const fwExercises = filteredExercises.filter(ex =>
            ex.equipment?.some((eq: string) => ['barbell', 'dumbbell', 'kettlebell', 'free_weights'].includes(eq))
          );
          if (fwExercises.length > 0) filteredExercises = fwExercises;
        } else if (equipmentPreference === 'bodyweight') {
          const bwExercises = filteredExercises.filter(ex => ex.equipment?.includes('bodyweight'));
          if (bwExercises.length > 0) filteredExercises = bwExercises;
        }

        if (filteredExercises.length === 0) continue;

        // Pick random exercise
        const randomIndex = Math.floor(Math.random() * Math.min(3, filteredExercises.length));
        const selectedExercise = filteredExercises[randomIndex];
        usedExerciseIds.push(selectedExercise.id);

        // Determine sets based on level (3 sets default for extensions)
        const sets = userLevel === 'beginner' ? 2 : userLevel === 'intermediate' ? 3 : 4;

        exercises.push({
          id: `ext-${roleId}-${i}`,
          dayLetter: 'EXT',
          slotOrder: i + 1,
          roleId: roleId,
          exerciseId: selectedExercise.id,
          exerciseName: selectedExercise.name,
          equipment: selectedExercise.equipment || [],
          machineName: null,
          sets: sets,
          repMin: 8,
          repMax: 12,
          isFallback: false,
          fallbackReason: null
        });
      }

      setExtendedExercises(exercises);
      setShowExtendWorkout(false);
      
      // Start extended workout
      if (exercises.length > 0) {
        setGeneratedExercises(exercises);
        setSelectedWorkoutGymId(gymId);
        setIsWorkoutActive(true);
      }
    } catch (err) {
      console.error('Error generating extension exercises:', err);
    } finally {
      setIsGeneratingExtension(false);
    }
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

  // No plan yet - show goal selection (no gym required)
  if (!plan && !planLoading && !isGenerating) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background p-4 pb-24">
          <h1 className="text-2xl font-bold mb-6">Trénink</h1>

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
              onClick={handleCreatePlanSchedule} 
              size="lg" 
              className="w-full gap-2"
              disabled={!selectedGoalId}
            >
              <Dumbbell className="w-5 h-5" />
              Vytvořit plán
            </Button>
          </motion.div>
        </div>
      </PageTransition>
    );
  }

  // Plan loading
  if (planLoading) {
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
            <h2 className="text-lg font-medium mb-2">Načítám tréninkový plán...</h2>
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
          </div>
        </div>
      </PageTransition>
    );
  }

  if (!plan) return null;

  // Check if workout was completed today - we need this BEFORE calculating schedule
  const todaySession = stats.today.totalWorkouts > 0 
    ? stats.lastDays.find(d => {
        const sessionDate = new Date(d.date);
        const now = new Date();
        return sessionDate.getFullYear() === now.getFullYear() &&
               sessionDate.getMonth() === now.getMonth() &&
               sessionDate.getDate() === now.getDate() &&
               d.completed;
      }) || null
    : null;
  
  const completedTodayDayLetter = todaySession?.dayLetter || null;
  const wasCompletedToday = completedTodayDayLetter !== null;
  
  // If workout was completed today, we need to show the schedule as it was BEFORE the index was advanced
  // After completing, current_day_index is incremented. To show original mapping, use (index - 1 + dayCount) % dayCount
  const adjustedDisplayIndex = wasCompletedToday 
    ? (plan.currentDayIndex - 1 + plan.dayCount) % plan.dayCount
    : plan.currentDayIndex;

  // Get training schedule based on user's frequency (use adjusted index if completed today)
  const schedule = getTrainingSchedule(trainingDays, plan.dayCount, adjustedDisplayIndex);
  const currentDayLetter = getCurrentDayLetter(plan.dayCount, adjustedDisplayIndex);
  const today = getCurrentWeekday();

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
            <div>
              <h1 className="text-2xl font-bold">Trénink</h1>
              {plan && (
                <p className="text-sm text-primary font-medium">{plan.goalName}</p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={handleCancelPlan} title="Změnit cíl">
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Weekly Schedule */}
        <div className="p-4">
          <p className="text-sm text-muted-foreground mb-3">Tento týden</p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {schedule.map((day, index) => {
              const isCurrentDay = day.dayLetter === currentDayLetter && index === 0;
              const isTodayWeekday = day.dayOfWeek === today && index === 0;
              const isCompletedToday = isTodayWeekday && completedTodayDayLetter === day.dayLetter;
              const dayInfo = plan.allDays.find(d => d.dayLetter === day.dayLetter);
              const dayTypeName = dayInfo?.dayName || '';
              
              return (
                <div
                  key={`${day.dayOfWeek}-${index}`}
                  className={cn(
                    "flex-shrink-0 flex flex-col items-center p-3 rounded-xl min-w-[70px] transition-all",
                    isCompletedToday
                      ? "bg-green-500 text-white shadow-lg"
                      : isCurrentDay
                        ? "bg-primary text-primary-foreground shadow-lg"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  <span className="text-xs font-medium mb-1">
                    {dayNamesCz[day.dayOfWeek] || day.dayOfWeek}
                  </span>
                  <span className={cn(
                    "text-lg font-bold flex items-center justify-center",
                    isCompletedToday ? "text-white" : isCurrentDay ? "text-primary-foreground" : "text-foreground"
                  )}>
                    {isCompletedToday ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      day.dayLetter
                    )}
                  </span>
                  {dayTypeName && (
                    <span className={cn(
                      "text-[10px] mt-0.5",
                      isCompletedToday ? "opacity-80" : isCurrentDay ? "opacity-80" : "text-muted-foreground"
                    )}>
                      {dayTypeName}
                    </span>
                  )}
                  {isCompletedToday ? (
                    <span className="text-[10px] mt-0.5 opacity-80">hotovo</span>
                  ) : isCurrentDay && (
                    <span className="text-[10px] mt-0.5 opacity-80">dnes</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Show extend workout option if workout is completed today */}
        {wasCompletedToday && !isWorkoutActive && (
          <div className="px-4 mb-4">
            <ExtendWorkoutSelector 
              onConfirm={generateExtensionExercises}
              isLoading={isGeneratingExtension}
            />
          </div>
        )}

        {/* Current Day Info - only show if not completed today or showing extension */}
        {!wasCompletedToday && (() => {
          const currentDayInfo = plan.allDays.find(d => d.dayLetter === currentDayLetter);
          const dayTypeName = currentDayInfo?.dayName || '';
          // Use generated exercises if available, otherwise from plan
          const displayExercises = generatedExercises.length > 0 ? generatedExercises : currentExercises;
          const hasGymSelected = !!profile?.selected_gym_id;
          
          return (
            <div className="px-4 mb-3">
              <h2 className="text-lg font-bold">
                Den {currentDayLetter} {dayTypeName && `• ${dayTypeName}`}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isGeneratingDayExercises 
                  ? 'Generuji cviky...'
                  : displayExercises.length > 0 
                    ? `${displayExercises.length} cviků`
                    : hasGymSelected
                      ? 'Cviky sa generujú...'
                      : 'Vyber posilovnu na mape'
                }
              </p>
            </div>
          );
        })()}

        {/* Exercises List or Placeholder - only show if not completed today */}
        {!wasCompletedToday && (
          <div className="px-4 space-y-3">
            <AnimatePresence mode="wait">
              {(() => {
                const displayExercises = generatedExercises.length > 0 ? generatedExercises : currentExercises;
                const hasGymSelected = !!profile?.selected_gym_id;
                
                if (displayExercises.length === 0) {
                  return (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center py-8"
                    >
                      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                        <MapPin className="w-8 h-8 text-muted-foreground" />
                      </div>
                      {hasGymSelected ? (
                        <>
                          <p className="text-muted-foreground mb-2">
                            {isGeneratingDayExercises ? 'Generuji cviky...' : 'Klikni na Začít trénink'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Cviky budú prispôsobené vybaveniu posilne
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-muted-foreground mb-2">
                            Najprv vyber posilnu na mape
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Cviky sa prispôsobia vybaveniu posilne
                          </p>
                          <Button 
                            variant="outline" 
                            className="mt-4"
                            onClick={() => navigate('/map')}
                          >
                            <MapPin className="w-4 h-4 mr-2" />
                            Ísť na mapu
                          </Button>
                        </>
                      )}
                    </motion.div>
                  );
                }
                
                return displayExercises.map((exercise, index) => (
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
                ));
              })()}
            </AnimatePresence>
          </div>
        )}

        {/* Action Button - hide when workout completed today (ExtendWorkoutSelector is shown instead) */}
        {!wasCompletedToday && (
          <div className="fixed bottom-24 left-4 right-4">
            <Button 
              size="lg" 
              className="w-full gap-2 shadow-lg"
              onClick={handleStartWorkout}
              disabled={isGeneratingDayExercises || !profile?.selected_gym_id}
            >
              {isGeneratingDayExercises ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Generujem cviky...
                </>
              ) : !profile?.selected_gym_id ? (
                <>
                  <MapPin className="w-5 h-5" />
                  Vyber posilňu
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Začať tréning
                </>
              )}
            </Button>
          </div>
        )}

        {/* Gym Selector */}
        <AnimatePresence>
          {showGymSelector && (
            <GymSelector
              onSelect={handleGymSelected}
              onCancel={() => setShowGymSelector(false)}
              selectedGymId={profile?.selected_gym_id}
            />
          )}
        </AnimatePresence>

        {/* Workout Session */}
        <AnimatePresence>
          {isWorkoutActive && selectedWorkoutGymId && generatedExercises.length > 0 && (
            <WorkoutSession
              exercises={generatedExercises}
              dayLetter={extendedExercises.length > 0 ? 'EXT' : currentDayLetter}
              goalId={plan.goalId}
              planId={plan.id}
              gymId={selectedWorkoutGymId}
              onComplete={handleCompleteWorkout}
              onCancel={handleCancelWorkout}
            />
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
};

export default Training;
