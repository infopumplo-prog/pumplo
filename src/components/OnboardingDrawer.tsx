import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useWorkoutGenerator } from '@/hooks/useWorkoutGenerator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { TrainingGoalId, UserLevel, getSplitFromFrequency, SPLIT_INFO, PRIMARY_GOAL_TO_TRAINING_GOAL } from '@/lib/trainingGoals';
import { getBeginnerDefaultDuration } from '@/lib/onboardingTypes';
import {
  OnboardingGoalStep,
  OnboardingLevelStep,
  OnboardingDaysStep,
  OnboardingTimeStep,
  OnboardingDemographicsStep,
  OnboardingInjuriesStep,
  OnboardingEquipmentStep,
} from '@/components/onboarding';

const TOTAL_STEPS = 7; // 0-6 (no registration step in edit mode)

interface OnboardingDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const OnboardingDrawer = ({ open, onOpenChange }: OnboardingDrawerProps) => {
  const { profile, updateProfile, refetch } = useUserProfile();
  const { generateWorkoutPlan, isGenerating } = useWorkoutGenerator();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [primaryGoal, setPrimaryGoal] = useState<TrainingGoalId | null>(null);
  const [userLevel, setUserLevel] = useState<UserLevel | null>(null);
  const [trainingDays, setTrainingDays] = useState<string[]>([]);
  const [preferredTime, setPreferredTime] = useState<string | null>(null);
  const [trainingDuration, setTrainingDuration] = useState(45);
  const [gender, setGender] = useState<string | null>(null);
  const [age, setAge] = useState<string>('');
  const [height, setHeight] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [injuries, setInjuries] = useState<string[]>([]);
  const [equipmentPreference, setEquipmentPreference] = useState<string | null>(null);
  const [hasJustCompleted, setHasJustCompleted] = useState(false);

  const isEditMode = profile?.onboarding_completed ?? false;

  // Load existing profile data - skip if we just completed to prevent reset
  useEffect(() => {
    if (profile && !hasJustCompleted) {
      // For edit mode, always start at step 0 to show all answers
      // For new users, use their saved step
      setCurrentStep(isEditMode ? 0 : Math.min(profile.current_step || 0, TOTAL_STEPS - 1));
      
      // Map old goal IDs to new ones if necessary
      const mappedGoal = profile.primary_goal 
        ? (PRIMARY_GOAL_TO_TRAINING_GOAL[profile.primary_goal] || null)
        : null;
      setPrimaryGoal(mappedGoal);
      
      setUserLevel(profile.user_level as UserLevel | null);
      setTrainingDays(profile.training_days || []);
      setPreferredTime(profile.preferred_time);
      setTrainingDuration(profile.training_duration_minutes || 45);
      setGender(profile.gender);
      setAge(profile.age?.toString() || '');
      setHeight(profile.height_cm?.toString() || '');
      setWeight(profile.weight_kg?.toString() || '');
      setInjuries(profile.injuries || []);
      setEquipmentPreference(profile.equipment_preference);
    }
  }, [profile, open, hasJustCompleted, isEditMode]);
  
  // Reset hasJustCompleted when drawer closes (for next open)
  useEffect(() => {
    if (!open) {
      setHasJustCompleted(false);
    }
  }, [open]);

  const progress = ((currentStep + 1) / TOTAL_STEPS) * 100;

  // Check if a specific step is valid
  const isStepValidAt = (step: number): boolean => {
    switch (step) {
      case 0: return primaryGoal !== null;
      case 1: return userLevel !== null;
      case 2: return trainingDays.length > 0;
      case 3: return preferredTime !== null;
      case 4: return gender !== null && age !== '' && height !== '' && weight !== '';
      case 5: return injuries.length > 0;
      case 6: return equipmentPreference !== null;
      default: return false;
    }
  };

  const isStepValid = (): boolean => isStepValidAt(currentStep);

  // Check if all steps are valid (for complete questionnaire)
  const areAllStepsValid = (): boolean => {
    for (let i = 0; i < TOTAL_STEPS; i++) {
      if (!isStepValidAt(i)) return false;
    }
    return true;
  };

