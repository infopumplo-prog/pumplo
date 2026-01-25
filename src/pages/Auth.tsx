import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, Mail, Lock, User, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import pumploLogo from '@/assets/pumplo-logo.png';
import { TrainingGoalId, UserLevel, GOAL_TO_SPLIT } from '@/lib/trainingGoals';
import { ONBOARDING_TOTAL_STEPS } from '@/lib/onboardingTypes';
import {
  OnboardingGoalStep,
  OnboardingLevelStep,
  OnboardingDaysStep,
  OnboardingTimeStep,
  OnboardingDemographicsStep,
  OnboardingInjuriesStep,
  OnboardingEquipmentStep,
} from '@/components/onboarding';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type AuthMode = 'login' | 'register';

const Auth = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>('login');
  const { toast } = useToast();
  
  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // Registration form state (step 7)
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  
  // Onboarding state (steps 0-6)
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [primaryGoal, setPrimaryGoal] = useState<TrainingGoalId | null>(null);
  const [userLevel, setUserLevel] = useState<UserLevel | null>(null);
  const [trainingDays, setTrainingDays] = useState<string[]>([]);
  const [preferredTime, setPreferredTime] = useState<string | null>(null);
  const [trainingDuration, setTrainingDuration] = useState(45);
  const [gender, setGender] = useState<string | null>(null);
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [injuries, setInjuries] = useState<string[]>([]);
  const [equipmentPreference, setEquipmentPreference] = useState<string | null>(null);
  
  const { login, register } = useAuth();

  // Check if current onboarding step is valid
  const isStepValid = (): boolean => {
    switch (onboardingStep) {
      case 0: return primaryGoal !== null;
      case 1: return userLevel !== null;
      case 2: return trainingDays.length > 0;
      case 3: return preferredTime !== null;
      case 4: return gender !== null && age !== '' && height !== '' && weight !== '';
      case 5: return injuries.length > 0;
      case 6: return equipmentPreference !== null;
      case 7: return firstName.trim() !== '' && lastName.trim() !== '' && regEmail.trim() !== '' && regPassword.length >= 6;
      default: return false;
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const result = await login(email, password);
      if (!result.success) {
        setError(result.error || 'Přihlášení se nezdařilo');
      }
    } catch {
      setError('Něco se pokazilo. Zkuste to prosím znovu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      // 1. Register user - returns userId directly
      const result = await register(regEmail, regPassword, firstName, lastName);
      if (!result.success || !result.userId) {
        if (result.error?.includes('rate limit') || result.error?.includes('429')) {
          setError('Příliš mnoho registrací. Zkuste to prosím za pár minut.');
        } else {
          setError(result.error || 'Registrace se nezdařila');
        }
        setIsSubmitting(false);
        return;
      }

      const userId = result.userId;

      // 2. Wait a moment for trigger to create profile
      await new Promise(resolve => setTimeout(resolve, 300));

      // 3. Save onboarding data to profile (retry logic for race condition)
      const trainingSplit = primaryGoal ? GOAL_TO_SPLIT[primaryGoal] : null;
      
      let profileUpdateSuccess = false;
      let retries = 3;
      
      while (!profileUpdateSuccess && retries > 0) {
        const { error: profileError } = await supabase
          .from('user_profiles')
          .update({
            primary_goal: primaryGoal,
            user_level: userLevel,
            training_days: trainingDays,
            preferred_time: preferredTime,
            training_duration_minutes: trainingDuration,
            gender,
            age: age ? parseInt(age) : null,
            height_cm: height ? parseInt(height) : null,
            weight_kg: weight ? parseFloat(weight) : null,
            injuries,
            equipment_preference: equipmentPreference,
            training_split: trainingSplit,
            onboarding_completed: true,
            current_step: ONBOARDING_TOTAL_STEPS,
            first_name: firstName,
            last_name: lastName,
          })
          .eq('user_id', userId);

        if (profileError) {
          console.error('Profile update error (retry ' + (4 - retries) + '):', profileError);
          retries--;
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } else {
          profileUpdateSuccess = true;
        }
      }

      if (!profileUpdateSuccess) {
        console.error('Failed to update profile after retries');
      }

      // 4. Create workout plan
      if (primaryGoal) {
        // Deactivate any existing plans
        await supabase
          .from('user_workout_plans')
          .update({ is_active: false })
          .eq('user_id', userId);

        // Create new plan with training_days snapshot
        await supabase
          .from('user_workout_plans')
          .insert({
            user_id: userId,
            goal_id: primaryGoal,
            is_active: true,
            started_at: new Date().toISOString(),
            current_week: 1,
            gym_id: null, // Will be set when user selects gym
            training_days: trainingDays
          });
      }

      toast({ 
        title: 'Vítej v Pumplo!', 
        description: 'Tvůj účet byl vytvořen. Nyní si vyber posilovnu.'
      });

      // Force navigation to home page after all data is saved
      navigate('/');
    } catch (err) {
      console.error('Registration error:', err);
      setError('Něco se pokazilo. Zkuste to prosím znovu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextStep = () => {
    if (isStepValid() && onboardingStep < ONBOARDING_TOTAL_STEPS) {
      setOnboardingStep(onboardingStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (onboardingStep > 0) {
      setOnboardingStep(onboardingStep - 1);
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
    setOnboardingStep(0);
  };

  const progress = ((onboardingStep + 1) / (ONBOARDING_TOTAL_STEPS + 1)) * 100;

  const renderOnboardingStep = () => {
    switch (onboardingStep) {
      case 0:
        return <OnboardingGoalStep value={primaryGoal} onChange={setPrimaryGoal} />;
      case 1:
        return <OnboardingLevelStep value={userLevel} onChange={setUserLevel} />;
      case 2:
        return <OnboardingDaysStep value={trainingDays} onChange={setTrainingDays} />;
      case 3:
        return (
          <OnboardingTimeStep
            preferredTime={preferredTime}
            duration={trainingDuration}
            onTimeChange={setPreferredTime}
            onDurationChange={setTrainingDuration}
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
      case 7:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold">Vytvoř si účet</h2>
              <p className="text-muted-foreground mt-2 text-sm">
                Poslední krok k tvému tréninkovému plánu
              </p>
            </div>
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Jméno"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="pl-12"
                  required
                />
              </div>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Příjmení"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="pl-12"
                  required
                />
              </div>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="pl-12"
                  required
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type={showRegPassword ? 'text' : 'password'}
                  placeholder="Heslo (min. 6 znaků)"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="pl-12 pr-12"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showRegPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-destructive text-sm text-center py-2"
                >
                  {error}
                </motion.p>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full mt-4 bg-green-500 hover:bg-green-600"
                disabled={isSubmitting || !isStepValid()}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Vytváření účtu...</span>
                  </>
                ) : (
                  <span>Dokončit registraci</span>
                )}
              </Button>
            </form>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col safe-top safe-bottom">
      {/* Header with gradient */}
      <div className="flex-shrink-0 gradient-hero pt-12 pb-8 px-6">
        <motion.div 
          className="flex flex-col items-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.img
            src={pumploLogo}
            alt="Pumplo"
            className="w-24 h-24 mb-4 object-contain"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          />
          <h1 className="text-2xl font-bold text-foreground">Pumplo</h1>
          <p className="text-muted-foreground mt-1 text-sm">Tvůj fitness partner</p>
        </motion.div>
      </div>

      {/* Content */}
      <motion.div 
        className="flex-1 px-6 pt-6 overflow-y-auto"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="max-w-md mx-auto w-full">
          {mode === 'login' ? (
            <>
              {/* Tab Switcher */}
              <div className="flex bg-muted rounded-xl p-1 mb-6">
                <button
                  onClick={() => setMode('login')}
                  className="flex-1 py-3 rounded-lg text-sm font-semibold transition-all duration-200 bg-background text-foreground shadow-card"
                >
                  Přihlášení
                </button>
                <button
                  onClick={() => setMode('register')}
                  className="flex-1 py-3 rounded-lg text-sm font-semibold transition-all duration-200 text-muted-foreground"
                >
                  Registrace
                </button>
              </div>

              {/* Login Form */}
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-12"
                    required
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Heslo"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-12 pr-12"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>

                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-destructive text-sm text-center py-2"
                  >
                    {error}
                  </motion.p>
                )}

                <Button
                  type="submit"
                  size="lg"
                  className="w-full mt-6"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Přihlašování...</span>
                    </>
                  ) : (
                    <span>Přihlásit se</span>
                  )}
                </Button>

                <button
                  type="button"
                  className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors pt-2"
                >
                  Zapomněli jste heslo?
                </button>
              </form>

              <p className="text-center text-muted-foreground text-sm mt-8 pb-8">
                Ještě nemáte účet?{' '}
                <button
                  onClick={toggleMode}
                  className="text-primary font-semibold hover:underline"
                >
                  Zaregistrujte se
                </button>
              </p>
            </>
          ) : (
            <>
              {/* Progress bar for onboarding */}
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Krok {onboardingStep + 1} z {ONBOARDING_TOTAL_STEPS + 1}</span>
                  <span className="font-medium text-primary">{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              {/* Onboarding Steps */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={onboardingStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  {renderOnboardingStep()}
                </motion.div>
              </AnimatePresence>

              {/* Navigation buttons (not for registration step) */}
              {onboardingStep < 7 && (
                <div className="flex gap-3 mt-8 pb-8">
                  <Button
                    variant="outline"
                    onClick={handlePrevStep}
                    disabled={onboardingStep === 0}
                    className="flex-1"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Zpět
                  </Button>
                  <Button 
                    onClick={handleNextStep} 
                    className="flex-1"
                    disabled={!isStepValid()}
                  >
                    Další
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              )}

              {/* Back to step navigation for registration step */}
              {onboardingStep === 7 && (
                <div className="mt-4 pb-8">
                  <Button
                    variant="ghost"
                    onClick={handlePrevStep}
                    className="w-full"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Zpět k dotazníku
                  </Button>
                </div>
              )}

              <p className="text-center text-muted-foreground text-sm pb-8">
                Už máte účet?{' '}
                <button
                  onClick={toggleMode}
                  className="text-primary font-semibold hover:underline"
                >
                  Přihlaste se
                </button>
              </p>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
