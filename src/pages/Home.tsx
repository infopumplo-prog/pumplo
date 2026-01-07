import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useUserRole } from '@/hooks/useUserRole';
import { Dumbbell, Flame, Clock, Trophy, Lock, Shield } from 'lucide-react';
import pumploLogo from '@/assets/pumplo-logo.png';
import OnboardingWarning from '@/components/OnboardingWarning';
import OnboardingDrawer from '@/components/OnboardingDrawer';
import PageTransition from '@/components/PageTransition';

const statCards = [
  { icon: Flame, label: 'Spálené kalorie', value: '0', color: 'text-warning' },
  { icon: Clock, label: 'Čas cvičení', value: '0 min', color: 'text-primary' },
  { icon: Trophy, label: 'Tréninky', value: '0', color: 'text-success' },
];

const Home = () => {
  const { profile } = useUserProfile();
  const { isAdmin } = useUserRole();
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  const isOnboardingComplete = profile?.onboarding_completed ?? false;

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

  const handleStartTraining = () => {
    if (!isOnboardingComplete) {
      setOnboardingOpen(true);
    } else {
      // TODO: Start training logic
    }
  };

  return (
    <PageTransition>
    <div className="min-h-screen bg-background safe-top">
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
        {/* Quick Action Card */}
        <motion.div
          variants={itemVariants}
          onClick={handleStartTraining}
          className={`rounded-2xl p-6 shadow-primary cursor-pointer transition-all ${
            isOnboardingComplete 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted text-muted-foreground'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold mb-1">Začít trénink</h2>
              <p className={`text-sm ${isOnboardingComplete ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                {isOnboardingComplete 
                  ? 'Vyber si cvičení a pusť se do toho!' 
                  : 'Nejdříve vyplň dotazník'}
              </p>
            </div>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
              isOnboardingComplete ? 'bg-primary-foreground/20' : 'bg-muted-foreground/20'
            }`}>
              {isOnboardingComplete ? (
                <Dumbbell className="w-7 h-7" />
              ) : (
                <Lock className="w-7 h-7" />
              )}
            </div>
          </div>
        </motion.div>

        {/* Stats */}
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
                  <Icon className={`w-6 h-6 mx-auto mb-2 ${stat.color}`} />
                  <p className="text-xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div variants={itemVariants}>
          <h3 className="text-lg font-semibold text-foreground mb-4">Poslední aktivita</h3>
          <div className="bg-muted/50 rounded-2xl p-8 text-center">
            <Dumbbell className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">Zatím žádná aktivita</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Začni svůj první trénink!</p>
          </div>
        </motion.div>
      </motion.div>

      {/* Onboarding Drawer */}
      <OnboardingDrawer open={onboardingOpen} onOpenChange={setOnboardingOpen} />
    </div>
    </PageTransition>
  );
};

export default Home;
