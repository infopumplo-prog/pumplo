import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useToast } from '@/hooks/use-toast';

const GOALS = [
  { id: 'muscle', label: 'Nabrat svaly', emoji: '💪' },
  { id: 'fat_loss', label: 'Zhubnout / shodit tuk', emoji: '🔥' },
  { id: 'tone', label: 'Zpevnit postavu', emoji: '✨' },
  { id: 'strength', label: 'Získat sílu', emoji: '🏋️' },
  { id: 'endurance', label: 'Zlepšit kondici', emoji: '🏃' },
  { id: 'consistency', label: 'Chci hlavně vydržet cvičit dlouhodobě', emoji: '📅' },
];

const DAYS = [
  { id: 'monday', label: 'Pondělí' },
  { id: 'tuesday', label: 'Úterý' },
  { id: 'wednesday', label: 'Středa' },
  { id: 'thursday', label: 'Čtvrtek' },
  { id: 'friday', label: 'Pátek' },
  { id: 'saturday', label: 'Sobota' },
  { id: 'sunday', label: 'Neděle' },
];

const TIMES = [
  { id: 'morning', label: 'Ráno', time: '6:00 - 10:00', emoji: '🌅' },
  { id: 'late_morning', label: 'Dopoledne', time: '10:00 - 14:00', emoji: '☀️' },
  { id: 'afternoon', label: 'Odpoledne', time: '14:00 - 18:00', emoji: '🌤️' },
  { id: 'evening', label: 'Večer', time: '18:00 - 22:00', emoji: '🌙' },
];

const INJURIES = [
  { id: 'neck', label: 'Krk' },
  { id: 'upper_back', label: 'Horní záda' },
  { id: 'lower_back', label: 'Bedra' },
  { id: 'shoulders', label: 'Ramena' },
  { id: 'elbows', label: 'Lokty' },
  { id: 'wrists', label: 'Zápěstí' },
  { id: 'hips', label: 'Kyčle' },
  { id: 'knees', label: 'Kolena' },
  { id: 'ankles', label: 'Kotníky' },
  { id: 'none', label: 'Nemám žádné' },
];

const SPLITS = [
  { id: 'full_body', label: 'Full Body', description: 'Celé tělo každý trénink' },
  { id: 'upper_lower', label: 'Horní / Dolní', description: 'Střídání horní a dolní části těla' },
  { id: 'ppl', label: 'Push / Pull / Legs', description: 'Rotace: tlak, tah, nohy' },
];

const EQUIPMENT = [
  { id: 'machines', label: 'Hlavně stroje' },
  { id: 'free_weights', label: 'Více volných vah' },
  { id: 'intense', label: 'Krátké intenzivní tréninky' },
];

const MOTIVATIONS = [
  { id: 'challenges', label: 'Výzvy a odměny', emoji: '🏆' },
  { id: 'progress', label: 'Viditelný progres', emoji: '📈' },
  { id: 'routine', label: 'Tréninková rutina', emoji: '📋' },
  { id: 'friends', label: 'Výzvy s kamarády', emoji: '👥' },
  { id: 'done', label: 'Odháčkování úkolů ("done" pocit)', emoji: '✅' },
];

const USER_LEVELS = [
  { id: 'beginner', label: 'Začátečník', description: 'Méně než 1 rok tréninku', emoji: '🌱' },
  { id: 'intermediate', label: 'Pokročilý', description: '1-3 roky pravidelného tréninku', emoji: '💪' },
  { id: 'advanced', label: 'Expert', description: 'Více než 3 roky intenzivního tréninku', emoji: '🔥' },
];

const TOTAL_STEPS = 9;

