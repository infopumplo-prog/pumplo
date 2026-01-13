import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, Dumbbell, MapPin, RefreshCw, Play, CheckCircle2, AlertCircle, Target, X, Check, Plus, ArrowLeft, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useWorkoutPlan } from '@/hooks/useWorkoutPlan';
import { useWorkoutGenerator } from '@/hooks/useWorkoutGenerator';
import { useWorkoutStats } from '@/hooks/useWorkoutStats';
import { TRAINING_ROLE_NAMES, TrainingRoleId, TRAINING_ROLE_IDS, TRAINING_ROLE_CATEGORIES } from '@/lib/trainingRoles';
import { PRIMARY_GOAL_TO_TRAINING_GOAL, TrainingGoalId, WorkoutExercise } from '@/lib/trainingGoals';
import { getTrainingSchedule, getCurrentDayLetter, getCurrentWeekday, getAllDayLetters } from '@/lib/workoutRotation';
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

interface CompletedWorkout {
  date: string;
  week: number;
  dayLetter: string;
  dayIndex: number; // day index within week (0, 1, 2...)
}

const Training = () => {
  const navigate = useNavigate();
  const { profile, isLoading: profileLoading, updateProfile } = useUserProfile();
  const { plan, isLoading: planLoading, getCurrentDayExercises, advanceToNextDay, refetch: refetchPlan, getExercisesForDay } = useWorkoutPlan();
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
  
  // Week switching
  const [viewingWeek, setViewingWeek] = useState<number>(1);
  const [selectedDayLetter, setSelectedDayLetter] = useState<string | null>(null);
  const [completedWorkouts, setCompletedWorkouts] = useState<CompletedWorkout[]>([]);

  const isOnboardingComplete = profile?.onboarding_completed ?? false;
  
  // User's training frequency (days per week)
  const trainingDays = profile?.training_days || [];
  const trainingFrequency = trainingDays.length || 3;

  // Get goal info
  const goalInfo = useMemo(() => {
    if (!plan || !availableGoals.length) return null;
    return availableGoals.find(g => g.id === plan.goalId) || null;
  }, [plan, availableGoals]);

  const totalWeeks = goalInfo?.duration_weeks || 8;
  const daysPerWeek = plan?.dayCount || 2;
  const totalDaysInPlan = totalWeeks * daysPerWeek;

  // Current week based on current_day_index
  const currentWeek = useMemo(() => {
    if (!plan) return 1;
    return Math.floor((plan.currentDayIndex || 0) / daysPerWeek) + 1;
  }, [plan, daysPerWeek]);

  // Initialize viewing week to current week
  useEffect(() => {
    if (currentWeek && viewingWeek !== currentWeek) {
      setViewingWeek(currentWeek);
    }
  }, [currentWeek]);

  // Fetch completed workouts from workout_sessions
  useEffect(() => {
    const fetchCompletedWorkouts = async () => {
      if (!plan) return;
      
      const { data } = await supabase
        .from('workout_sessions')
        .select('started_at, day_letter')
        .eq('goal_id', plan.goalId)
        .not('completed_at', 'is', null)
        .order('started_at', { ascending: true });
      
      if (data) {
        // Map sessions to week/day structure
        const completed: CompletedWorkout[] = data.map((session, index) => ({
          date: session.started_at,
          dayLetter: session.day_letter,
          // Infer week based on sequence of completions
          week: Math.floor(index / daysPerWeek) + 1,
          dayIndex: index % daysPerWeek
        }));
        setCompletedWorkouts(completed);
      }
    };
    
    fetchCompletedWorkouts();
  }, [plan, daysPerWeek]);

  // Calculate total completed days
  const totalCompletedDays = completedWorkouts.length;
  const progressPercentage = (totalCompletedDays / totalDaysInPlan) * 100;

  // Get days for viewing week
  const daysInViewingWeek = useMemo(() => {
    if (!plan) return [];
    const dayLetters = getAllDayLetters(daysPerWeek);
    return dayLetters.map((letter, index) => {
      const globalDayIndex = (viewingWeek - 1) * daysPerWeek + index;
      const isCompleted = completedWorkouts.some(w => w.week === viewingWeek && w.dayIndex === index);
      const isCurrentDay = viewingWeek === currentWeek && index === (plan.currentDayIndex % daysPerWeek);
      const dayInfo = plan.allDays?.find(d => d.dayLetter === letter);
      
      return {
        letter,
        name: dayInfo?.dayName || `Den ${letter}`,
        isCompleted,
        isCurrentDay,
        globalDayIndex,
        isFuture: globalDayIndex > (plan.currentDayIndex || 0)
      };
    });
  }, [plan, viewingWeek, currentWeek, daysPerWeek, completedWorkouts]);

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
    if (availableGoals.length > 0 && !selectedGoalId) {
      if (profile?.training_split) {
        if (profile.training_split === 'ppl') {
          setSelectedGoalId('muscle_gain');
          return;
        } else if (profile.training_split === 'full_body') {
          const mappedGoalId = profile.primary_goal ? PRIMARY_GOAL_TO_TRAINING_GOAL[profile.primary_goal] : 'general_fitness';
          setSelectedGoalId(mappedGoalId || 'general_fitness');
          return;
        }
      }
      
      if (profile?.primary_goal) {
        const mappedGoalId = PRIMARY_GOAL_TO_TRAINING_GOAL[profile.primary_goal];
        if (mappedGoalId) {
          setSelectedGoalId(mappedGoalId);
        }
      }
    }
  }, [profile?.primary_goal, profile?.training_split, availableGoals, selectedGoalId]);

  // Create a plan structure without exercises
  const handleCreatePlanSchedule = async () => {
    if (!selectedGoalId || !profile?.user_level) return;
    
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;

    await supabase
      .from('user_workout_plans')
      .update({ is_active: false })
      .eq('user_id', user.user.id);

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

  // Generate exercises for current day
  const handleGenerateDayExercises = useCallback(async (gymId: string, startWorkoutAfter: boolean = false) => {
    if (!plan || !profile?.user_level) return;

    setIsGeneratingDayExercises(true);
    
    try {
      const exercises = await generateExercisesForDay(
        gymId,
        plan.goalId,
        plan.currentDayLetter,
        profile.user_level,
        profile.injuries || [],
        profile.equipment_preference || null,
        profile.training_duration_minutes || 60
      );
      
      setGeneratedExercises(exercises);
      setSelectedWorkoutGymId(gymId);
      setShowGymSelector(false);
      
      if (startWorkoutAfter) {
        setIsWorkoutActive(true);
      }
    } catch (err) {
      console.error('Error generating day exercises:', err);
    } finally {
      setIsGeneratingDayExercises(false);
    }
  }, [plan, profile]);

  // Calculate workout duration
  const calculateWorkoutDuration = (exercises: WorkoutExercise[]): number => {
    let totalMinutes = 0;
    
    for (const ex of exercises) {
      const sets = ex.sets || 3;
      const isCompound = ['knee_dominant', 'hip_dominant', 'horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull'].includes(ex.roleId);
      const timePerSet = isCompound ? 50 : 35;
      const restBetweenSets = isCompound ? 90 : 50;
      const exerciseTime = sets * timePerSet + (sets - 1) * restBetweenSets;
      totalMinutes += exerciseTime / 60;
      totalMinutes += 1;
    }
    
    return Math.round(totalMinutes);
  };

  const getTargetExerciseCount = (trainingDurationMinutes: number | null, userLevel: string): number => {
    const duration = trainingDurationMinutes || 60;
    const avgTimePerExercise = userLevel === 'beginner' ? 7 : userLevel === 'intermediate' ? 6 : 5;
    const effectiveTime = duration - 3;
    const count = Math.floor(effectiveTime / avgTimePerExercise);
    return Math.max(3, Math.min(12, count));
  };

  // Generate exercises for a specific day - PUMPLO logic
  const generateExercisesForDay = async (
    gymId: string,
    goalId: TrainingGoalId,
    dayLetter: string,
    userLevel: string,
    userInjuries: string[],
    equipmentPreference: string | null,
    trainingDurationMinutes: number | null = null
  ): Promise<WorkoutExercise[]> => {
    const targetExerciseCount = getTargetExerciseCount(trainingDurationMinutes, userLevel);
    
    const { data: templates } = await supabase
      .from('day_templates')
      .select('*')
      .eq('goal_id', goalId)
      .eq('day_letter', dayLetter)
      .order('slot_order');

    if (!templates || templates.length === 0) return [];

    const { data: gymMachines } = await supabase
      .from('gym_machines')
      .select('machine_id, machines(id, equipment_type)')
      .eq('gym_id', gymId);

    const rawEquipmentTypes = gymMachines?.map(m => (m.machines as any)?.equipment_type).filter(Boolean) || [];
    
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

    const maxDifficulty = userLevel === 'beginner' ? 3 : userLevel === 'intermediate' ? 6 : 10;
    const activeInjuries = userInjuries.filter(i => i && i !== 'none');

    const rolesToFill: typeof templates = [];
    
    for (const slot of templates) {
      if (rolesToFill.length >= targetExerciseCount) break;
      rolesToFill.push(slot);
    }
    
    if (rolesToFill.length < targetExerciseCount) {
      const shuffled = [...templates].sort(() => Math.random() - 0.5);
      for (const slot of shuffled) {
        if (rolesToFill.length >= targetExerciseCount) break;
        const roleCount = rolesToFill.filter(r => r.role_id === slot.role_id).length;
        if (roleCount < 2) {
          rolesToFill.push(slot);
        }
      }
    }

    for (let slotIndex = 0; slotIndex < rolesToFill.length; slotIndex++) {
      const slot = rolesToFill[slotIndex];
      
      const { data: roleExercises } = await supabase
        .from('exercises')
        .select('*')
        .eq('primary_role', slot.role_id);

      if (!roleExercises || roleExercises.length === 0) continue;

      let filteredExercises = roleExercises.filter(ex => {
        if (ex.difficulty && ex.difficulty > maxDifficulty) return false;
        if (usedExerciseIds.includes(ex.id)) return false;
        
        if (activeInjuries.length > 0 && ex.contraindicated_injuries?.length > 0) {
          const hasContraindication = ex.contraindicated_injuries.some((injury: string) =>
            activeInjuries.some(userInjury => 
              injury.toLowerCase().includes(userInjury.toLowerCase()) ||
              userInjury.toLowerCase().includes(injury.toLowerCase())
            )
          );
          if (hasContraindication) return false;
        }

        const exEquipment = ex.equipment || [];
        if (exEquipment.includes('bodyweight') || exEquipment.length === 0) return true;
        
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

      const topCandidates = filteredExercises.slice(0, Math.min(5, filteredExercises.length));
      const randomIndex = Math.floor(Math.random() * topCandidates.length);
      const selectedExercise = topCandidates[randomIndex];
      usedExerciseIds.push(selectedExercise.id);

      const sets = userLevel === 'beginner' ? slot.beginner_sets :
                   userLevel === 'intermediate' ? slot.intermediate_sets : slot.advanced_sets;

      exercises.push({
        id: `temp-${slot.id}-${slotIndex}`,
        dayLetter: slot.day_letter,
        slotOrder: slotIndex + 1,
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

  const currentExercises = plan ? getCurrentDayExercises() : [];

  useEffect(() => {
    const autoGenerateExercises = async () => {
      const exercisesFromPlan = getCurrentDayExercises();
      if (plan && profile?.selected_gym_id && profile?.user_level && exercisesFromPlan.length === 0 && !isGeneratingDayExercises && generatedExercises.length === 0) {
        handleGenerateDayExercises(profile.selected_gym_id);
      }
    };
    
    autoGenerateExercises();
  }, [plan?.id, profile?.selected_gym_id, profile?.user_level, generatedExercises.length]);

  const handleStartWorkout = () => {
    if (currentExercises.length > 0 && plan?.gymId) {
      setGeneratedExercises(currentExercises);
      setSelectedWorkoutGymId(plan.gymId);
      setIsWorkoutActive(true);
    } else if (generatedExercises.length > 0 && selectedWorkoutGymId) {
      setIsWorkoutActive(true);
    } else if (profile?.selected_gym_id) {
      handleGenerateDayExercises(profile.selected_gym_id, true);
    } else {
      setShowGymSelector(true);
    }
  };

  const handleGymSelect = async (gymId: string) => {
    await updateProfile({ selected_gym_id: gymId });
    handleGenerateDayExercises(gymId, true);
  };

  const handleWorkoutComplete = async () => {
    setIsWorkoutActive(false);
    setGeneratedExercises([]);
    setExtendedExercises([]);
    await advanceToNextDay();
    refetchPlan();
  };

  const handleCancelPlan = async () => {
    if (!plan) return;
    
    await supabase
      .from('user_workout_plans')
      .update({ is_active: false })
      .eq('id', plan.id);
    
    refetchPlan();
    setSelectedGoalId(null);
  };

  // Extension workout generation
  const generateExtensionExercises = useCallback(async (count: number) => {
    if (!plan || !profile?.selected_gym_id || !profile?.user_level) return;
    
    setIsGeneratingExtension(true);
    
    try {
      const categories = ['upper', 'lower', 'core'];
      const exercisesPerCategory = Math.ceil(count / categories.length);
      const allExtensionExercises: WorkoutExercise[] = [];
      const usedIds = new Set<string>();
      
      for (let i = 0; i < count; i++) {
        const category = categories[i % categories.length];
        const rolesForCategory = TRAINING_ROLE_IDS.filter(roleId => 
          TRAINING_ROLE_CATEGORIES[roleId] === category
        );
        
        if (rolesForCategory.length === 0) continue;
        
        const randomRole = rolesForCategory[Math.floor(Math.random() * rolesForCategory.length)];
        
        const { data: exercises } = await supabase
          .from('exercises')
          .select('*')
          .eq('primary_role', randomRole);
        
        if (!exercises || exercises.length === 0) continue;
        
        const available = exercises.filter(ex => !usedIds.has(ex.id));
        if (available.length === 0) continue;
        
        const selected = available[Math.floor(Math.random() * available.length)];
        usedIds.add(selected.id);
        
        allExtensionExercises.push({
          id: `ext-${i}`,
          dayLetter: `${plan.currentDayLetter}_EXT`,
          slotOrder: i + 1,
          roleId: randomRole,
          exerciseId: selected.id,
          exerciseName: selected.name,
          equipment: selected.equipment || [],
          machineName: null,
          sets: profile.user_level === 'beginner' ? 2 : 3,
          repMin: 10,
          repMax: 15,
          isFallback: false,
          fallbackReason: null,
          isExtension: true
        });
      }
      
      setExtendedExercises(allExtensionExercises);
      setGeneratedExercises(allExtensionExercises);
      setIsWorkoutActive(true);
    } catch (err) {
      console.error('Error generating extension exercises:', err);
    } finally {
      setIsGeneratingExtension(false);
    }
  }, [plan, profile]);

  // Get exercises for selected day
  const selectedDayExercises = useMemo(() => {
    if (!selectedDayLetter || !plan) return [];
    return getExercisesForDay(selectedDayLetter);
  }, [selectedDayLetter, plan, getExercisesForDay]);

  // Active workout view
  if (isWorkoutActive && (generatedExercises.length > 0 || extendedExercises.length > 0)) {
    const workoutExercises = extendedExercises.length > 0 ? extendedExercises : generatedExercises;
    
    return (
      <WorkoutSession
        exercises={workoutExercises}
        dayLetter={extendedExercises.length > 0 ? `${plan?.currentDayLetter || 'A'}_EXT` : (plan?.currentDayLetter || 'A')}
        goalId={plan?.goalId || 'general_fitness'}
        gymId={selectedWorkoutGymId || profile?.selected_gym_id || ''}
        planId={plan?.id || null}
        onComplete={handleWorkoutComplete}
        onCancel={() => {
          setIsWorkoutActive(false);
          setExtendedExercises([]);
        }}
      />
    );
  }

  // Gym selector overlay
  if (showGymSelector) {
    return (
      <PageTransition>
        <GymSelector
          onSelect={handleGymSelect}
          onCancel={() => setShowGymSelector(false)}
        />
      </PageTransition>
    );
  }

  // Loading states
  if (profileLoading) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background p-4">
          <Skeleton className="h-8 w-32 mb-4" />
          <Skeleton className="h-4 w-48 mb-8" />
          <Skeleton className="h-32 w-full rounded-xl mb-4" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </PageTransition>
    );
  }

  // Not onboarded
  if (!isOnboardingComplete) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background p-4 pb-24">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold">Trénink</h1>
          </div>

          <OnboardingWarning onClick={() => setOnboardingOpen(true)} />

          <div className="text-center py-12">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <Dumbbell className="w-10 h-10 text-muted-foreground" />
            </motion.div>
            <h2 className="text-xl font-bold text-foreground mb-2">Trénink je uzamčený</h2>
            <p className="text-muted-foreground mb-6">
              Pro přístup k tréninku nejdříve vyplň dotazník
            </p>
            <Button onClick={() => setOnboardingOpen(true)}>
              Vyplnit dotazník
            </Button>
          </div>

          <OnboardingDrawer open={onboardingOpen} onOpenChange={setOnboardingOpen} />
        </div>
      </PageTransition>
    );
  }

  // No plan - goal selection
  if (!plan && !planLoading && !isGenerating) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background p-4 pb-24">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold">Trénink</h1>
          </div>

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
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold">Trénink</h1>
          </div>
          
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
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold">Trénink</h1>
          </div>
          
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

  // Check if workout was completed today
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
  
  const wasCompletedToday = todaySession !== null;
  const today = getCurrentWeekday();

  // Main training view with week navigation
  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-32">
        {/* Header */}
        <div className="bg-gradient-to-br from-primary/10 via-background to-background p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold">{goalInfo?.name || 'Můj plán'}</h1>
                <p className="text-sm text-muted-foreground">
                  {totalWeeks} týdnů • {daysPerWeek}× týdně
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleCancelPlan} title="Změnit cíl">
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Progress bar */}
          <div className="mb-2">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Celkový progress</span>
              <span className="font-medium text-primary">{totalCompletedDays}/{totalDaysInPlan} dní</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>
        </div>

        {/* Week Navigation */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              size="icon"
              disabled={viewingWeek <= 1}
              onClick={() => setViewingWeek(w => w - 1)}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            
            <div className="text-center">
              <h2 className="text-lg font-bold">
                Týden {viewingWeek}
                {viewingWeek === currentWeek && (
                  <span className="ml-2 text-xs font-normal text-primary">(aktuální)</span>
                )}
              </h2>
              <p className="text-xs text-muted-foreground">
                z {totalWeeks}
              </p>
            </div>
            
            <Button 
              variant="ghost" 
              size="icon"
              disabled={viewingWeek >= totalWeeks}
              onClick={() => setViewingWeek(w => w + 1)}
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Days in Week - Fixed alignment */}
        <div className="p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {daysInViewingWeek.map((day, index) => (
              <motion.button
                key={`${viewingWeek}-${day.letter}`}
                onClick={() => setSelectedDayLetter(selectedDayLetter === day.letter ? null : day.letter)}
                className={cn(
                  "p-4 rounded-xl border-2 transition-all text-center",
                  day.isCompleted
                    ? "bg-green-500/10 border-green-500"
                    : day.isCurrentDay && viewingWeek === currentWeek
                      ? "bg-primary/10 border-primary"
                      : day.isFuture
                        ? "bg-muted/30 border-border/50 opacity-60"
                        : "bg-card border-border hover:border-primary/50"
                )}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 text-lg font-bold",
                  day.isCompleted
                    ? "bg-green-500 text-white"
                    : day.isCurrentDay && viewingWeek === currentWeek
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                )}>
                  {day.isCompleted ? (
                    <Check className="w-6 h-6" />
                  ) : (
                    day.letter
                  )}
                </div>
                <p className={cn(
                  "text-sm font-medium",
                  day.isCompleted ? "text-green-600" : day.isCurrentDay ? "text-primary" : "text-foreground"
                )}>
                  {day.name}
                </p>
                {day.isCurrentDay && viewingWeek === currentWeek && !day.isCompleted && (
                  <span className="text-xs text-primary font-medium">Dnes</span>
                )}
                {day.isCompleted && (
                  <span className="text-xs text-green-600 font-medium">Hotovo</span>
                )}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Selected Day Exercises */}
        <AnimatePresence mode="wait">
          {selectedDayLetter && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 pb-4"
            >
              <Card className="p-4 bg-muted/30">
                <h3 className="font-bold mb-3">
                  Den {selectedDayLetter} - {plan.allDays?.find(d => d.dayLetter === selectedDayLetter)?.dayName}
                </h3>
                
                {selectedDayExercises.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Cviky budou vygenerovány před začátkem tréninku
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedDayExercises.map((ex, idx) => (
                      <div key={ex.id} className="flex items-center gap-3 text-sm">
                        <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {idx + 1}
                        </span>
                        <span className="flex-1">{ex.exerciseName}</span>
                        <span className="text-muted-foreground">{ex.sets}×{ex.repMin}-{ex.repMax}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Show extend workout option if workout is completed today */}
        {wasCompletedToday && viewingWeek === currentWeek && !isWorkoutActive && (
          <div className="px-4 mb-4">
            <ExtendWorkoutSelector 
              onConfirm={generateExtensionExercises}
              isLoading={isGeneratingExtension}
            />
          </div>
        )}

        {/* Current Day Exercises Preview - only for current week */}
        {viewingWeek === currentWeek && !wasCompletedToday && !selectedDayLetter && (
          <div className="px-4">
            <Card className="p-4 border-primary/30 bg-primary/5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold">
                    Dnešní trénink - Den {plan.currentDayLetter}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {plan.allDays?.find(d => d.dayLetter === plan.currentDayLetter)?.dayName}
                  </p>
                </div>
                {generatedExercises.length > 0 && (
                  <Badge variant="secondary">
                    ~{calculateWorkoutDuration(generatedExercises)} min
                  </Badge>
                )}
              </div>
              
              {isGeneratingDayExercises ? (
                <p className="text-sm text-muted-foreground">Generuji cviky...</p>
              ) : generatedExercises.length > 0 ? (
                <div className="space-y-2 mb-4">
                  {generatedExercises.slice(0, 3).map((ex, idx) => (
                    <div key={ex.id} className="flex items-center gap-3 text-sm">
                      <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                        {idx + 1}
                      </span>
                      <span className="flex-1 truncate">{ex.exerciseName}</span>
                    </div>
                  ))}
                  {generatedExercises.length > 3 && (
                    <p className="text-xs text-muted-foreground pl-9">
                      +{generatedExercises.length - 3} dalších cviků
                    </p>
                  )}
                </div>
              ) : !profile?.selected_gym_id ? (
                <p className="text-sm text-muted-foreground mb-4">
                  Vyber posilovnu pro vygenerování cviků
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mb-4">
                  Klikni na Začít pro vygenerování cviků
                </p>
              )}
            </Card>
          </div>
        )}

        {/* Action Button - only for current week and not completed */}
        {viewingWeek === currentWeek && !wasCompletedToday && (
          <div className="fixed bottom-24 left-4 right-4 max-w-md mx-auto">
            <Button 
              size="lg" 
              className="w-full gap-2 shadow-lg"
              onClick={handleStartWorkout}
              disabled={isGeneratingDayExercises}
            >
              {isGeneratingDayExercises ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Generuji...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Začít trénink
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </PageTransition>
  );
};

export default Training;
