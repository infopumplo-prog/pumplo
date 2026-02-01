import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, Dumbbell, MapPin, RefreshCw, Play, CheckCircle2, AlertCircle, Target, X, Check, Plus, ArrowLeft, Calendar, AlertTriangle, Minus, Star, Bell, BellOff, Flame } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useWorkoutPlan } from '@/hooks/useWorkoutPlan';
import { useWorkoutGenerator } from '@/hooks/useWorkoutGenerator';
import { useWorkoutStats } from '@/hooks/useWorkoutStats';
import { useStreak } from '@/hooks/useStreak';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { TRAINING_ROLE_NAMES, TrainingRoleId, TRAINING_ROLE_IDS, TRAINING_ROLE_CATEGORIES } from '@/lib/trainingRoles';
import { PRIMARY_GOAL_TO_TRAINING_GOAL, TrainingGoalId, WorkoutExercise } from '@/lib/trainingGoals';
import { getTrainingSchedule, getCurrentDayLetter, getCurrentWeekday, getAllDayLetters } from '@/lib/workoutRotation';
import { supabase } from '@/integrations/supabase/client';
import PageTransition from '@/components/PageTransition';
import OnboardingWarning from '@/components/OnboardingWarning';
import OnboardingDrawer from '@/components/OnboardingDrawer';
import NotificationOnboardingDrawer from '@/components/notifications/NotificationOnboardingDrawer';
import { WorkoutSession } from '@/components/workout/WorkoutSession';
import { GymSelector } from '@/components/workout/GymSelector';
import { ExtendWorkoutSelector } from '@/components/workout/ExtendWorkoutSelector';
import { WorkoutPreview } from '@/components/workout/WorkoutPreview';
import { WarmupPlayer, WarmupExercise } from '@/components/workout/WarmupPlayer';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { isGymCurrentlyOpen } from '@/lib/gymUtils';
import { OpeningHours } from '@/hooks/useGym';

interface TrainingGoalOption {
  id: string;
  name: string;
  description: string | null;
  day_count: number;
  duration_weeks: number | null;
}

interface CompletedWorkout {
  date: string;
  dayLetter: string;
  dayOfWeek: string; // monday, tuesday, etc.
  sessionId: string;
  week: number;
  isBonus: boolean;
}

interface HistoryExercise {
  exerciseName: string;
  sets: number;
  reps: number | null;
  weight: number | null;
}

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