interface OnboardingDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const OnboardingDrawer = ({ open, onOpenChange }: OnboardingDrawerProps) => {
  const { profile, updateProfile, refetch } = useUserProfile();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [gender, setGender] = useState<string | null>(null);
  const [primaryGoal, setPrimaryGoal] = useState<string | null>(null);
  const [secondaryGoals, setSecondaryGoals] = useState<string[]>([]);
  const [trainingDays, setTrainingDays] = useState<string[]>([]);
  const [preferredTime, setPreferredTime] = useState<string | null>(null);
  const [trainingDuration, setTrainingDuration] = useState(45);
  const [age, setAge] = useState<string>('');
  const [height, setHeight] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [injuries, setInjuries] = useState<string[]>([]);
  const [trainingSplit, setTrainingSplit] = useState<string | null>(null);
  const [equipmentPreference, setEquipmentPreference] = useState<string | null>(null);
  const [motivations, setMotivations] = useState<string[]>([]);
  const [userLevel, setUserLevel] = useState<string | null>(null);

  const isEditMode = profile?.onboarding_completed ?? false;

  // Load existing profile data
  useEffect(() => {
    if (profile) {
      // For edit mode, always start at step 0 to show all answers
      // For new users, use their saved step
      setCurrentStep(isEditMode ? 0 : Math.min(profile.current_step || 0, TOTAL_STEPS - 1));
      setGender(profile.gender);
      setPrimaryGoal(profile.primary_goal);
      setSecondaryGoals(profile.secondary_goals || []);
      setTrainingDays(profile.training_days || []);
      setPreferredTime(profile.preferred_time);
      setTrainingDuration(profile.training_duration_minutes || 45);
      setAge(profile.age?.toString() || '');
      setHeight(profile.height_cm?.toString() || '');
      setWeight(profile.weight_kg?.toString() || '');
      setInjuries(profile.injuries || []);
      setTrainingSplit(profile.training_split);
      setEquipmentPreference(profile.equipment_preference);
      setMotivations(profile.motivations || []);
      setUserLevel(profile.user_level);
    }
  }, [profile, open]);

  const progress = ((currentStep + 1) / TOTAL_STEPS) * 100;

