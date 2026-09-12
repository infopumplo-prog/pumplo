/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '@/i18n';
import i18n from '@/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useWorkoutGenerator } from '@/hooks/useWorkoutGenerator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { TrainingGoalId, UserLevel, getSplitFromFrequency, resolveSplit, SplitType, SPLIT_INFO, PRIMARY_GOAL_TO_TRAINING_GOAL } from '@/lib/trainingGoals';
import { getBeginnerDefaultDuration } from '@/lib/onboardingTypes';
import {
  OnboardingGoalStep,
  OnboardingLevelStep,
  OnboardingDaysStep,
  OnboardingTimeStep,
  OnboardingDemographicsStep,
  OnboardingInjuriesStep,
  OnboardingEquipmentStep,
  OnboardingTrainerTip,
} from '@/components/onboarding';

const TOTAL_STEPS = 7; // 0-6 (no registration step in edit mode)

interface OnboardingDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const OnboardingDrawer = ({ open, onOpenChange }: OnboardingDrawerProps) => {
  const { t } = useTranslation();
  const { profile, updateProfile, refetch } = useUserProfile();
  const { generateWorkoutPlan, isGenerating } = useWorkoutGenerator();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [primaryGoal, setPrimaryGoal] = useState<TrainingGoalId | null>(null);
  const [userLevel, setUserLevel] = useState<UserLevel | null>(null);
  const [trainingDays, setTrainingDays] = useState<string[]>([]);
  const [splitOverride, setSplitOverride] = useState<SplitType | null>(null);
  const [preferredTime, setPreferredTime] = useState<string | null>(null);
  const [trainingDuration, setTrainingDuration] = useState(45);
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [gender, setGender] = useState<string | null>(null);
  const [age, setAge] = useState<string>('');
  const [height, setHeight] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [injuries, setInjuries] = useState<string[]>([]);
  const [showTrainerTip, setShowTrainerTip] = useState(false);
  const [equipmentPreference, setEquipmentPreference] = useState<string | null>(null);
  const [hasJustCompleted, setHasJustCompleted] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

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
      setSplitOverride((profile.split_override as SplitType | null) ?? null);
      setPreferredTime(profile.preferred_time);
      setTrainingDuration(profile.training_duration_minutes || 45);
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
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
    // Během generování plánu nejde drawer zavřít (reload/zavření by nechalo rozdělaný stav)
    if (isCompleting) return;
    if (!isOpen) {
      // Save all data and determine if onboarding is complete
      const allValid = areAllStepsValid();
      const trainingSplit = trainingDays.length > 0 && userLevel
        ? resolveSplit(trainingDays.length, userLevel, splitOverride)
        : splitOverride;
      
      const saveResult = await updateProfile({
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
      split_override: splitOverride,
        equipment_preference: equipmentPreference,
        user_level: userLevel as any,
        current_step: currentStep,
        onboarding_completed: allValid,
      });

      await refetch();

      if (!saveResult.success) {
        // Save actually failed — do NOT pretend it worked (dřív se ukázalo „Uloženo" i při chybě)
        toast({
          title: 'Uložení selhalo',
          description: saveResult.error || 'Změny se nepodařilo uložit. Zkus to prosím znovu.',
          variant: 'destructive'
        });
      } else if (allValid) {
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

  const hasRealInjuries = injuries.length > 0 && !injuries.includes('none');

  const handleNext = () => {
    // In edit mode, allow navigation even if step is not valid
    // For new users, require valid step to proceed
    if (currentStep < TOTAL_STEPS - 1) {
      if (isEditMode || isStepValid()) {
        // After injuries step, show trainer tip if user has injuries
        if (currentStep === 5 && hasRealInjuries && !showTrainerTip && !isEditMode) {
          setShowTrainerTip(true);
          return;
        }
        setShowTrainerTip(false);
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handlePrev = () => {
    if (showTrainerTip) {
      setShowTrainerTip(false);
      return;
    }
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
    setIsCompleting(true);

    try {
    const trainingSplit = trainingDays.length > 0 && userLevel
      ? resolveSplit(trainingDays.length, userLevel, splitOverride)
      : splitOverride;

    // 1. Save answers first — onboarding_completed goes true only AFTER the plan
    // exists, so a reload mid-generation drops the user back into the questionnaire
    // instead of a broken half-onboarded state (tutorials firing with no plan).
    const saveResult = await updateProfile({
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
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
      split_override: splitOverride,
      equipment_preference: equipmentPreference,
      user_level: userLevel as any,
      onboarding_completed: isEditMode,
      current_step: TOTAL_STEPS - 1,
    });

    if (!saveResult.success) {
      // Zápis selhal — nepokračovat na generování a přiznat chybu (dřív se tvářilo jako úspěch)
      setHasJustCompleted(false);
      toast({
        title: 'Uložení selhalo',
        description: saveResult.error || 'Změny se nepodařilo uložit. Zkus to prosím znovu.',
        variant: 'destructive'
      });
      return;
    }

    // 2. Check if there's an active workout plan
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      await refetch();
      onOpenChange(false);
      return;
    }

    const { data: activePlan } = await supabase
      .from('user_workout_plans')
      .select('id')
      .eq('user_id', userData.user.id)
      .eq('is_active', true)
      .maybeSingle();

    // Regenerovat plán jen když se změnilo něco, co plán ovlivňuje (dny/split/cíl/úroveň/délka/vybavení/zranění).
    // Dřív se u existujícího plánu NIC nepřegenerovalo ("DO NOT touch it") → změna splitu se nikdy neprojevila.
    // Editace jména/demografie plán nepřegeneruje, aby uživatel nepřišel o rozdělaný postup.
    const sortedJoin = (a?: string[] | null) => [...(a || [])].sort().join(',');
    const mappedOldGoal = profile?.primary_goal
      ? (PRIMARY_GOAL_TO_TRAINING_GOAL[profile.primary_goal] || null)
      : null;
    const planInputsChanged =
      !profile ||
      sortedJoin(trainingDays) !== sortedJoin(profile.training_days) ||
      ((splitOverride ?? null) !== ((profile.split_override as SplitType | null) ?? null)) ||
      primaryGoal !== mappedOldGoal ||
      userLevel !== (profile.user_level ?? null) ||
      trainingDuration !== (profile.training_duration_minutes || 45) ||
      ((equipmentPreference ?? null) !== (profile.equipment_preference ?? null)) ||
      sortedJoin(injuries) !== sortedJoin(profile.injuries);

    const shouldRegenerate = Boolean(primaryGoal) && (!activePlan || planInputsChanged);

    if (shouldRegenerate && primaryGoal) {
      const selectedGymId = profile?.selected_gym_id;

      // Deaktivovat stávající plán — stavíme nový
      if (activePlan?.id) {
        await supabase
          .from('user_workout_plans')
          .update({ is_active: false })
          .eq('id', activePlan.id);
      }

      if (selectedGymId && userLevel) {
        const planId = await generateWorkoutPlan(
          selectedGymId,
          primaryGoal,
          userLevel as UserLevel,
          injuries || [],
          equipmentPreference,
          trainingDuration,
          trainingDays, // předat dny → generátor odvodí správný split (dřív chybělo)
        );

        if (planId) {
          await supabase
            .from('user_workout_plans')
            .update({ training_days: trainingDays })
            .eq('id', planId);
        } else {
          // Generování selhalo — reaktivovat starý plán, ať uživatel nezůstane bez plánu
          if (activePlan?.id) {
            await supabase
              .from('user_workout_plans')
              .update({ is_active: true })
              .eq('id', activePlan.id);
          }
          setHasJustCompleted(false);
          toast({
            title: t('onboarding.generate_failed_title'),
            description: t('onboarding.generate_failed_desc'),
            variant: 'destructive',
          });
          return;
        }
      } else {
        // Bez posilovny — deaktivovat zbytky + vytvořit prázdný plán (cviky se doplní po výběru gymu)
        await supabase
          .from('user_workout_plans')
          .update({ is_active: false })
          .eq('user_id', userData.user.id);

        await supabase
          .from('user_workout_plans')
          .insert({
            user_id: userData.user.id,
            goal_id: primaryGoal,
            is_active: true,
            started_at: new Date().toISOString(),
            current_week: 1,
            gym_id: null,
            training_days: trainingDays,
          });
      }

      // Nový plán začíná od začátku
      await supabase
        .from('user_profiles')
        .update({ current_day_index: 0 })
        .eq('user_id', userData.user.id);

      await updateProfile({ onboarding_completed: true });
      toast({
        title: 'Hotovo!',
        description: activePlan ? 'Plán byl přegenerován podle nových odpovědí.' : 'Tvůj profil byl vytvořen a plán připraven!',
      });
    } else {
      // Nic plán-ovlivňujícího se nezměnilo (nebo chybí cíl) — stávající plán necháme být
      await updateProfile({ onboarding_completed: true });
      toast({ title: 'Uloženo', description: 'Změny byly uloženy.' });
    }

    onOpenChange(false);
    } finally {
      setIsCompleting(false);
    }
  };

  const renderStep = () => {
    if (showTrainerTip) {
      return <OnboardingTrainerTip onContinue={() => {
        setShowTrainerTip(false);
        setCurrentStep(prev => prev + 1);
      }} />;
    }

    switch (currentStep) {
      case 0:
        return <OnboardingGoalStep value={primaryGoal} onChange={(goal) => {
          setPrimaryGoal(goal);
          if (userLevel === 'beginner') setTrainingDuration(getBeginnerDefaultDuration(goal));
        }} onNext={() => setCurrentStep(prev => prev + 1)} />;
      case 1:
        return <OnboardingLevelStep value={userLevel} onChange={(level) => {
          setUserLevel(level);
          if (level === 'beginner') setTrainingDuration(getBeginnerDefaultDuration(primaryGoal));
        }} />;
      case 2:
        // Volba splitu vypnutá do konzultace s trenérem (8. 8.) — viz Auth.tsx.
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
            firstName={firstName}
            lastName={lastName}
            gender={gender}
            age={age}
            height={height}
            weight={weight}
            onFirstNameChange={setFirstName}
            onLastNameChange={setLastName}
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
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">{t('onboarding.step_of', { n: currentStep + 1, total: TOTAL_STEPS })}</span>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {(['cs', 'en'] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => changeLanguage(lang)}
                      className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
                        i18n.language === lang
                          ? 'bg-primary/20 text-primary'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {lang === 'cs' ? '🇨🇿' : '🇬🇧'}
                    </button>
                  ))}
                </div>
                <span className="font-medium text-primary">{Math.round(progress)}%</span>
              </div>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
          
          {/* Show split info derived from frequency */}
          {trainingDays.length > 0 && userLevel && (
            <div className="mt-3 p-2 bg-muted rounded-lg text-center">
              <span className="text-xs text-muted-foreground">
                Split: <span className="font-medium text-foreground">
                  {SPLIT_INFO[resolveSplit(trainingDays.length, userLevel, splitOverride)].labelCz}
                </span> {splitOverride ? '(ručně zvoleno)' : `(podle počtu dnů: ${trainingDays.length})`}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {isCompleting ? (
            <div className="flex flex-col items-center justify-center text-center py-16">
              <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
              <p className="font-semibold">{t('onboarding.generating_title')}</p>
              <p className="text-sm text-muted-foreground mt-1">{t('onboarding.generating_desc')}</p>
            </div>
          ) : (
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
          )}
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
                disabled={!areAllStepsValid() || isGenerating || isCompleting}
              >
                {isCompleting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('onboarding.generating_button')}</>
                ) : (
                  isEditMode ? 'Uložit' : 'Dokončit'
                )}
              </Button>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default OnboardingDrawer;
