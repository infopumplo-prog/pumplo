import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Settings, MessageSquare, LogOut, ChevronRight, ClipboardList, BarChart3, Calendar, Camera, Mail, GraduationCap } from 'lucide-react';
import { useUnreadMessageCount } from '@/hooks/useUnreadMessageCount';
import OnboardingWarning from '@/components/OnboardingWarning';
import OnboardingDrawer from '@/components/OnboardingDrawer';
import PageTransition from '@/components/PageTransition';
import ProfilePageSkeleton from '@/components/skeletons/ProfilePageSkeleton';
import { AppFeedbackDialog } from '@/components/feedback/AppFeedbackDialog';

const getRoleLabel = (role: string | null): string => {
  switch (role) {
    case 'admin': return 'Administrátor';
    case 'business': return 'Business';
    case 'trainer': return 'Trenér';
    case 'user': return 'Uživatel';
    default: return 'Uživatel';
  }
};

const Profile = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { profile, isLoading, updateProfile, refetch } = useUserProfile();
  const { role, isLoading: roleLoading } = useUserRole();
  const { unreadCount } = useUnreadMessageCount();
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    e.target.value = '';

    setAvatarUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(path);

      const avatarUrl = `${publicUrl}?t=${Date.now()}`;

      await updateProfile({ avatar_url: avatarUrl } as any);
    } catch (err) {
      console.error('Avatar upload error:', err);
    } finally {
      setAvatarUploading(false);
    }
  };

  if (isLoading || roleLoading) {
    return <ProfilePageSkeleton />;
  }

  const trainerMenuItem = role === 'trainer'
    ? { icon: GraduationCap, label: 'Můj trenérský profil', onClick: () => navigate('/trainer-profile') }
    : { icon: GraduationCap, label: 'Stát se trenérem', onClick: () => navigate('/become-trainer') };

  const menuItems = [
    { icon: Mail, label: 'Zprávy', onClick: () => navigate('/messages'), badge: unreadCount },
    { icon: Calendar, label: 'Můj plán', onClick: () => navigate('/profile/plan') },
    { icon: BarChart3, label: 'Historie tréninků', onClick: () => navigate('/profile/history') },
    trainerMenuItem,
    { icon: ClipboardList, label: 'Upravit dotazník', onClick: () => setOnboardingOpen(true) },
    { icon: Settings, label: 'Nastavení', onClick: () => navigate('/settings') },
    { icon: MessageSquare, label: 'Zpětná vazba', onClick: () => setFeedbackOpen(true) },
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
            <button
              onClick={() => fileInputRef.current?.click()}
              className="relative shrink-0"
              disabled={avatarUploading}
            >
              <div className="w-16 h-16 rounded-full overflow-hidden">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                    <User className="w-8 h-8 text-primary" />
                  </div>
                )}
              </div>
              {(!profile?.avatar_url || avatarUploading) && (
                <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary rounded-full flex items-center justify-center border-2 border-card shadow-sm">
                  {avatarUploading ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Camera className="w-3.5 h-3.5 text-white" />
                  )}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </button>
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
                  {'badge' in item && (item as any).badge > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-primary text-primary-foreground">
                      {(item as any).badge}
                    </span>
                  )}
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Logout */}
        <motion.div variants={itemVariants} className="pb-24">
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
      
      {/* Feedback Dialog */}
      <AppFeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </div>
    </PageTransition>
  );
};

export default Profile;
