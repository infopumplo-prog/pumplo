import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useUserRole } from '@/hooks/useUserRole';
import { useWorkoutStats } from '@/hooks/useWorkoutStats';
import { Dumbbell, Flame, Clock, Trophy, Shield, Calendar, Weight, ChevronRight } from 'lucide-react';
import pumploLogo from '@/assets/pumplo-logo.png';
import OnboardingWarning from '@/components/OnboardingWarning';
import OnboardingDrawer from '@/components/OnboardingDrawer';
import PageTransition from '@/components/PageTransition';
import HomePageSkeleton from '@/components/skeletons/HomePageSkeleton';
import MyPlanSection from '@/components/home/MyPlanSection';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const Home = () => {
  const { profile, isLoading } = useUserProfile();
  const { isAdmin } = useUserRole();
  const { stats, isLoading: statsLoading } = useWorkoutStats();
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  const isOnboardingComplete = profile?.onboarding_completed ?? false;

  if (isLoading) {
    return <HomePageSkeleton />;
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  // Format duration for display
  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Format weight for display
  const formatWeight = (kg: number) => {
    if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
    return `${Math.round(kg)} kg`;
  };

  // Estimate calories (rough: ~5 cal per minute of strength training)
  const estimateCalories = (minutes: number) => Math.round(minutes * 5);

  const statCards = [
    { 
      icon: Flame, 
      label: 'Spálené kalorie', 
      value: estimateCalories(stats.today.totalDuration).toString(), 
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10'
    },
    { 
      icon: Clock, 
      label: 'Čas cvičení', 
      value: formatDuration(stats.today.totalDuration), 
      color: 'text-primary',
      bgColor: 'bg-primary/10'
    },
    { 
      icon: Trophy, 
      label: 'Tréninky', 
      value: stats.today.totalWorkouts.toString(), 
      color: 'text-green-500',
      bgColor: 'bg-green-500/10'
    },
  ];

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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const days = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
    return days[date.getDay()];
  };

  const formatFullDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getDate()}.${date.getMonth() + 1}.`;
  };

  return (
    <PageTransition>
    <div className="min-h-screen bg-background safe-top pb-24">
      {/* Header */}
      <div className="gradient-hero px-6 pt-8 pb-6">
        <motion.div
          className="flex flex-col"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex justify-center mb-4">
            <img 
              src={pumploLogo} 
              alt="Pumplo" 
              className="w-20 h-20 object-contain"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Ahoj,</p>
              <h1 className="text-2xl font-bold text-foreground">
                {profile?.first_name || 'Športovec'} 💪
              </h1>
            </div>
            {isAdmin && (
              <Link
                to="/admin"
                className="flex items-center gap-2 px-3 py-2 bg-primary/10 text-primary rounded-lg text-sm font-medium"
              >
                <Shield className="w-4 h-4" />
                Admin
              </Link>
            )}
          </div>
        </motion.div>
      </div>

      {/* Onboarding Warning */}
      {profile && !profile.onboarding_completed && (
        <OnboardingWarning onClick={() => setOnboardingOpen(true)} />
      )}

      {/* Content */}
      <motion.div
        className="px-6 py-6 space-y-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* My Plan Section - only show if onboarding complete */}
        {isOnboardingComplete && (
          <motion.div variants={itemVariants}>
            <h3 className="text-lg font-semibold text-foreground mb-4">Můj plán</h3>
            <MyPlanSection />
          </motion.div>
        )}

        {/* Today's Stats */}
        <motion.div variants={itemVariants}>
          <h3 className="text-lg font-semibold text-foreground mb-4">Dnešní statistiky</h3>
          <div className="grid grid-cols-3 gap-3">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="bg-card border border-border rounded-xl p-4 text-center shadow-card"
                >
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2", stat.bgColor)}>
                    <Icon className={cn("w-5 h-5", stat.color)} />
                  </div>
                  <p className="text-xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Weekly Stats Summary */}
        <motion.div variants={itemVariants}>
          <h3 className="text-lg font-semibold text-foreground mb-4">Tento týden</h3>
          <Card className="p-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Dumbbell className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-bold">{stats.thisWeek.totalWorkouts}</p>
                  <p className="text-xs text-muted-foreground">tréninků</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-bold">{formatDuration(stats.thisWeek.totalDuration)}</p>
                  <p className="text-xs text-muted-foreground">čas</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Weight className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-bold">{formatWeight(stats.thisWeek.totalWeight)}</p>
                  <p className="text-xs text-muted-foreground">zdvihnuté</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-lg font-bold">{stats.thisWeek.totalSets}</p>
                  <p className="text-xs text-muted-foreground">sérií</p>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Recent Activity / History */}
        <motion.div variants={itemVariants}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Poslední tréninky</h3>
            {stats.recentSessions.length > 0 && (
              <Link 
                to="/training" 
                className="text-sm text-primary flex items-center gap-1"
              >
                Vše
                <ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>
          
          {stats.recentSessions.length === 0 ? (
            <div className="bg-muted/50 rounded-2xl p-8 text-center">
              <Dumbbell className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">Zatím žádná aktivita</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Začni svůj první trénink!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {stats.recentSessions.slice(0, 5).map((session, index) => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-card border border-border rounded-xl p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <span className="text-lg font-bold text-primary">{session.day_letter}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">
                          Den {session.day_letter}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatFullDate(session.started_at)} • {formatDate(session.started_at)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-foreground">
                        {formatDuration(Math.floor((session.duration_seconds || 0) / 60))}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {session.total_sets} sérií
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* All Time Stats */}
        {stats.allTime.totalWorkouts > 0 && (
          <motion.div variants={itemVariants}>
            <h3 className="text-lg font-semibold text-foreground mb-4">Celkově</h3>
            <Card className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-primary">{stats.allTime.totalWorkouts}</p>
                  <p className="text-xs text-muted-foreground">tréninků</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">{formatDuration(stats.allTime.totalDuration)}</p>
                  <p className="text-xs text-muted-foreground">čas</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">{formatWeight(stats.allTime.totalWeight)}</p>
                  <p className="text-xs text-muted-foreground">zdvihnuté</p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </motion.div>

      {/* Onboarding Drawer */}
      <OnboardingDrawer open={onboardingOpen} onOpenChange={setOnboardingOpen} />
    </div>
    </PageTransition>
  );
};

export default Home;
