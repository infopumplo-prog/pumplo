import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Target, Dumbbell, MapPin, Calendar, RefreshCw, Settings, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useWorkoutPlan } from '@/hooks/useWorkoutPlan';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useWorkoutGenerator } from '@/hooks/useWorkoutGenerator';
import { supabase } from '@/integrations/supabase/client';
import { PRIMARY_GOAL_TO_TRAINING_GOAL } from '@/lib/trainingGoals';
import PageTransition from '@/components/PageTransition';
import OnboardingDrawer from '@/components/OnboardingDrawer';
import { toast } from 'sonner';

// Split type labels in Czech
const SPLIT_TYPE_LABELS: Record<string, string> = {
  full_body: 'Full Body',
  upper_lower: 'Upper/Lower',
  ppl: 'Push/Pull/Legs'
};

// Goal labels in Czech
const GOAL_LABELS: Record<string, string> = {
  hypertrophy: 'Nabrat svaly',
  strength: 'Získat sílu',
  weight_loss: 'Zhubnout',
  endurance: 'Celková kondice'
};

// Day names short in Czech
const DAY_NAMES_SHORT: Record<string, string> = {
  monday: 'Po',
  tuesday: 'Út',
  wednesday: 'St',
  thursday: 'Čt',
  friday: 'Pá',
  saturday: 'So',
  sunday: 'Ne'
};

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const MyPlan = () => {
  const navigate = useNavigate();
  const { plan, isLoading: planLoading, refetch: refetchPlan } = useWorkoutPlan();
  const { profile, isLoading: profileLoading, refetch: refetchProfile } = useUserProfile();
  const { generateWorkoutPlan, isGenerating } = useWorkoutGenerator();
  
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Calculate weeks and progress
  const totalWeeks = 12; // Fixed 12-week plan
  const currentWeek = useMemo(() => {
    if (!plan) return 1;
    const trainingDays = plan.trainingDays?.length || 3;
    const completedDays = plan.currentDayIndex || 0;
    return Math.min(Math.floor(completedDays / trainingDays) + 1, totalWeeks);
  }, [plan]);

  // Training days sorted
  const trainingDays = useMemo(() => {
    const days = plan?.trainingDays || profile?.training_days || [];
    return [...days].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
  }, [plan, profile]);

  // Gym name
  const [gymName, setGymName] = useState<string | null>(null);
  
  // Fetch gym name
  useMemo(() => {
    const fetchGymName = async () => {
      const gymId = plan?.gymId || profile?.selected_gym_id;
      if (!gymId) {
        setGymName(null);
        return;
      }
      
      const { data } = await supabase
        .from('gyms')
        .select('name')
        .eq('id', gymId)
        .single();
      
      setGymName(data?.name || null);
    };
    
    fetchGymName();
  }, [plan?.gymId, profile?.selected_gym_id]);

  // Handle plan regeneration
  const handleRegeneratePlan = useCallback(async () => {
    if (!profile?.primary_goal) {
      toast.error('Nejprve vyplňte dotazník');
      return;
    }
    
    setIsRegenerating(true);
    
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      
      // Map current profile goal to training goal
      const mappedGoalId = PRIMARY_GOAL_TO_TRAINING_GOAL[profile.primary_goal];
      if (!mappedGoalId) {
        toast.error('Neplatný cíl tréninku');
        return;
      }
      
      // Deactivate old plan
      if (plan?.id) {
        await supabase
          .from('user_workout_plans')
          .update({ is_active: false })
          .eq('id', plan.id);
      }
      
      const selectedGymId = profile.selected_gym_id;
      const durationMinutes = profile.training_duration_minutes || 60;
      
      if (selectedGymId && profile.user_level) {
        // Generate full plan with exercises - IMPORTANT: pass training_days!
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
        // No gym - create skeleton plan
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
      
      // Reset day index but keep streak
      await supabase
        .from('user_profiles')
        .update({ current_day_index: 0 })
        .eq('user_id', userData.user.id);
      
      // Refetch data
      await refetchProfile();
      await refetchPlan();
      
      toast.success('Nový plán byl vytvořen! 🎉');
    } catch (err) {
      console.error('Error regenerating plan:', err);
      toast.error('Nepodařilo se vytvořit nový plán');
    } finally {
      setIsRegenerating(false);
    }
  }, [profile, plan, generateWorkoutPlan, refetchProfile, refetchPlan]);

  // Loading state
  if (planLoading || profileLoading) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background safe-top">
          <div className="gradient-hero px-6 pt-8 pb-6">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-xl" />
              <Skeleton className="h-8 w-32" />
            </div>
          </div>
          <div className="px-6 py-6 space-y-6">
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        </div>
      </PageTransition>
    );
  }

  // No plan state
  if (!plan) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background safe-top">
          <div className="gradient-hero px-6 pt-8 pb-6">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/profile')}
                className="bg-background/50 backdrop-blur-sm rounded-xl"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-2xl font-bold text-foreground">Můj plán</h1>
            </div>
          </div>
          <div className="px-6 py-6">
            <Card className="border-border rounded-2xl">
              <CardContent className="p-6 text-center">
                <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Žádný aktivní plán</h3>
                <p className="text-muted-foreground mb-4">
                  Vyplňte dotazník pro vytvoření tréninkového plánu.
                </p>
                <Button onClick={() => setOnboardingOpen(true)}>
                  Vyplnit dotazník
                </Button>
              </CardContent>
            </Card>
          </div>
          <OnboardingDrawer open={onboardingOpen} onOpenChange={setOnboardingOpen} />
        </div>
      </PageTransition>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background safe-top pb-24">
        {/* Header */}
        <div className="gradient-hero px-6 pt-8 pb-6">
          <motion.div
            className="flex items-center gap-3"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/profile')}
              className="bg-background/50 backdrop-blur-sm rounded-xl"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold text-foreground">Můj plán</h1>
          </motion.div>
        </div>

        <motion.div
          className="px-6 py-6 space-y-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Plan Overview Card */}
          <motion.div variants={itemVariants}>
            <Card className="border-border rounded-2xl shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold">Přehled plánu</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Goal */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Target className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Cíl</p>
                    <p className="font-medium">{GOAL_LABELS[plan.goalId] || plan.goalName}</p>
                  </div>
                </div>

                {/* Split Type */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-chart-2/10 rounded-xl flex items-center justify-center">
                    <Dumbbell className="w-5 h-5 text-chart-2" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Typ splitu</p>
                    <p className="font-medium">{SPLIT_TYPE_LABELS[plan.splitType] || plan.splitType}</p>
                  </div>
                </div>

                {/* Gym */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-chart-3/10 rounded-xl flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-chart-3" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Posilovna</p>
                    <p className="font-medium">{gymName || 'Nevybráno'}</p>
                  </div>
                </div>

                {/* Current Week */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-chart-4/10 rounded-xl flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-chart-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Průběh</p>
                    <p className="font-medium">Týden {currentWeek}/{totalWeeks}</p>
                  </div>
                </div>

                {/* Training Days */}
                <div className="pt-2">
                  <p className="text-sm text-muted-foreground mb-2">Tréninkové dny</p>
                  <div className="flex flex-wrap gap-2">
                    {trainingDays.map((day) => (
                      <Badge key={day} variant="secondary" className="text-sm">
                        {DAY_NAMES_SHORT[day]}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Week Calendar */}
          <motion.div variants={itemVariants}>
            <Card className="border-border rounded-2xl shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold">Kalendář týdnů</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: totalWeeks }, (_, i) => {
                    const weekNumber = i + 1;
                    const isCompleted = weekNumber < currentWeek;
                    const isCurrent = weekNumber === currentWeek;
                    
                    return (
                      <div
                        key={weekNumber}
                        className={`
                          relative aspect-square rounded-xl flex flex-col items-center justify-center transition-all
                          ${isCompleted 
                            ? 'bg-chart-2/20 text-chart-2 border-2 border-chart-2/30' 
                            : isCurrent 
                              ? 'bg-primary/20 text-primary border-2 border-primary' 
                              : 'bg-muted/50 text-muted-foreground border border-border'
                          }
                        `}
                      >
                        {isCompleted && (
                          <Check className="w-4 h-4 absolute top-1 right-1" />
                        )}
                        <span className="text-xs text-muted-foreground">Týden</span>
                        <span className="text-lg font-bold">{weekNumber}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Action Buttons */}
          <motion.div variants={itemVariants} className="space-y-3">
            <Button
              className="w-full"
              size="lg"
              onClick={handleRegeneratePlan}
              disabled={isRegenerating || isGenerating}
            >
              {(isRegenerating || isGenerating) ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Generuji...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  <span>Regenerovat plán</span>
                </>
              )}
            </Button>
            
            <Button
              variant="outline"
              className="w-full"
              size="lg"
              onClick={() => setOnboardingOpen(true)}
            >
              <Settings className="w-5 h-5" />
              <span>Změnit plán</span>
            </Button>
          </motion.div>
        </motion.div>

        {/* Onboarding Drawer */}
        <OnboardingDrawer open={onboardingOpen} onOpenChange={setOnboardingOpen} />
      </div>
    </PageTransition>
  );
};

export default MyPlan;