  const handleClose = async (isOpen: boolean) => {
    if (!isOpen) {
      // Save all data and determine if onboarding is complete
      const allValid = areAllStepsValid();
      const trainingSplit = trainingDays.length > 0 && userLevel
        ? getSplitFromFrequency(trainingDays.length, userLevel)
        : null;
      
      await updateProfile({
        gender,
        primary_goal: primaryGoal,
        training_days: trainingDays,
        preferred_time: preferredTime,
        training_duration_minutes: trainingDuration,
        age: age ? parseInt(age) : null,
        height_cm: height ? parseInt(height) : null,
        weight_kg: weight ? parseFloat(weight) : null,
        injuries,
        training_split: trainingSplit,
        equipment_preference: equipmentPreference,
        user_level: userLevel as any,
        current_step: currentStep,
        onboarding_completed: allValid,
      });
      
      await refetch();
      
      if (allValid) {
        toast({ title: 'Uloženo', description: 'Změny byly uloženy.' });
      } else {
        toast({ 
          title: 'Dotazník není kompletní', 
          description: 'Některé odpovědi chybí. Vyplň je prosím.',
          variant: 'destructive'
        });
      }
    }
    onOpenChange(isOpen);
  };

  const handleNext = () => {
    // In edit mode, allow navigation even if step is not valid
    // For new users, require valid step to proceed
    if (currentStep < TOTAL_STEPS - 1) {
      if (isEditMode || isStepValid()) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    if (!areAllStepsValid()) {
      toast({ 
        title: 'Chybí odpovědi', 
        description: 'Prosím vyplň všechny povinné otázky.',
        variant: 'destructive'
      });
      return;
    }
    
    // Set flag to prevent useEffect from resetting state during refetch
    setHasJustCompleted(true);
    
    const trainingSplit = trainingDays.length > 0 && userLevel
      ? getSplitFromFrequency(trainingDays.length, userLevel)
      : null;
    
    // 1. Always save profile first
    await updateProfile({
      gender,
      primary_goal: primaryGoal,
      training_days: trainingDays,
      preferred_time: preferredTime,
      training_duration_minutes: trainingDuration,
      age: age ? parseInt(age) : null,
      height_cm: height ? parseInt(height) : null,
      weight_kg: weight ? parseFloat(weight) : null,
      injuries,
      training_split: trainingSplit,
      equipment_preference: equipmentPreference,
      user_level: userLevel as any,
      onboarding_completed: true,
      current_step: TOTAL_STEPS - 1,
    });
    
    // 2. Check if there's an active workout plan
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      await refetch();
      onOpenChange(false);
      return;
    }
    
    const { data: activePlan } = await supabase
      .from('user_workout_plans')
      .select('id, training_days')
      .eq('user_id', userData.user.id)
      .eq('is_active', true)
      .maybeSingle();
    
    if (!activePlan) {
      // NO active plan exists -> create new one with training_days snapshot
      const selectedGymId = profile?.selected_gym_id;
      
      if (primaryGoal) {
        // Reset day index first
        await supabase
          .from('user_profiles')
          .update({ current_day_index: 0 })
          .eq('user_id', userData.user.id);
        
        // If user has a gym selected, generate workout plan with exercises
        if (selectedGymId && userLevel) {
          console.log('[OnboardingDrawer] Generating workout plan with exercises...');
          
          // generateWorkoutPlan creates the plan and assigns exercises
          const planId = await generateWorkoutPlan(
            selectedGymId,
            primaryGoal,
            userLevel as UserLevel,
            injuries || [],
            equipmentPreference,
            trainingDuration // Pass duration for dynamic slot calculation
          );
          
          if (planId) {
            // Update the plan with snapshotted training_days (generator doesn't set this)
            await supabase
              .from('user_workout_plans')
              .update({ training_days: trainingDays })
              .eq('id', planId);
            
            console.log('[OnboardingDrawer] Plan created with exercises, ID:', planId);
          }
        } else {
          // No gym selected - create empty plan (exercises will be generated when gym is selected)
          console.log('[OnboardingDrawer] No gym selected, creating empty plan...');
          
          // Deactivate any leftover plans
          await supabase
            .from('user_workout_plans')
            .update({ is_active: false })
            .eq('user_id', userData.user.id);
          
          // Create plan without exercises
          await supabase
            .from('user_workout_plans')
            .insert({
              user_id: userData.user.id,
              goal_id: primaryGoal,
              is_active: true,
              started_at: new Date().toISOString(),
              current_week: 1,
              gym_id: null,
              training_days: trainingDays // SNAPSHOT of current training days
            });
        }
      }
      
      await refetch();
      toast({ title: 'Hotovo!', description: 'Tvůj profil byl vytvořen a plán připraven!' });
    } else {
      // Active plan EXISTS -> DO NOT touch it!
      // Just save profile and show warning
      await refetch();
      toast({ 
        title: 'Změny uloženy', 
        description: 'Změny se projeví až v novém tréninkovém plánu.',
      });
    }
    
    onOpenChange(false);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <OnboardingGoalStep value={primaryGoal} onChange={(goal) => {
          setPrimaryGoal(goal);
          if (userLevel === 'beginner') setTrainingDuration(getBeginnerDefaultDuration(goal));
        }} onNext={handleNext} />;
      case 1:
        return <OnboardingLevelStep value={userLevel} onChange={(level) => {
          setUserLevel(level);
          if (level === 'beginner') setTrainingDuration(getBeginnerDefaultDuration(primaryGoal));
        }} />;
      case 2:
        return <OnboardingDaysStep value={trainingDays} onChange={setTrainingDays} />;
      case 3:
        return (
          <OnboardingTimeStep
            preferredTime={preferredTime}
            duration={trainingDuration}
            onTimeChange={setPreferredTime}
            onDurationChange={setTrainingDuration}
            userLevel={userLevel}
            goalId={primaryGoal}
          />
        );
      case 4:
        return (
          <OnboardingDemographicsStep
            gender={gender}
            age={age}
            height={height}
            weight={weight}
            onGenderChange={setGender}
            onAgeChange={setAge}
            onHeightChange={setHeight}
            onWeightChange={setWeight}
          />
        );
      case 5:
        return <OnboardingInjuriesStep value={injuries} onChange={setInjuries} />;
      case 6:
        return <OnboardingEquipmentStep value={equipmentPreference} onChange={setEquipmentPreference} />;
      default:
        return null;
    }
  };

  return (
    <Drawer open={open} onOpenChange={handleClose}>
      <DrawerContent className="max-h-[90vh] flex flex-col">
        <DrawerTitle className="sr-only">Dotazník</DrawerTitle>
        
        {/* Header with progress */}
        <div className="px-4 pt-4 pb-4 border-b border-border">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Krok {currentStep + 1} z {TOTAL_STEPS}</span>
              <span className="font-medium text-primary">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
          
          {/* Show split info derived from frequency */}
          {trainingDays.length > 0 && userLevel && (
            <div className="mt-3 p-2 bg-muted rounded-lg text-center">
              <span className="text-xs text-muted-foreground">
                Split: <span className="font-medium text-foreground">
                  {SPLIT_INFO[getSplitFromFrequency(trainingDays.length, userLevel)].labelCz}
                </span> (podle počtu dnů: {trainingDays.length})
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="border-t border-border px-4 pt-4 pb-8">
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handlePrev}
              disabled={currentStep === 0}
              className="flex-1"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Zpět
            </Button>
            {currentStep < TOTAL_STEPS - 1 ? (
              <Button 
                onClick={handleNext} 
                className="flex-1"
                disabled={!isEditMode && !isStepValid()}
              >
                Další
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button 
                onClick={handleComplete} 
                className="flex-1 bg-green-500 hover:bg-green-600"
                disabled={!areAllStepsValid() || isGenerating}
              >
                {isEditMode ? 'Uložit' : 'Dokončit'}
              </Button>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default OnboardingDrawer;