const DAY_NAMES_SHORT_CZ: Record<string, string> = {
  monday: 'Po',
  tuesday: 'Út',
  wednesday: 'St',
  thursday: 'Čt',
  friday: 'Pá',
  saturday: 'So',
  sunday: 'Ne'
};

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const Training = () => {
  const navigate = useNavigate();
  const { profile, isLoading: profileLoading, updateProfile, refetch: refetchProfile } = useUserProfile();
  const { plan, isLoading: planLoading, getCurrentDayExercises, advanceToNextDay, refetch: refetchPlan, getExercisesForDay } = useWorkoutPlan();
  const { generateWorkoutPlan, isGenerating, error: generatorError } = useWorkoutGenerator();
  const { stats } = useWorkoutStats();
  const { currentStreak, maxStreak, isStreakActive, updateStreakOnWorkoutComplete, checkAndResetStreakIfNeeded } = useStreak();
  const { 
    isSupported: notificationsSupported, 
    isSubscribed: notificationsEnabled,
    subscribeToPush,
    notificationPreferences,
    markOnboardingShown 
  } = usePushNotifications();
  
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
  
  // Week switching
  const [viewingWeek, setViewingWeek] = useState<number>(1);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [completedWorkouts, setCompletedWorkouts] = useState<CompletedWorkout[]>([]);
  const [historyExercises, setHistoryExercises] = useState<HistoryExercise[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  // Bonus workout state
  const [isBonusWorkout, setIsBonusWorkout] = useState(false);
  const [isGeneratingBonusWorkout, setIsGeneratingBonusWorkout] = useState(false);
  
  // Cancel confirmation
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  
  // Plan completion confirmation
  const [showPlanCompleteDialog, setShowPlanCompleteDialog] = useState(false);
  
  // Missing exercises dialog
  const [showMissingExercisesDialog, setShowMissingExercisesDialog] = useState(false);
  const [isRegeneratingPlan, setIsRegeneratingPlan] = useState(false);
  
  // Workout preview and warmup state
  const [showWorkoutPreview, setShowWorkoutPreview] = useState(false);
  const [warmupExercises, setWarmupExercises] = useState<WarmupExercise[]>([]);
  const [isGeneratingWarmup, setIsGeneratingWarmup] = useState(false);
  const [showWarmup, setShowWarmup] = useState(false);
  
  // Notification onboarding
  const [showNotificationOnboarding, setShowNotificationOnboarding] = useState(false);

  const isOnboardingComplete = profile?.onboarding_completed ?? false;
  
  // User's training days - use plan's stored training_days if available, otherwise fall back to profile
  // This ensures that changing onboarding settings won't affect the current active plan
  // CRITICAL: Only use profile.training_days if there's NO active plan
  const trainingDays = useMemo(() => {
    // If we have an active plan, ALWAYS use its snapshotted training_days
    // Only fall back to profile when there's no plan at all
    if (plan) {
      const planDays = plan.trainingDays || [];
      return [...planDays].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
    }
    // No plan - use profile training days (for goal selection screen, etc.)
    const days = profile?.training_days || [];
    return [...days].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
  }, [plan, profile?.training_days]);
  
  const trainingFrequency = trainingDays.length || 3;

  // Get goal info
  const goalInfo = useMemo(() => {
    if (!plan || !availableGoals.length) return null;
    return availableGoals.find(g => g.id === plan.goalId) || null;
  }, [plan, availableGoals]);

  const workoutTypes = plan?.dayCount || 2; // A, B or A, B, C

  // Get plan start date to determine first week skipped days
  const planStartDate = useMemo(() => {
    if (!plan) return null;
    if (plan.startedAt) {
      return new Date(plan.startedAt);
    }
    return new Date();
  }, [plan]);

  // Calculate which training days were skipped in first week (before plan start)
  const firstWeekSkippedDays = useMemo(() => {
    if (!planStartDate || trainingDays.length === 0) return [];
    
    const jsDay = planStartDate.getDay();
    const planStartWeekday = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][jsDay];
    const planStartDayOrder = DAY_ORDER.indexOf(planStartWeekday);
    
    // Get training days that fall BEFORE the plan start day
    return trainingDays.filter(day => {
      const dayOrder = DAY_ORDER.indexOf(day);
      return dayOrder < planStartDayOrder;
    });
  }, [planStartDate, trainingDays]);

  // Effective training days in first week (excluding skipped days)
  const firstWeekEffectiveDays = useMemo(() => {
    return trainingDays.filter(day => !firstWeekSkippedDays.includes(day));
  }, [trainingDays, firstWeekSkippedDays]);

  // Calculate total weeks with shifted days logic
  // First week has fewer days, last week has additional days from first week
  const effectiveFirstWeekDayCount = firstWeekEffectiveDays.length;
  const skippedDaysCount = firstWeekSkippedDays.length;
  
  // Total training days = (totalWeeks - 1) * full weeks + first week effective + last week additional
  // But since skipped days move to last week, total training days stay the same
  const totalDaysInPlan = (goalInfo?.duration_weeks || 8) * trainingFrequency;
  
  // Calculate total weeks - if first week is partial and last week gets extra days
  // For display: totalWeeks stays same but last week shows extra days
  const totalWeeks = goalInfo?.duration_weeks || 8;

  // Current week and day based on current_day_index
  const currentWeek = useMemo(() => {
    if (!plan) return 1;
    const completedDays = plan.currentDayIndex || 0;
    
    // Week 1 has effectiveFirstWeekDayCount days
    if (completedDays < effectiveFirstWeekDayCount) return 1;
    
    // Remaining weeks have trainingFrequency days each
    const daysAfterFirstWeek = completedDays - effectiveFirstWeekDayCount;
    return 2 + Math.floor(daysAfterFirstWeek / trainingFrequency);
  }, [plan, effectiveFirstWeekDayCount, trainingFrequency]);

  const currentDayInWeek = useMemo(() => {
    if (!plan) return 0;
    const completedDays = plan.currentDayIndex || 0;
    
    if (completedDays < effectiveFirstWeekDayCount) {
      return completedDays;
    }
    
    const daysAfterFirstWeek = completedDays - effectiveFirstWeekDayCount;
    return daysAfterFirstWeek % trainingFrequency;
  }, [plan, effectiveFirstWeekDayCount, trainingFrequency]);

  // Initialize viewing week to current week
  useEffect(() => {
    if (currentWeek && viewingWeek !== currentWeek) {
      setViewingWeek(currentWeek);
    }
  }, [currentWeek]);

  // Get plan started date for week calculations
  const planStartedAt = useMemo(() => {
    if (!plan) return null;
    // We need to fetch plan started_at - for now use first completed workout or current date
    return new Date();
  }, [plan]);

  // Fetch completed workouts from workout_sessions
  useEffect(() => {
    const fetchCompletedWorkouts = async () => {
      if (!plan) return;
      
      const { data } = await supabase
        .from('workout_sessions')
        .select('id, started_at, day_letter, is_bonus')
        .eq('goal_id', plan.goalId)
        .not('completed_at', 'is', null)
        .order('started_at', { ascending: true });
      
      if (data) {
        // Filter out bonus workouts for week calculation
        const regularWorkouts = data.filter(s => !s.is_bonus);
        const completed: CompletedWorkout[] = data.map((session) => {
          const sessionDate = new Date(session.started_at);
          const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][sessionDate.getDay()];
          // Calculate week based on index in regular workouts only
          const regularIndex = regularWorkouts.findIndex(r => r.id === session.id);
          const week = session.is_bonus 
            ? Math.floor(regularWorkouts.filter(r => new Date(r.started_at) < sessionDate).length / trainingFrequency) + 1
            : Math.floor(regularIndex / trainingFrequency) + 1;
          
          return {
            date: session.started_at,
            dayLetter: session.day_letter,
            dayOfWeek: dayOfWeek,
            sessionId: session.id,
            week,
            isBonus: session.is_bonus || false
          };
        });
        setCompletedWorkouts(completed);
      }
    };
    
    fetchCompletedWorkouts();
  }, [plan, trainingFrequency]);

  // Calculate total completed days (exclude bonus workouts from progress)
  const regularCompletedWorkouts = completedWorkouts.filter(w => !w.isBonus);
  const totalCompletedDays = regularCompletedWorkouts.length;
  const progressPercentage = Math.min((totalCompletedDays / totalDaysInPlan) * 100, 100);
  
  // Check if plan is completed
  const isPlanCompleted = totalCompletedDays >= totalDaysInPlan && totalDaysInPlan > 0;
  
  // Bonus workouts for today
  const todayBonusWorkouts = completedWorkouts.filter(w => {
    const sessionDate = new Date(w.date);
    const now = new Date();
    return w.isBonus && 
      sessionDate.getFullYear() === now.getFullYear() &&
      sessionDate.getMonth() === now.getMonth() &&
      sessionDate.getDate() === now.getDate();
  });
  
  // planStartDate is already defined above in the shifted-week logic section
  
  // Check streak on page load (only once)
  useEffect(() => {
    if (profile?.onboarding_completed && !profileLoading) {
      checkAndResetStreakIfNeeded();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.onboarding_completed, profileLoading]);
  
  // Auto-regenerate plan when completed
  useEffect(() => {
    if (isPlanCompleted && plan && !showPlanCompleteDialog && !isRegeneratingPlan) {
      setShowPlanCompleteDialog(true);
    }
  }, [isPlanCompleted, plan, showPlanCompleteDialog, isRegeneratingPlan]);

  // Show notification onboarding drawer on first visit
  useEffect(() => {
    if (
      profile?.onboarding_completed && 
      !profileLoading && 
      notificationsSupported && 
      !notificationsEnabled && 
      !notificationPreferences.onboardingShown
    ) {
      // Small delay for better UX
      const timer = setTimeout(() => {
        setShowNotificationOnboarding(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [profile?.onboarding_completed, profileLoading, notificationsSupported, notificationsEnabled, notificationPreferences.onboardingShown]);
  
  // Function to regenerate plan automatically
  const handleRegeneratePlan = useCallback(async () => {
    if (!profile?.primary_goal) return;
    
    setIsRegeneratingPlan(true);
    
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      
      // Map current profile goal to training goal
      const mappedGoalId = PRIMARY_GOAL_TO_TRAINING_GOAL[profile.primary_goal];
      if (!mappedGoalId) return;
      
      // Deactivate old plan
      if (plan?.id) {
        await supabase
          .from('user_workout_plans')
          .update({ is_active: false })
          .eq('id', plan.id);
      }
      
      // Create new plan with current profile training_days snapshot and generate exercises
      const selectedGymId = profile.selected_gym_id;
      const durationMinutes = profile.training_duration_minutes || 60;
      
      if (selectedGymId && profile.user_level) {
        // Generate full plan with exercises
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
          // Update plan with snapshotted training_days
          await supabase
            .from('user_workout_plans')
            .update({ training_days: profile.training_days })
            .eq('id', planId);
        }
      } else {
        // No gym - create empty plan
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
      
      // Reset day index but KEEP STREAK!
      await supabase
        .from('user_profiles')
        .update({ current_day_index: 0 })
        .eq('user_id', userData.user.id);
      
      // Refetch
      await refetchProfile();
      await refetchPlan();
      setCompletedWorkouts([]);
      setShowPlanCompleteDialog(false);
      
      toast.success('Nový plán byl vytvořen! 🎉');
    } catch (err) {
      console.error('Error regenerating plan:', err);
      toast.error('Nepodařilo se vytvořit nový plán');
    } finally {
      setIsRegeneratingPlan(false);
    }
  }, [profile, plan, refetchProfile, refetchPlan]);

  // Get today's weekday
  const todayWeekday = getCurrentWeekday();
  const todayDayOrder = DAY_ORDER.indexOf(todayWeekday);

  // Get days for viewing week with proper workout letter rotation
  // Implements shifted week logic: 
  // - Week 1: Only show days from plan start onwards (skip days before)
  // - Week after last (totalWeeks + 1): Add the skipped days from week 1
  const daysInViewingWeek = useMemo(() => {
    if (!plan || trainingDays.length === 0) return [];
    
    const workoutLetters = getAllDayLetters(workoutTypes);
    const isFirstWeek = viewingWeek === 1;
    // Extra week only exists if there are skipped days from week 1
    const isExtraWeek = skippedDaysCount > 0 && viewingWeek === totalWeeks + 1;
    
    // Build the list of days to show in this week
    let daysToShow: string[] = [];
    
    if (isFirstWeek) {
      // Week 1: Only show days from plan start onwards (hide skipped days)
      daysToShow = firstWeekEffectiveDays;
    } else if (isExtraWeek) {
      // Extra week (after last regular week): Show only the skipped days from first week
      daysToShow = firstWeekSkippedDays;
    } else {
      // Normal weeks (including last regular week): Show all training days
      daysToShow = trainingDays;
    }
    
    // Calculate base properties for each day
    const daysWithBaseProps = daysToShow.map((dayOfWeek, indexInWeek) => {
      // For split calculation, we need the EFFECTIVE global day index
      // Week 1 starts at 0, week 2 starts at firstWeekEffectiveDays, etc.
      let effectiveGlobalIndex: number;
      
      if (isFirstWeek) {
        effectiveGlobalIndex = indexInWeek;
      } else if (isExtraWeek) {
        // Extra week days: these are the LAST days of the entire plan
        const regularDaysInPlan = effectiveFirstWeekDayCount + (totalWeeks - 1) * trainingFrequency;
        effectiveGlobalIndex = regularDaysInPlan + indexInWeek;
      } else {
        // Normal calculation for other weeks
        const daysBeforeThisWeek = effectiveFirstWeekDayCount + (viewingWeek - 2) * trainingFrequency;
        effectiveGlobalIndex = daysBeforeThisWeek + indexInWeek;
      }
      
      // Rotate through workout types (A, B, A, B... or A, B, C, A, B, C...)
      const workoutLetter = workoutLetters[effectiveGlobalIndex % workoutTypes];
      
      // Check if this day is completed (non-bonus) - match by week and dayOfWeek
      // For extra week days, they are always in the future
      const completedSession = isExtraWeek 
        ? null 
        : regularCompletedWorkouts.find(w => 
            w.week === viewingWeek && w.dayOfWeek === dayOfWeek && !w.isBonus
          );
      const isCompleted = !!completedSession;
      
      // Is this the actual "today" - check if day of week matches today's day
      const dayOrderIndex = DAY_ORDER.indexOf(dayOfWeek);
      const isToday = !isExtraWeek && dayOfWeek === todayWeekday && viewingWeek === currentWeek;
      
      // Is this day in the past within the current week?
      const isPastThisWeek = !isExtraWeek && viewingWeek === currentWeek && dayOrderIndex < todayDayOrder;
      
      // Is the entire viewing week in the past?
      const isWeekInPast = viewingWeek < currentWeek;
      
      // Is this day in the future?
      // Extra week days are always considered "future" since they're at the end of the plan
      const isFuture = isExtraWeek || viewingWeek > currentWeek || 
        (viewingWeek === currentWeek && dayOrderIndex > todayDayOrder);
      
      // Calculate actual calendar date for this day in this week
      // Used to check if day is before plan start (shouldn't be marked as missed)
      const getActualDateForDay = (): Date | null => {
        if (!planStartDate) return null;
        
        // Calculate the Monday of the plan's start week
        const startDay = planStartDate.getDay(); // 0=Sunday
        const daysFromMonday = startDay === 0 ? 6 : startDay - 1; // Convert to Mon=0
        const planWeekMonday = new Date(planStartDate);
        planWeekMonday.setDate(planStartDate.getDate() - daysFromMonday);
        
        // Add weeks to get to the viewing week's Monday
        const viewingWeekMonday = new Date(planWeekMonday);
        viewingWeekMonday.setDate(planWeekMonday.getDate() + (viewingWeek - 1) * 7);
        
        // Add days to get to the specific day of week
        const targetDate = new Date(viewingWeekMonday);
        targetDate.setDate(viewingWeekMonday.getDate() + dayOrderIndex);
        
        return targetDate;
      };
      
      const actualDate = getActualDateForDay();
      const isBeforePlanStart = planStartDate && actualDate && actualDate < planStartDate;
      
      // Compare with TODAY's actual calendar date (not day-of-week index)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isActuallyInPast = actualDate && actualDate < today;
      
      // Is this day missed? Only if:
      // 1. Not in extra week (shifted days at end of plan)
      // 2. Its actual calendar date is in the PAST (not future)
      // 3. Not before plan start date
      // 4. Not already completed
      const isMissed = !isExtraWeek && isActuallyInPast && !isBeforePlanStart && !isCompleted;
      
      // Is this the current day to train (next up)?
      const isCurrentDay = isToday && !isCompleted;
      
      // Get day template info - shows split name (e.g., "Push", "Pull & Ramena")
      const dayInfo = plan.allDays?.find(d => d.dayLetter === workoutLetter);
      
      return {
        dayOfWeek,
        dayOrderIndex,
        dayName: DAY_NAMES_CZ[dayOfWeek] || dayOfWeek,
        dayNameShort: DAY_NAMES_SHORT_CZ[dayOfWeek] || dayOfWeek.slice(0, 2),
        workoutLetter,
        // Show split name, NOT "Den A" - use dayName from template
        workoutName: dayInfo?.dayName || `Trénink ${workoutLetter}`,
        isCompleted,
        isCurrentDay,
        isToday,
        isFuture,
        isPast: isPastThisWeek || isWeekInPast,
        isMissed,
        isFirstWeekSkip: false, // No longer used
        isShiftedDay: false, // No longer highlighted
        globalDayIndex: effectiveGlobalIndex,
        sessionId: completedSession?.sessionId || null,
        isUpcoming: false // Will be set in second pass
      };
    });
    
    // Second pass: find the first upcoming day (future, not completed)
    // Only mark upcoming if we're viewing the current week
    if (viewingWeek === currentWeek) {
      const upcomingIndex = daysWithBaseProps.findIndex(day => 
        day.isFuture && !day.isCompleted
      );
      if (upcomingIndex !== -1) {
        daysWithBaseProps[upcomingIndex].isUpcoming = true;
      }
    }
    
    return daysWithBaseProps;
  }, [plan, viewingWeek, currentWeek, totalWeeks, trainingDays, trainingFrequency, workoutTypes, regularCompletedWorkouts, todayWeekday, todayDayOrder, firstWeekEffectiveDays, firstWeekSkippedDays, skippedDaysCount, effectiveFirstWeekDayCount]);

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

  // Create a plan structure - generates exercises if gym is selected
  const handleCreatePlanSchedule = async () => {
    if (!selectedGoalId || !profile?.user_level) return;
    
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;

    // If user has a gym selected, generate full plan with exercises
    if (profile.selected_gym_id) {
      const planId = await generateWorkoutPlan(
        profile.selected_gym_id,
        selectedGoalId as any,
        profile.user_level as any,
        profile.injuries || [],
        profile.equipment_preference,
        profile.training_duration_minutes || 60
      );
      
      if (planId) {
        // Update plan with snapshotted training_days
        await supabase
          .from('user_workout_plans')
          .update({ training_days: profile.training_days || [] })
          .eq('id', planId);
        
        await refetchPlan();
        toast.success('Plán vytvořen!');
      }
    } else {
      // No gym selected - create plan with training_days snapshot
      await supabase
        .from('user_workout_plans')
        .update({ is_active: false })
        .eq('user_id', user.user.id);

      await supabase
        .from('user_profiles')
        .update({ current_day_index: 0 })
        .eq('user_id', user.user.id);

      const { error } = await supabase
        .from('user_workout_plans')
        .insert({
          user_id: user.user.id,
          goal_id: selectedGoalId,
          is_active: true,
          gym_id: null,
          current_week: 1,
          training_days: profile.training_days || [] // SNAPSHOT training days!
        });

      if (!error) {
        await refetchPlan();
        toast.info('Plán vytvořen. Pro generování cviků vyber posilovnu.');
      }
    }
  };

  // Load exercises from database - they were generated when plan was created
  const handleGenerateDayExercises = useCallback(async (gymId: string, startWorkoutAfter: boolean = false) => {
    if (!plan || !profile?.user_level) return;

    setIsGeneratingDayExercises(true);
    
    try {
      // Číst cviky z databáze - byly vygenerovány při vytvoření plánu
      const exercisesFromPlan = getCurrentDayExercises();
      
      if (exercisesFromPlan.length > 0) {
        // Máme cviky v DB - použijeme je
        setGeneratedExercises(exercisesFromPlan);
        setSelectedWorkoutGymId(gymId);
        setShowGymSelector(false);
        
        if (startWorkoutAfter) {
          setShowWorkoutPreview(true);
        }
      } else {
        // Žádné cviky v DB - plán nemá vygenerované cviky
        setShowMissingExercisesDialog(true);
      }
    } catch (err) {
      console.error('Error loading exercises:', err);
      toast.error('Nepodařilo se načíst cviky');
    } finally {
      setIsGeneratingDayExercises(false);
    }
  }, [plan, profile, getCurrentDayExercises]);

  // Calculate workout duration - unified with useWorkoutGenerator's calculateSlotsForDuration
  // New formula: warmup (dynamic 30s per exercise) + exercises × 8 min
  const calculateWorkoutDuration = (exercises: WorkoutExercise[], warmupCount: number = 4): number => {
    // Warmup: each exercise is 30 seconds = 0.5 min (round up)
    const WARMUP_MINUTES = Math.ceil(warmupCount * 0.5);
    const MINUTES_PER_EXERCISE = 8;
    
    const exerciseCount = exercises.length;
    const estimatedDuration = (exerciseCount * MINUTES_PER_EXERCISE) + WARMUP_MINUTES;
    
    return estimatedDuration;
  };

  const getTargetExerciseCount = (trainingDurationMinutes: number | null, userLevel: string): number => {
    const duration = trainingDurationMinutes || 60;
    const avgTimePerExercise = userLevel === 'beginner' ? 7 : userLevel === 'intermediate' ? 6 : 5;
    const effectiveTime = duration - 3;
    const count = Math.floor(effectiveTime / avgTimePerExercise);
    return Math.max(3, Math.min(12, count));
  };

  // State for gym confirmation dialog
  const [showGymConfirmDialog, setShowGymConfirmDialog] = useState(false);
  const [confirmedGymName, setConfirmedGymName] = useState<string>('');

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

  // State for gym closed warning
  const [showGymClosedWarning, setShowGymClosedWarning] = useState(false);
  const [closedGymName, setClosedGymName] = useState<string>('');

  // Open workout preview with gym confirmation
  const handleStartWorkout = async () => {
    // Uživatel musí mít vybranou posilovnu
    if (!profile?.selected_gym_id) {
      toast.error('Nejdříve vyber posilovnu na mapě');
      navigate('/map');
      return;
    }
    
    // Načti název posilovny
    const { data: gymData } = await supabase
      .from('gyms')
      .select('name, opening_hours')
      .eq('id', profile.selected_gym_id)
      .single();
    
    if (!gymData) {
      toast.error('Posilovna nebyla nalezena');
      return;
    }
    
    // Zkontroluj otevírací hodiny
    if (gymData.opening_hours) {
      const isOpen = isGymCurrentlyOpen(gymData.opening_hours as OpeningHours);
      if (!isOpen) {
        setClosedGymName(gymData.name || 'Vybraná posilovna');
        setShowGymClosedWarning(true);
        return;
      }
    }
    
    // Zobraz potvrzovací dialog
    setConfirmedGymName(gymData.name || 'Vybraná posilovna');
    setShowGymConfirmDialog(true);
  };

  // Potvrzení posilovny a start tréninku
  const handleConfirmGymAndStart = async () => {
    setShowGymConfirmDialog(false);
    
    const exercisesFromPlan = getCurrentDayExercises();
    
    if (exercisesFromPlan.length > 0) {
      setGeneratedExercises(exercisesFromPlan);
      setSelectedWorkoutGymId(profile!.selected_gym_id!);
      setShowWorkoutPreview(true);
    } else {
      setShowMissingExercisesDialog(true);
    }
  };

  // Změna posilovny
  const handleChangeGym = () => {
    setShowGymConfirmDialog(false);
    navigate('/map');
  };
  
  // Generate warmup exercises based on main workout's target muscles
  const generateWarmupExercises = useCallback(async (mainExercises: WorkoutExercise[]): Promise<WarmupExercise[]> => {
    // 1. Collect target muscles from main exercises
    const targetMuscles = new Set<string>();
    
    for (const ex of mainExercises) {
      if (ex.exerciseId) {
        const { data } = await supabase
          .from('exercises')
          .select('primary_muscles')
          .eq('id', ex.exerciseId)
          .single();
        
        if (data?.primary_muscles) {
          data.primary_muscles.forEach((m: string) => targetMuscles.add(m));
        }
      }
    }
    
    // 2. Fetch warmup exercises (bodyweight only - no machines)
    const { data: warmupExercisesData } = await supabase
      .from('exercises')
      .select('id, name, primary_muscles, video_path')
      .eq('allowed_phase', 'warmup')
      .is('machine_id', null);
    
    if (!warmupExercisesData || warmupExercisesData.length === 0) {
      // Fallback: no warmup exercises in DB
      return [];
    }
    
    // 3. Select warmups that cover target muscles
    const selectedWarmups: WarmupExercise[] = [];
    const coveredMuscles = new Set<string>();
    
    // Sort by how many target muscles each warmup covers
    const sorted = [...warmupExercisesData].sort((a, b) => {
      const aScore = a.primary_muscles?.filter((m: string) => targetMuscles.has(m)).length || 0;
      const bScore = b.primary_muscles?.filter((m: string) => targetMuscles.has(m)).length || 0;
      return bScore - aScore;
    });
    
    for (const warmup of sorted) {
      if (selectedWarmups.length >= 6) break;
      
      const coversNewMuscle = warmup.primary_muscles?.some((m: string) => 
        targetMuscles.has(m) && !coveredMuscles.has(m)
      );
      
      // Add if covers new muscle OR we don't have enough warmups yet
      if (coversNewMuscle || selectedWarmups.length < 4) {
        selectedWarmups.push({
          id: warmup.id,
          name: warmup.name,
          duration: 30, // 30 seconds per warmup
          videoPath: warmup.video_path,
          primaryMuscles: warmup.primary_muscles || []
        });
        warmup.primary_muscles?.forEach((m: string) => coveredMuscles.add(m));
      }
    }
    
    // 4. Fallback: if less than 4, add random warmups
    if (selectedWarmups.length < 4) {
      const remaining = warmupExercisesData.filter(w => 
        !selectedWarmups.find(s => s.id === w.id)
      );
      const shuffled = remaining.sort(() => Math.random() - 0.5);
      
      while (selectedWarmups.length < 4 && shuffled.length > 0) {
        const w = shuffled.pop()!;
        selectedWarmups.push({
          id: w.id,
          name: w.name,
          duration: 30,
          videoPath: w.video_path,
          primaryMuscles: w.primary_muscles || []
        });
      }
    }
    
    return selectedWarmups;
  }, []);
  
  // Handle starting warmup from preview
  const handleStartWarmup = useCallback(async () => {
    setIsGeneratingWarmup(true);
    
    try {
      const warmups = await generateWarmupExercises(generatedExercises);
      
      if (warmups.length === 0) {
        // No warmup exercises available, go straight to workout
        setShowWorkoutPreview(false);
        setIsWorkoutActive(true);
        toast.info('Žádné rozcvičkové cviky nejsou k dispozici');
      } else {
        setWarmupExercises(warmups);
        setShowWorkoutPreview(false);
        setShowWarmup(true);
      }
    } catch (err) {
      console.error('Error generating warmup:', err);
      toast.error('Nepodařilo se vygenerovat rozcvičku');
      setShowWorkoutPreview(false);
      setIsWorkoutActive(true);
    } finally {
      setIsGeneratingWarmup(false);
    }
  }, [generatedExercises, generateWarmupExercises]);
  
  // Handle warmup completion
  const handleWarmupComplete = useCallback(() => {
    setShowWarmup(false);
    setIsWorkoutActive(true);
  }, []);
  
  // Handle warmup skip
  const handleWarmupSkip = useCallback(() => {
    setShowWarmup(false);
    setIsWorkoutActive(true);
    toast.info('Rozcvička přeskočena');
  }, []);

  const handleGymSelect = async (gymId: string) => {
    await updateProfile({ selected_gym_id: gymId });
    handleGenerateDayExercises(gymId, true);
  };

  const handleWorkoutComplete = async () => {
    setIsWorkoutActive(false);
    setGeneratedExercises([]);
    setExtendedExercises([]);
    
    // Only advance day and update streak if not a bonus workout
    if (!isBonusWorkout) {
      await advanceToNextDay();
      
      // Update streak
      const { newStreak, isNewRecord, justActivated } = await updateStreakOnWorkoutComplete();
      
      if (justActivated) {
        toast.success('🔥 Streak aktivován! Máš 3 tréninky za sebou!', {
          duration: 5000
        });
      } else if (isNewRecord && newStreak > 3) {
        toast.success(`🔥 Nový rekord! ${newStreak} dní streak!`, {
          duration: 5000
        });
      }
    }
    
    setIsBonusWorkout(false);
    await refetchProfile();
    refetchPlan();
  };

  const handleCancelPlan = async () => {
    if (!plan) return;
    
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    
    // Delete workout sessions associated with this goal (but sets remain for history)
    // The sets have session_id FK, so they will be cascade deleted if we set up cascade,
    // but we want to keep history, so we only delete the sessions not completed
    // Actually, we need to delete the workout_sessions that belong to this plan to reset progress
    // But the user wants to keep history - so we delete sessions but the sets remain orphaned
    // Better approach: delete sessions for this goal_id to reset progress
    await supabase
      .from('workout_sessions')
      .delete()
      .eq('goal_id', plan.goalId)
      .eq('user_id', user.user.id);
    
    // Deactivate plan
    await supabase
      .from('user_workout_plans')
      .update({ is_active: false })
      .eq('id', plan.id);
    
    // Reset current_day_index to 0
    await supabase
      .from('user_profiles')
      .update({ current_day_index: 0 })
      .eq('user_id', user.user.id);
    
    // Explicitly refetch to sync with latest data
    await refetchProfile();
    await refetchPlan();
    
    setCompletedWorkouts([]);
    setSelectedGoalId(null);
    setShowCancelConfirm(false);
  };
  
  // Regenerate exercises - now just reloads from DB since generation happens in plan creation
  const handleRegenerateExercises = useCallback(async () => {
    if (!plan || !profile?.selected_gym_id || !profile?.user_level) {
      toast.error('Nejprve vyber posilovnu');
      return;
    }
    
    setIsGeneratingDayExercises(true);
    
    try {
      // Reload exercises from plan
      const exercisesFromPlan = getCurrentDayExercises();
      
      if (exercisesFromPlan.length > 0) {
        setGeneratedExercises(exercisesFromPlan);
        toast.success('Cviky byly načteny!');
      } else {
        toast.error('Pro regenerování cviků prosím regeneruj celý plán v nastavení.');
      }
    } catch (err) {
      console.error('Error loading exercises:', err);
      toast.error('Nepodařilo se načíst cviky');
    } finally {
      setIsGeneratingDayExercises(false);
    }
  }, [plan, profile, getCurrentDayExercises]);

  // Extension workout generation
  const generateExtensionExercises = useCallback(async (count: number) => {
    if (!plan || !profile?.selected_gym_id || !profile?.user_level) return;
    
    setIsGeneratingExtension(true);
    
    try {
      const categories = ['upper', 'lower', 'core'];
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
          equipment: [], // deprecated, kept for interface compatibility
          machineName: null,
          sets: profile.user_level === 'advanced' ? 4 : 3,
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

  // Bonus workout generation for non-training days
  const generateBonusWorkout = useCallback(async (count: number) => {
    if (!plan || !profile?.selected_gym_id || !profile?.user_level) return;
    
    setIsGeneratingBonusWorkout(true);
    setIsBonusWorkout(true);
    
    try {
      const categories = ['upper', 'lower', 'core'];
      const bonusExercises: WorkoutExercise[] = [];
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
        
        bonusExercises.push({
          id: `bonus-${i}`,
          dayLetter: 'BONUS',
          slotOrder: i + 1,
          roleId: randomRole,
          exerciseId: selected.id,
          exerciseName: selected.name,
          equipment: [], // deprecated, kept for interface compatibility
          machineName: null,
          sets: profile.user_level === 'advanced' ? 4 : 3,
          repMin: 10,
          repMax: 15,
          isFallback: false,
          fallbackReason: null,
          isExtension: false
        });
      }
      
      setGeneratedExercises(bonusExercises);
      setSelectedWorkoutGymId(profile.selected_gym_id);
      // Route bonus workout through preview/warmup flow instead of starting directly
      setShowWorkoutPreview(true);
    } catch (err) {
      console.error('Error generating bonus exercises:', err);
    } finally {
      setIsGeneratingBonusWorkout(false);
    }
  }, [plan, profile]);
  const selectedDayExercises = useMemo(() => {
    if (selectedDayIndex === null || !plan) return [];
    const day = daysInViewingWeek[selectedDayIndex];
    if (!day) return [];
    return getExercisesForDay(day.workoutLetter);
  }, [selectedDayIndex, plan, daysInViewingWeek, getExercisesForDay]);

  // Fetch history exercises when selecting a completed day
  useEffect(() => {
    // Early exit to prevent unnecessary re-renders
    if (selectedDayIndex === null) {
      if (historyExercises.length > 0) {
        setHistoryExercises([]);
      }
      return;
    }
    
    const day = daysInViewingWeek[selectedDayIndex];
    if (!day || !day.isCompleted || !day.sessionId) {
      if (historyExercises.length > 0) {
        setHistoryExercises([]);
      }
      return;
    }
    
    // Use sessionId as stable identifier to prevent re-fetching
    const sessionId = day.sessionId;
    
    const fetchHistoryExercises = async () => {
      setIsLoadingHistory(true);
      
      const { data } = await supabase
        .from('workout_session_sets')
        .select('exercise_name, set_number, reps, weight_kg')
        .eq('session_id', sessionId)
        .order('exercise_name')
        .order('set_number');
      
      if (data) {
        // Group by exercise name
        const grouped: Record<string, { reps: number[], weights: number[] }> = {};
        data.forEach(set => {
          if (!grouped[set.exercise_name]) {
            grouped[set.exercise_name] = { reps: [], weights: [] };
          }
          grouped[set.exercise_name].reps.push(set.reps || 0);
          grouped[set.exercise_name].weights.push(set.weight_kg || 0);
        });
        
        const exercises: HistoryExercise[] = Object.entries(grouped).map(([name, data]) => ({
          exerciseName: name,
          sets: data.reps.length,
          reps: data.reps.length > 0 ? Math.round(data.reps.reduce((a, b) => a + b, 0) / data.reps.length) : null,
          weight: data.weights.some(w => w > 0) ? Math.max(...data.weights) : null
        }));
        
        setHistoryExercises(exercises);
      }
      
      setIsLoadingHistory(false);
    };
    
    fetchHistoryExercises();
  // Only depend on selectedDayIndex and the sessionId of the selected day
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDayIndex, daysInViewingWeek[selectedDayIndex]?.sessionId]);

  // Get day name for preview
  const getTodayDayName = useCallback(() => {
    const todayTrainingDay = daysInViewingWeek.find(d => d.isToday);
    return todayTrainingDay?.workoutName || 'Trénink';
  }, [daysInViewingWeek]);

  // Workout preview screen
  if (showWorkoutPreview && generatedExercises.length > 0) {
    return (
      <WorkoutPreview
        exercises={generatedExercises}
        dayLetter={plan?.currentDayLetter || 'A'}
        dayName={getTodayDayName()}
        estimatedDuration={calculateWorkoutDuration(generatedExercises)}
        onStartWarmup={handleStartWarmup}
        onClose={() => setShowWorkoutPreview(false)}
        isLoading={isGeneratingWarmup}
      />
    );
  }
  
  // Warmup phase
  if (showWarmup && warmupExercises.length > 0) {
    return (
      <WarmupPlayer
        exercises={warmupExercises}
        onComplete={handleWarmupComplete}
        onSkipAll={handleWarmupSkip}
      />
    );
  }

  // Active workout view
  if (isWorkoutActive && (generatedExercises.length > 0 || extendedExercises.length > 0)) {
    const workoutExercises = extendedExercises.length > 0 ? extendedExercises : generatedExercises;
    const isExtensionWorkout = extendedExercises.length > 0;
    
    return (
      <WorkoutSession
        exercises={workoutExercises}
        dayLetter={isBonusWorkout ? 'BONUS' : isExtensionWorkout ? `${plan?.currentDayLetter || 'A'}_EXT` : (plan?.currentDayLetter || 'A')}
        goalId={plan?.goalId || 'general_fitness'}
        gymId={selectedWorkoutGymId || profile?.selected_gym_id || ''}
        planId={plan?.id || null}
        isBonus={isBonusWorkout}
        onComplete={handleWorkoutComplete}
        onCancel={() => {
          setIsWorkoutActive(false);
          setExtendedExercises([]);
          setIsBonusWorkout(false);
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
                          {goal.day_count} typy tréninků • {goal.duration_weeks || 8} týdnů
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
  const isViewingCurrentWeek = viewingWeek === currentWeek;
  const isViewingPastWeek = viewingWeek < currentWeek;

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
                  {totalWeeks} týdnů • {trainingFrequency}× týdně
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* Notification toggle with tooltip */}
              {notificationsSupported && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={async () => {
                          if (notificationsEnabled) {
                            toast.info('Notifikace jsou již povoleny. Uprav je v nastavení.');
                            navigate('/settings');
                          } else {
                            const granted = await subscribeToPush();
                            if (granted) {
                              toast.success('Notifikace povoleny! Budeme ti připomínat tréninky.');
                            } else {
                              toast.error('Notifikace nebyly povoleny');
                            }
                          }
                        }}
                        className={cn(
                          notificationsEnabled && "text-primary"
                        )}
                      >
                        {notificationsEnabled ? (
                          <Bell className="w-5 h-5" />
                        ) : (
                          <BellOff className="w-5 h-5" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {notificationsEnabled 
                        ? 'Notifikace povoleny - klikni pro nastavení' 
                        : 'Klikni pro povolení notifikací'
                      }
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <Button variant="ghost" size="icon" onClick={() => setShowCancelConfirm(true)} title="Zrušit plán">
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Streak Display */}
          {isStreakActive && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 mb-3"
            >
              <div className="flex items-center gap-2 bg-orange-500/10 text-orange-500 px-3 py-1.5 rounded-full">
                <Flame className="w-4 h-4" />
                <span className="font-bold text-sm">{currentStreak} dní streak</span>
              </div>
              {maxStreak > currentStreak && (
                <span className="text-xs text-muted-foreground">
                  Rekord: {maxStreak}
                </span>
              )}
            </motion.div>
          )}

          {/* Progress bar */}
          <div className="mb-2">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Celkový progress</span>
              <span className="font-medium text-primary">{totalCompletedDays}/{totalDaysInPlan} tréninků</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>
          
          {/* Warning: Plan has too many exercises - needs regeneration */}
          {plan && (() => {
            const currentDayExerciseCount = plan.exercises.filter(e => e.dayLetter === plan.currentDayLetter).length;
            return currentDayExerciseCount > 7;
          })() && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                    Plán obsahuje příliš mnoho cviků
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Dle aktuální metodiky by trénink měl mít max 7 cviků. Regeneruj plán pro optimální rozložení.
                  </p>
                  <Button 
                    onClick={handleRegeneratePlan} 
                    variant="outline" 
                    size="sm"
                    className="mt-2 h-8 text-xs border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
                    disabled={isRegeneratingPlan}
                  >
                    {isRegeneratingPlan ? (
                      <>
                        <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                        Regeneruji...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Regenerovat plán
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Week Navigation - Compact */}
        <div className="px-4 py-3 flex items-center justify-between bg-muted/30">
          <Button 
            variant="ghost" 
            size="sm"
            disabled={viewingWeek <= 1}
            onClick={() => {
              setViewingWeek(w => w - 1);
              setSelectedDayIndex(null);
            }}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">
              Týden {viewingWeek}/{skippedDaysCount > 0 ? totalWeeks + 1 : totalWeeks}
            </span>
            {isViewingCurrentWeek && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">teď</Badge>
            )}
          </div>
          
          <Button 
            variant="ghost" 
            size="sm"
            disabled={viewingWeek >= (skippedDaysCount > 0 ? totalWeeks + 1 : totalWeeks)}
            onClick={() => {
              setViewingWeek(w => w + 1);
              setSelectedDayIndex(null);
            }}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Days in Week */}
        <div className="p-4 space-y-2">
          {daysInViewingWeek.map((day, index) => (
            <motion.button
              key={`${viewingWeek}-${day.dayOfWeek}`}
              onClick={() => setSelectedDayIndex(selectedDayIndex === index ? null : index)}
              className={cn(
                "w-full p-3 rounded-xl border transition-all text-left flex items-center gap-3",
                day.isCompleted
                  ? "bg-green-500/10 border-green-500/50"
                  : day.isMissed
                    ? "bg-destructive/10 border-destructive/50"
                    : day.isToday && isViewingCurrentWeek
                      ? "bg-primary/10 border-primary"
                      : day.isUpcoming
                        ? "bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/30"
                        : day.isFuture
                          ? "bg-muted/30 border-border/50"
                          : "bg-card border-border hover:border-primary/50"
              )}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              {/* Status icon */}
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center text-base font-bold shrink-0",
                day.isCompleted
                  ? "bg-green-500 text-white"
                  : day.isMissed
                    ? "bg-destructive text-destructive-foreground"
                    : day.isToday && isViewingCurrentWeek
                      ? "bg-primary text-primary-foreground"
                      : day.isUpcoming
                        ? "bg-amber-500 text-white"
                        : "bg-muted text-muted-foreground"
              )}>
                {day.isCompleted ? (
                  <Check className="w-5 h-5" />
                ) : day.isMissed ? (
                  <X className="w-5 h-5" />
                ) : (
                  day.workoutLetter
                )}
              </div>

              {/* Day info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className={cn(
                    "font-semibold text-sm",
                    day.isCompleted 
                      ? "text-green-600" 
                      : day.isMissed 
                        ? "text-destructive" 
                        : day.isToday && isViewingCurrentWeek 
                          ? "text-primary" 
                          : day.isUpcoming
                            ? "text-amber-600"
                            : "text-foreground"
                  )}>
                    {day.dayName}
                  </h3>
                  {day.isToday && isViewingCurrentWeek && !day.isCompleted && !day.isMissed && (
                    <Badge variant="default" className="text-[10px] px-1.5 py-0">Dnes</Badge>
                  )}
                  {day.isUpcoming && !day.isToday && (
                    <Badge className="text-[10px] px-1.5 py-0 bg-amber-500 hover:bg-amber-500">Ďalší</Badge>
                  )}
                </div>
                <p className={cn(
                  "text-xs",
                  day.isCompleted 
                    ? "text-green-600/70" 
                    : day.isMissed 
                      ? "text-destructive/70" 
                      : "text-muted-foreground"
                )}>
                  {day.workoutName}
                </p>
              </div>

              {/* Status label */}
              <div className="shrink-0">
                {day.isCompleted ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : day.isMissed ? (
                  <span className="text-[10px] font-medium text-destructive">Vynecháno</span>
                ) : day.isFuture ? (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                ) : null}
              </div>
            </motion.button>
          ))}
        </div>

        {/* Selected Day Detail */}
        <AnimatePresence mode="wait">
          {selectedDayIndex !== null && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 pb-4"
            >
              <Card className="p-4 bg-muted/30">
                {(() => {
                  const day = daysInViewingWeek[selectedDayIndex];
                  if (!day) return null;
                  
                  return (
                    <>
                      <h3 className="font-bold mb-3 flex items-center gap-2">
                        {day.dayName} - {day.workoutName}
                        {day.isCompleted && (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        )}
                        {day.isMissed && (
                          <X className="w-4 h-4 text-destructive" />
                        )}
                      </h3>
                      
                      {day.isCompleted ? (
                        isLoadingHistory ? (
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-4 w-1/2" />
                          </div>
                        ) : historyExercises.length > 0 ? (
                          <div className="space-y-2">
                            {historyExercises.map((ex, idx) => (
                              <div key={idx} className="flex items-center gap-3 text-sm overflow-hidden max-w-full">
                                <span className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center text-[10px] font-bold text-green-600 shrink-0 flex-none">
                                  {idx + 1}
                                </span>
                                <span className="flex-1 min-w-0 truncate">{ex.exerciseName}</span>
                                <span className="text-muted-foreground text-xs shrink-0 flex-none">
                                  {ex.sets}×{ex.reps || '?'}
                                  {ex.weight ? ` • ${ex.weight}kg` : ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Žádné záznamy cviků
                          </p>
                        )
                      ) : day.isMissed ? (
                        <p className="text-sm text-destructive/70">
                          Tento trénink byl vynechán
                        </p>
                      ) : day.isShiftedDay && day.isFuture ? (
                        <p className="text-sm text-blue-500/70">
                          Doplnkový trénink z prvého týždňa
                        </p>
                      ) : day.isFuture ? (
                        <p className="text-sm text-muted-foreground">
                          Tento trénink je naplánován na později
                        </p>
                      ) : day.isToday && !day.isCompleted ? (
                        <p className="text-sm text-muted-foreground">
                          Cviky budou vygenerovány při začátku tréninku
                        </p>
                      ) : selectedDayExercises.length > 0 ? (
                        <div className="space-y-2">
                          {selectedDayExercises.map((ex, idx) => (
                            <div key={ex.id} className="flex items-center gap-3 text-sm overflow-hidden max-w-full">
                              <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 flex-none">
                                {idx + 1}
                              </span>
                              <span className="flex-1 min-w-0 truncate">{ex.exerciseName}</span>
                              <span className="text-muted-foreground text-xs shrink-0 flex-none">{ex.sets}×{ex.repMin}-{ex.repMax}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Žádné informace o tréninku
                        </p>
                      )}
                    </>
                  );
                })()}
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Show extend workout option - only as a floating card when appropriate */}
        {/* This is now handled in WorkoutSession after completion */}

        {/* Show bonus workout option on non-training days */}
        {(() => {
          const todayTrainingDay = daysInViewingWeek.find(d => d.isToday);
          const isNonTrainingDay = isViewingCurrentWeek && !todayTrainingDay;
          
          if (!isNonTrainingDay || isWorkoutActive) return null;
          
          return (
            <div className="px-4 mb-4">
              <Card className="p-6 bg-gradient-to-br from-amber-500/10 via-background to-amber-500/5 border-amber-500/20">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center">
                    <Star className="w-6 h-6 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Bonusový trénink</h3>
                    <p className="text-sm text-muted-foreground">
                      Dnes nemáš naplánovaný trénink
                    </p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground mb-4">
                  Chceš přesto zacvičit? Vygeneruj si bonusový trénink, který se nepočítá do tvého plánu.
                </p>

                <ExtendWorkoutSelector 
                  onConfirm={generateBonusWorkout}
                  isLoading={isGeneratingBonusWorkout}
                />
              </Card>
            </div>
          );
        })()}

        {/* Bonus workouts completed today */}
        {todayBonusWorkouts.length > 0 && isViewingCurrentWeek && (
          <div className="px-4 mb-4">
            <Card className="p-4 bg-amber-500/5 border-amber-500/30">
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-4 h-4 text-amber-500" />
                <h3 className="font-semibold text-sm">Bonusové tréninky dnes</h3>
              </div>
              <div className="space-y-2">
                {todayBonusWorkouts.map((workout, idx) => (
                  <div key={workout.sessionId} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Bonus #{idx + 1}
                    </span>
                    <Badge variant="outline" className="text-amber-600 border-amber-500/50">
                      <Check className="w-3 h-3 mr-1" />
                      Dokončeno
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Current Day Preview - only when today is a training day, viewing current week, and not completed */}
        {(() => {
          const todayTrainingDay = daysInViewingWeek.find(d => d.isToday);
          const showPreview = isViewingCurrentWeek && 
            todayTrainingDay && 
            !todayTrainingDay.isCompleted && 
            !todayTrainingDay.isMissed &&
            selectedDayIndex === null;
          
          if (!showPreview || !todayTrainingDay) return null;
          
          return (
            <div className="px-4">
              <Card className="p-4 border-primary/30 bg-primary/5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-bold">
                      Dnešní trénink
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {todayTrainingDay.dayName} • {todayTrainingDay.workoutName}
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
                    {generatedExercises.map((ex, idx) => (
                      <div key={ex.id} className="flex items-center gap-3 text-sm overflow-hidden max-w-full">
                        <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0 flex-none">
                          {idx + 1}
                        </span>
                        <span className="flex-1 min-w-0 truncate">{ex.exerciseName}</span>
                        <span className="text-xs text-muted-foreground shrink-0 flex-none">{ex.sets}×</span>
                      </div>
                    ))}
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
          );
        })()}

        {/* Action Button - only when today is a training day and not completed */}
        {(() => {
          const todayTrainingDay = daysInViewingWeek.find(d => d.isToday);
          const showButton = isViewingCurrentWeek && 
            todayTrainingDay && 
            !todayTrainingDay.isCompleted && 
            !todayTrainingDay.isMissed;
          
          if (!showButton) return null;
          
          return (
            <div className="fixed bottom-24 left-4 right-4 max-w-md mx-auto flex gap-2">
              {/* Regenerate exercises button - only show when exercises are already generated */}
              {generatedExercises.length > 0 && (
                <Button 
                  size="lg" 
                  variant="outline"
                  className="gap-2 shadow-lg"
                  onClick={handleRegenerateExercises}
                  disabled={isGeneratingDayExercises}
                >
                  <RefreshCw className={cn("w-5 h-5", isGeneratingDayExercises && "animate-spin")} />
                </Button>
              )}
              <Button 
                size="lg" 
                className="flex-1 gap-2 shadow-lg"
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
          );
        })()}

        {/* Cancel Plan Confirmation Dialog */}
        <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Zrušit tréninkový plán?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Tato akce je nevratná. Ztratíš veškerý dosavadní progress ({totalCompletedDays} dokončených tréninků). 
                Nový plán začne od prvního týdne a prvního dne.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Zrušit</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleCancelPlan}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Ano, zrušit plán
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Plan Completed Dialog - Auto-regenerate */}
        <AlertDialog open={showPlanCompleteDialog} onOpenChange={setShowPlanCompleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-xl">
                <CheckCircle2 className="w-6 h-6 text-primary" />
                Plán dokončen! 🎉
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>
                  Gratulujeme! Dokončil jsi všech <strong>{totalDaysInPlan}</strong> tréninků
                  v rámci <strong>{totalWeeks}</strong>-týdenního plánu "{goalInfo?.name}".
                </p>
                {isStreakActive && (
                  <div className="flex items-center gap-2 bg-orange-500/10 text-orange-500 px-3 py-2 rounded-lg">
                    <Flame className="w-5 h-5" />
                    <span className="font-semibold">Streak: {currentStreak} dní</span>
                    <span className="text-sm opacity-70">(zůstává zachován!)</span>
                  </div>
                )}
                <p className="text-sm">
                  Automaticky ti vygenerujeme nový plán podle tvého profilu.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction 
                onClick={handleRegeneratePlan}
                disabled={isRegeneratingPlan}
                className="gap-2"
              >
                {isRegeneratingPlan ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Generuji...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Pokračovat v tréninku
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Gym Closed Warning Dialog */}
        <AlertDialog open={showGymClosedWarning} onOpenChange={setShowGymClosedWarning}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Posilovna je zavřená
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>
                  <strong>{closedGymName}</strong> je momentálně zavřená. Nemůžeš začít trénink.
                </p>
                <p className="text-sm">
                  Můžeš vybrat jinou posilovnu nebo počkat na otevírací dobu.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel>Zavřít</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => {
                  setShowGymClosedWarning(false);
                  navigate('/map');
                }}
                className="gap-2"
              >
                <MapPin className="w-4 h-4" />
                Vybrat jinou posilovnu
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Missing Exercises Dialog */}
        <AlertDialog open={showMissingExercisesDialog} onOpenChange={setShowMissingExercisesDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                Plán nemá vygenerované cviky
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-3" asChild>
                <div>
                  <p>
                    Tvůj tréninkový plán nemá vygenerované cviky. To se může stát, když:
                  </p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    <li>Změnila se dostupná vybavení v posilovně</li>
                    <li>Plán byl vytvořen bez vybrané posilovny</li>
                  </ul>
                  <p className="text-sm">
                    Klikni na tlačítko níže pro vygenerování nového plánu.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel>Zrušit</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleRegeneratePlan}
                disabled={isRegeneratingPlan}
                className="gap-2"
              >
                {isRegeneratingPlan ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Generuji plán...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Regenerovat plán
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Gym Confirmation Dialog */}
        <AlertDialog open={showGymConfirmDialog} onOpenChange={setShowGymConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                Potvrzení posilovny
              </AlertDialogTitle>
              <AlertDialogDescription>
                Jdeš cvičit do <strong>{confirmedGymName}</strong>?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel onClick={handleChangeGym}>
                Vybrat jinou
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmGymAndStart} className="gap-2">
                <Play className="w-4 h-4" />
                Ano, začít trénink
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Notification Onboarding Drawer */}
        <NotificationOnboardingDrawer
          open={showNotificationOnboarding}
          onOpenChange={setShowNotificationOnboarding}
          onAccept={async () => {
            await subscribeToPush();
            await markOnboardingShown();
          }}
          onDecline={async () => {
            await markOnboardingShown();
          }}
        />
      </div>
    </PageTransition>
  );
};

export default Training;
