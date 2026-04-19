import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, Mail, Lock, User, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import pumploWordmark from '@/assets/pumplo-wordmark.png';
import { TrainingGoalId, UserLevel, getSplitFromFrequency } from '@/lib/trainingGoals';
import { ONBOARDING_TOTAL_STEPS, getBeginnerDefaultDuration } from '@/lib/onboardingTypes';
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
  const [showTrainerTip, setShowTrainerTip] = useState(false);
  const [equipmentPreference, setEquipmentPreference] = useState<string | null>(null);
  
  const { login, register, loginWithProvider, resetPassword } = useAuth();

  const handleOAuthLogin = async (provider: 'google' | 'apple') => {
    setError('');
    setIsSubmitting(true);
    try {
      const result = await loginWithProvider(provider);
      if (!result.success) {
        setError(result.error || 'Přihlášení se nezdařilo');
      }
    } catch {
      setError('Něco se pokazilo. Zkuste to prosím znovu.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
      const trainingSplit = trainingDays.length > 0 && userLevel
        ? getSplitFromFrequency(trainingDays.length, userLevel)
        : null;
      
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

      // 5. Verify profile was updated before navigating
      let verified = false;
      let verifyAttempts = 5;

      while (!verified && verifyAttempts > 0) {
        const { data: verifyProfile } = await supabase
          .from('user_profiles')
          .select('onboarding_completed')
          .eq('user_id', userId)
          .single();
        
        if (verifyProfile?.onboarding_completed === true) {
          verified = true;
        } else {
          verifyAttempts--;
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      // 6. Force a small delay for React Query cache invalidation
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (err) {
      console.error('Registration error:', err);
      setError('Něco se pokazilo. Zkuste to prosím znovu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasRealInjuries = injuries.length > 0 && !injuries.includes('none');

  const handleNextStep = () => {
    if (isStepValid() && onboardingStep < ONBOARDING_TOTAL_STEPS) {
      // After injuries step, show trainer tip if user has injuries
      if (onboardingStep === 5 && hasRealInjuries && !showTrainerTip) {
        setShowTrainerTip(true);
        return;
      }
      setShowTrainerTip(false);
      setOnboardingStep(onboardingStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (showTrainerTip) {
      setShowTrainerTip(false);
      return;
    }
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
    if (showTrainerTip) {
      return <OnboardingTrainerTip onContinue={() => {
        setShowTrainerTip(false);
        setOnboardingStep(prev => prev + 1);
      }} />;
    }

    switch (onboardingStep) {
      case 0:
        return <OnboardingGoalStep value={primaryGoal} onChange={(goal) => {
          setPrimaryGoal(goal);
          if (userLevel === 'beginner') setTrainingDuration(getBeginnerDefaultDuration(goal));
        }} onNext={() => setOnboardingStep(prev => prev + 1)} />;
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
              <div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type={showRegPassword ? 'text' : 'password'}
                    placeholder="Heslo"
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
                <p className="text-xs text-muted-foreground mt-1 pl-1">Minimálně 6 znaků</p>
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

            {/* OAuth divider */}
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">nebo</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* OAuth buttons */}
            <div className="space-y-3">
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                onClick={() => handleOAuthLogin('google')}
                disabled={isSubmitting}
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Registrovat přes Google
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                onClick={() => handleOAuthLogin('apple')}
                disabled={isSubmitting}
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
                Registrovat přes Apple
              </Button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-full bg-background flex flex-col safe-top safe-bottom">
      {/* Header with gradient */}
      <div className="flex-shrink-0 gradient-hero pt-12 pb-8 px-6">
        <motion.div 
          className="flex flex-col items-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            className="flex items-center gap-3"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <img src={pumploWordmark} alt="Pumplo" className="h-10 object-contain" />
          </motion.div>
          <p className="text-muted-foreground mt-2 text-sm">Tvůj fitness parťák</p>
        </motion.div>
      </div>

      {/* Content */}
      <motion.div 
        className="flex-1 min-h-0 px-6 pt-6 overflow-y-auto"
        style={{ WebkitOverflowScrolling: 'touch' }}
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
                  onClick={async () => {
                    if (!email.trim()) {
                      setError('Zadejte email pro reset hesla');
                      return;
                    }
                    setIsSubmitting(true);
                    setError('');
                    const result = await resetPassword(email);
                    setIsSubmitting(false);
                    if (result.success) {
                      toast({ title: 'Email odeslán', description: 'Zkontrolujte svou emailovou schránku pro odkaz na reset hesla.' });
                    } else {
                      setError(result.error || 'Nepodařilo se odeslat reset hesla');
                    }
                  }}
                  className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors pt-2"
                >
                  Zapomněli jste heslo?
                </button>
              </form>

              {/* OAuth divider */}
              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">nebo</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* OAuth buttons */}
              <div className="space-y-3">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full"
                  onClick={() => handleOAuthLogin('google')}
                  disabled={isSubmitting}
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Pokračovat přes Google
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full"
                  onClick={() => handleOAuthLogin('apple')}
                  disabled={isSubmitting}
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                  Pokračovat přes Apple
                </Button>
              </div>

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
