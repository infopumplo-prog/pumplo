import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useUserRole } from '@/hooks/useUserRole';
import { useWorkoutStats } from '@/hooks/useWorkoutStats';
import { useIsPWA } from '@/hooks/useIsPWA';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Settings, HelpCircle, LogOut, ChevronRight, ClipboardList, BarChart3, Smartphone } from 'lucide-react';
import OnboardingWarning from '@/components/OnboardingWarning';
import OnboardingDrawer from '@/components/OnboardingDrawer';
import PageTransition from '@/components/PageTransition';
import ProfilePageSkeleton from '@/components/skeletons/ProfilePageSkeleton';

const getRoleLabel = (role: string | null): string => {
  switch (role) {
    case 'admin': return 'Administrátor';
    case 'business': return 'Business';
    case 'user': return 'Uživatel';
    default: return 'Uživatel';
  }
};

const Profile = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { profile, isLoading } = useUserProfile();
  const { role, isLoading: roleLoading } = useUserRole();
  const { stats, isLoading: statsLoading } = useWorkoutStats();
  const isPWA = useIsPWA();
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  if (isLoading || roleLoading || statsLoading) {
    return <ProfilePageSkeleton />;
  }

  const menuItems = [
    { icon: BarChart3, label: 'Historie tréninků', onClick: () => navigate('/profile/history') },
    { icon: ClipboardList, label: 'Upravit dotazník', onClick: () => setOnboardingOpen(true) },
    // Only show install option if not already running as PWA
    ...(!isPWA ? [{ icon: Smartphone, label: 'Nainštalovať aplikáciu', onClick: () => navigate('/install') }] : []),
    { icon: Settings, label: 'Nastavení', onClick: () => navigate('/settings') },
    { icon: HelpCircle, label: 'Nápověda', onClick: () => {} },
  ];

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

  return (
    <PageTransition>
    <div className="min-h-screen bg-background safe-top">
      {/* Onboarding Warning */}
      {profile && !profile.onboarding_completed && (
        <div className="pt-4">
          <OnboardingWarning onClick={() => setOnboardingOpen(true)} />
        </div>
      )}

      {/* Header */}
      <div className="gradient-hero px-6 pt-8 pb-6">
        <motion.h1
          className="text-2xl font-bold text-foreground"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          Můj profil
        </motion.h1>
      </div>

      <motion.div
        className="px-6 py-6 space-y-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Profile Card */}
        <motion.div
          variants={itemVariants}
          className="bg-card border border-border rounded-2xl p-6 shadow-card"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-foreground truncate">
                {profile?.first_name && profile?.last_name 
                  ? `${profile.first_name} ${profile.last_name}` 
                  : user?.user_metadata?.name || 'Uživatel'}
              </h2>
              <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
              <Badge variant="secondary" className="mt-2 text-xs">
                {getRoleLabel(role)}
              </Badge>
            </div>
          </div>
        </motion.div>

        {/* Stats Summary */}
        <motion.div variants={itemVariants}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Statistiky</h3>
            <button 
              onClick={() => navigate('/profile/history')}
              className="text-sm text-primary font-medium"
            >
              Zobrazit vše
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{stats.allTime.totalWorkouts}</p>
              <p className="text-sm text-muted-foreground">Tréninků</p>
            </div>
            <div className="bg-gradient-to-br from-chart-2/10 to-chart-2/5 border border-chart-2/20 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{Math.round(stats.allTime.totalDuration / 60)}</p>
              <p className="text-sm text-muted-foreground">Hodin cvičení</p>
            </div>
          </div>
        </motion.div>

        {/* Menu */}
        <motion.div variants={itemVariants}>
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-card">
            {menuItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className={`w-full flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors ${
                    index !== menuItems.length - 1 ? 'border-b border-border' : ''
                  }`}
                >
                  <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center">
                    <Icon className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <span className="flex-1 text-left font-medium text-foreground">{item.label}</span>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Logout */}
        <motion.div variants={itemVariants}>
          <Button
            variant="outline"
            size="lg"
            className="w-full border-destructive text-destructive hover:bg-destructive/10"
            onClick={logout}
          >
            <LogOut className="w-5 h-5" />
            <span>Odhlásit se</span>
          </Button>
        </motion.div>
      </motion.div>

      {/* Onboarding Drawer */}
      <OnboardingDrawer open={onboardingOpen} onOpenChange={setOnboardingOpen} />
    </div>
    </PageTransition>
  );
};

export default Profile;