  // Check if a specific step is valid
  const isStepValidAt = (step: number): boolean => {
    switch (step) {
      case 0:
        return gender !== null;
      case 1:
        return primaryGoal !== null;
      case 2:
        return trainingDays.length > 0;
      case 3:
        return preferredTime !== null;
      case 4:
        return age !== '' && height !== '' && weight !== '';
      case 5:
        return injuries.length > 0;
      case 6:
        return userLevel !== null;
      case 7:
        return trainingSplit !== null;
      case 8:
        return motivations.length > 0;
      default:
        return false;
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

  const handleGoalClick = (goalId: string) => {
    if (primaryGoal === goalId) {
      // Clicking primary goal converts it to secondary
      setSecondaryGoals(prev => [...prev, goalId]);
      setPrimaryGoal(null);
    } else if (secondaryGoals.includes(goalId)) {
      // Clicking secondary removes it, unless we have no primary (then make it primary)
      if (!primaryGoal) {
        setPrimaryGoal(goalId);
        setSecondaryGoals(prev => prev.filter(g => g !== goalId));
      } else {
        setSecondaryGoals(prev => prev.filter(g => g !== goalId));
      }
    } else {
      // New goal clicked
      if (!primaryGoal) {
        setPrimaryGoal(goalId);
      } else {
        setSecondaryGoals(prev => [...prev, goalId]);
      }
    }
  };

  const handleDayToggle = (dayId: string) => {
    setTrainingDays(prev => 
      prev.includes(dayId) ? prev.filter(d => d !== dayId) : [...prev, dayId]
    );
  };

  const handleInjuryToggle = (injuryId: string) => {
    if (injuryId === 'none') {
      setInjuries(prev => prev.includes('none') ? [] : ['none']);
    } else {
      setInjuries(prev => {
        const newInjuries = prev.filter(i => i !== 'none');
        return newInjuries.includes(injuryId) 
          ? newInjuries.filter(i => i !== injuryId) 
          : [...newInjuries, injuryId];
      });
    }
  };

  const handleMotivationToggle = (motId: string) => {
    setMotivations(prev => 
      prev.includes(motId) ? prev.filter(m => m !== motId) : [...prev, motId]
    );
  };

  const handleClose = async (isOpen: boolean) => {
    if (!isOpen) {
      // Save all data and determine if onboarding is complete
      const allValid = areAllStepsValid();
      
      await updateProfile({
        gender,
        primary_goal: primaryGoal,
        secondary_goals: secondaryGoals,
        training_days: trainingDays,
        preferred_time: preferredTime,
        training_duration_minutes: trainingDuration,
        age: age ? parseInt(age) : null,
        height_cm: height ? parseInt(height) : null,
        weight_kg: weight ? parseFloat(weight) : null,
        injuries,
        training_split: trainingSplit,
        equipment_preference: equipmentPreference,
        motivations,
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
    
    await updateProfile({
      gender,
      primary_goal: primaryGoal,
      secondary_goals: secondaryGoals,
      training_days: trainingDays,
      preferred_time: preferredTime,
      training_duration_minutes: trainingDuration,
      age: age ? parseInt(age) : null,
      height_cm: height ? parseInt(height) : null,
      weight_kg: weight ? parseFloat(weight) : null,
      injuries,
      training_split: trainingSplit,
      equipment_preference: equipmentPreference,
      motivations,
      user_level: userLevel as any,
      onboarding_completed: true,
      current_step: TOTAL_STEPS - 1,
    });
    
    await refetch();
    
    toast({ title: 'Hotovo!', description: isEditMode ? 'Změny byly uloženy.' : 'Tvůj profil byl vytvořen.' });
    onOpenChange(false);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-center">Pohlaví</h2>
            <div className="grid grid-cols-2 gap-4">
              {['Muž', 'Žena'].map((g) => (
                <button
                  key={g}
                  onClick={() => setGender(g.toLowerCase())}
                  className={`p-6 rounded-2xl border-2 transition-all ${
                    gender === g.toLowerCase()
                      ? 'border-primary bg-primary/10 shadow-primary'
                      : 'border-border bg-card hover:border-primary/50'
                  }`}
                >
                  <span className="text-4xl block mb-2">{g === 'Muž' ? '👨' : '👩'}</span>
                  <span className="font-medium">{g}</span>
                </button>
              ))}
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold">Co je tvůj hlavní cíl?</h2>
              <p className="text-muted-foreground mt-2 text-sm">
                Klikni jednou pro hlavní cíl, znovu pro vedlejší
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {GOALS.map((goal) => {
                const isPrimary = primaryGoal === goal.id;
                const isSecondary = secondaryGoals.includes(goal.id);
                return (
                  <button
                    key={goal.id}
                    onClick={() => handleGoalClick(goal.id)}
                    className={`p-4 rounded-xl border-2 transition-all text-left flex items-center gap-3 ${
                      isPrimary
                        ? 'border-primary bg-primary/20 shadow-primary'
                        : isSecondary
                        ? 'border-primary/50 bg-primary/10'
                        : 'border-border bg-card hover:border-primary/50'
                    }`}
                  >
                    <span className="text-2xl">{goal.emoji}</span>
                    <span className="font-medium flex-1">{goal.label}</span>
                    {isPrimary && <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full">Hlavní</span>}
                    {isSecondary && <span className="text-xs bg-primary/30 text-primary px-2 py-1 rounded-full">Vedlejší</span>}
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-center">Ve které dny v týdnu chceš cvičit?</h2>
            <div className="grid grid-cols-1 gap-2">
              {DAYS.map((day) => (
                <button
                  key={day.id}
                  onClick={() => handleDayToggle(day.id)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    trainingDays.includes(day.id)
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card hover:border-primary/50'
                  }`}
                >
                  <span className="font-medium">{day.label}</span>
                </button>
              ))}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-center">V jaký čas nejraději cvičíš?</h2>
            <div className="grid grid-cols-1 gap-3">
              {TIMES.map((time) => (
                <button
                  key={time.id}
                  onClick={() => setPreferredTime(time.id)}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    preferredTime === time.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{time.emoji}</span>
                    <div>
                      <span className="font-medium block">{time.label}</span>
                      <span className="text-sm text-muted-foreground">{time.time}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            
            <div className="space-y-4 pt-4">
              <h3 className="text-lg font-semibold text-center">Kolik minut chceš mít jeden trénink?</h3>
              <div className="px-4">
                <div className="text-center mb-4">
                  <span className="text-4xl font-bold text-primary">{trainingDuration}</span>
                  <span className="text-muted-foreground ml-1">min</span>
                </div>
                <Slider
                  value={[trainingDuration]}
                  onValueChange={(value) => setTrainingDuration(value[0])}
                  min={30}
                  max={120}
                  step={5}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-muted-foreground mt-2">
                  <span>30</span>
                  <span>60</span>
                  <span>90</span>
                  <span>120 min</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-center">O tobě</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Kolik ti je let?</label>
                <Input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="25"
                  className="text-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Kolik měříš? (cm)</label>
                <Input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="175"
                  className="text-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Kolik vážíš? (kg)</label>
                <Input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="75"
                  className="text-lg"
                />
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold">Máš nějaké zranění / omezení?</h2>
              <p className="text-muted-foreground mt-2 text-sm">Můžeš vybrat více částí těla</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {INJURIES.map((injury) => (
                <button
                  key={injury.id}
                  onClick={() => handleInjuryToggle(injury.id)}
                  className={`p-3 rounded-xl border-2 transition-all ${
                    injuries.includes(injury.id)
                      ? injury.id === 'none' 
                        ? 'border-green-500 bg-green-500/10'
                        : 'border-destructive bg-destructive/10'
                      : 'border-border bg-card hover:border-primary/50'
                  }`}
                >
                  <span className="font-medium text-sm">{injury.label}</span>
                </button>
              ))}
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold">Jaká je tvoje tréninková úroveň?</h2>
              <p className="text-muted-foreground mt-2 text-sm">Pomůže nám nastavit správný objem tréninku</p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {USER_LEVELS.map((level) => (
                <button
                  key={level.id}
                  onClick={() => setUserLevel(level.id)}
                  className={`p-4 rounded-xl border-2 transition-all text-left flex items-center gap-4 ${
                    userLevel === level.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card hover:border-primary/50'
                  }`}
                >
                  <span className="text-3xl">{level.emoji}</span>
                  <div>
                    <span className="font-medium block">{level.label}</span>
                    <span className="text-sm text-muted-foreground">{level.description}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 7:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold">Jaký typ tréninku preferuješ?</h2>
              <p className="text-muted-foreground mt-2 text-sm">Vyber si JEDEN hlavní split</p>
            </div>
            
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground">Tréninkový split (vyber jeden)</h3>
              {SPLITS.map((split) => (
                <button
                  key={split.id}
                  onClick={() => setTrainingSplit(split.id)}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                    trainingSplit === split.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card hover:border-primary/50'
                  }`}
                >
                  <span className="font-medium block">{split.label}</span>
                  <span className="text-sm text-muted-foreground">{split.description}</span>
                </button>
              ))}
            </div>

            <div className="space-y-3 pt-4">
              <h3 className="font-semibold text-sm text-muted-foreground">Preference vybavení (volitelné)</h3>
              <div className="grid grid-cols-1 gap-2">
                {EQUIPMENT.map((eq) => (
                  <button
                    key={eq.id}
                    onClick={() => setEquipmentPreference(equipmentPreference === eq.id ? null : eq.id)}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      equipmentPreference === eq.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-card hover:border-primary/50'
                    }`}
                  >
                    <span className="font-medium text-sm">{eq.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground text-center">Můžeš to kdykoli změnit v nastavení.</p>
            </div>
          </div>
        );

      case 8:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold">Co tě nejvíc motivuje vydržet?</h2>
              <p className="text-muted-foreground mt-2 text-sm">Můžeš vybrat více možností</p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {MOTIVATIONS.map((mot) => (
                <button
                  key={mot.id}
                  onClick={() => handleMotivationToggle(mot.id)}
                  className={`p-4 rounded-xl border-2 transition-all text-left flex items-center gap-3 ${
                    motivations.includes(mot.id)
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card hover:border-primary/50'
                  }`}
                >
                  <span className="text-2xl">{mot.emoji}</span>
                  <span className="font-medium">{mot.label}</span>
                </button>
              ))}
            </div>
          </div>
        );

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
                disabled={!areAllStepsValid()}
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
