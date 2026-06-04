import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Bell, Shield, Trash2, Save, AlertTriangle, Lock, Mail, Clock, Flame, MapPin, Download, ExternalLink, Globe, Heart } from 'lucide-react';
import { changeLanguage } from '@/i18n';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import PageTransition from '@/components/PageTransition';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const Settings = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { profile, updateProfile, isLoading } = useUserProfile();
  const { 
    isSupported, 
    isSubscribed, 
    subscribeToPush, 
    unsubscribeFromPush,
    notificationPreferences,
    updateNotificationPreference 
  } = usePushNotifications();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language as 'cs' | 'en';

  // Profile state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Email change state
  const [newEmail, setNewEmail] = useState('');
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  // Other state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Local state for notification toggles
  const [morningReminder, setMorningReminder] = useState(true);
  const [missedWorkout, setMissedWorkout] = useState(true);
  const [closingSoon, setClosingSoon] = useState(true);
  const [comeback, setComeback] = useState(true);
  const [isTogglingNotifications, setIsTogglingNotifications] = useState(false);

  // Sync profile data when loaded
  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
    }
  }, [profile]);

  // Sync notification preferences
  useEffect(() => {
    setMorningReminder(notificationPreferences.morningReminder);
    setMissedWorkout(notificationPreferences.missedWorkout);
    setClosingSoon(notificationPreferences.closingSoon);
    setComeback(notificationPreferences.comeback);
  }, [notificationPreferences]);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const result = await updateProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      });
      
      if (result.success) {
        toast({ title: t('toast.saved'), description: t('toast.profile_updated') });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({ title: t('toast.error'), description: t('toast.save_failed'), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!newEmail.trim()) {
      toast({ title: t('toast.error'), description: t('toast.enter_email'), variant: 'destructive' });
      return;
    }

    if (newEmail === user?.email) {
      toast({ title: t('toast.error'), description: t('toast.same_email'), variant: 'destructive' });
      return;
    }

    setIsChangingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail.trim(),
      });

      if (error) throw error;

      toast({ title: t('toast.email_verify_sent'), description: t('toast.check_new_email') });
      setNewEmail('');
    } catch (error: unknown) {
      toast({ title: t('toast.error'), description: (error as Error).message || t('toast.email_change_failed'), variant: 'destructive' });
    } finally {
      setIsChangingEmail(false);
    }
  };

  const handleChangePassword = async () => {
    // Validation
    if (!currentPassword) {
      toast({ title: t('toast.error'), description: t('toast.enter_current_password'), variant: 'destructive' });
      return;
    }

    if (newPassword.length < 6) {
      toast({ title: t('toast.error'), description: t('toast.min_password'), variant: 'destructive' });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({ title: t('toast.error'), description: t('toast.passwords_mismatch'), variant: 'destructive' });
      return;
    }

    setIsChangingPassword(true);
    try {
      // Verify current password by signing in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: currentPassword,
      });

      if (signInError) {
        toast({ title: t('toast.error'), description: t('toast.wrong_password'), variant: 'destructive' });
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast({ title: t('toast.password_changed'), description: t('toast.password_updated') });
      
      // Clear form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: unknown) {
      toast({ title: t('toast.error'), description: (error as Error).message || t('toast.password_change_failed'), variant: 'destructive' });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleMasterNotificationToggle = async (enabled: boolean) => {
    setIsTogglingNotifications(true);
    try {
      if (enabled) {
        const success = await subscribeToPush();
        if (success) {
          toast({ title: t('toast.notifications_enabled'), description: t('toast.workout_reminders') });
        } else {
          toast({ title: t('toast.notifications_denied'), description: t('toast.allow_notifications'), variant: 'destructive' });
        }
      } else {
        await unsubscribeFromPush();
        toast({ title: t('toast.notifications_disabled'), description: t('toast.no_notifications') });
      }
    } finally {
      setIsTogglingNotifications(false);
    }
  };

  const handleNotificationTypeToggle = async (
    type: 'morning_reminder' | 'missed_workout' | 'closing_soon' | 'comeback',
    enabled: boolean
  ) => {
    // Update local state immediately for responsiveness
    if (type === 'morning_reminder') setMorningReminder(enabled);
    if (type === 'missed_workout') setMissedWorkout(enabled);
    if (type === 'closing_soon') setClosingSoon(enabled);
    if (type === 'comeback') setComeback(enabled);

    // Persist to database
    const success = await updateNotificationPreference(type, enabled);
    if (!success) {
      // Revert on error
      if (type === 'morning_reminder') setMorningReminder(!enabled);
      if (type === 'missed_workout') setMissedWorkout(!enabled);
      if (type === 'closing_soon') setClosingSoon(!enabled);
      if (type === 'comeback') setComeback(!enabled);
      toast({ title: t('toast.error'), description: t('toast.settings_save_failed'), variant: 'destructive' });
    }
  };

  const handleExportData = async () => {
    if (!user) return;
    try {
      const [{ data: profile }, { data: sessions }] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('user_id', user.id).single(),
        supabase.from('workout_sessions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(200),
      ]);
      const exportData = {
        exported_at: new Date().toISOString(),
        user: { id: user.id, email: user.email },
        profile,
        workout_sessions: sessions ?? [],
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pumplo-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: t('toast.error'), description: t('toast.export_failed'), variant: 'destructive' });
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    
    setIsDeleting(true);
    try {
      // Call edge function to delete user from auth.users (requires service_role)
      const { data, error } = await supabase.functions.invoke('delete-own-account');
      
      if (error) {
        console.error('Delete account error:', error);
        throw new Error(error.message || 'Nepodařilo se smazat účet');
      }
      
      if (!data?.success) {
        throw new Error(data?.error || 'Nepodařilo se smazat účet');
      }

      toast({ title: t('toast.account_deleted'), description: t('toast.account_removed') });

      // Sign out locally and redirect
      await supabase.auth.signOut();
      navigate('/auth');
    } catch (error: unknown) {
      console.error('Delete account error:', error);
      toast({
        title: t('toast.error'),
        description: (error as Error).message || t('toast.delete_failed'),
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  // Check if profile data has changed
  const hasProfileChanges = 
    firstName !== (profile?.first_name || '') || 
    lastName !== (profile?.last_name || '');

  const notificationTypes = [
    {
      id: 'morning_reminder' as const,
      icon: Clock,
      title: t('settings.notif.morning_title'),
      description: t('settings.notif.morning_desc'),
      enabled: morningReminder,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    {
      id: 'missed_workout' as const,
      icon: Flame,
      title: t('settings.notif.missed_title'),
      description: t('settings.notif.missed_desc'),
      enabled: missedWorkout,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10'
    },
    {
      id: 'closing_soon' as const,
      icon: MapPin,
      title: t('settings.notif.closing_title'),
      description: t('settings.notif.closing_desc'),
      enabled: closingSoon,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10'
    },
    {
      id: 'comeback' as const,
      icon: Heart,
      title: t('settings.notif.comeback_title'),
      description: t('settings.notif.comeback_desc'),
      enabled: comeback,
      color: 'text-pink-500',
      bgColor: 'bg-pink-500/10'
    }
  ];

  return (
    <PageTransition>
      <div className="min-h-screen bg-background safe-top">
        {/* Header */}
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border">
          <div className="flex items-center gap-4 px-4 py-4">
            <button
              onClick={() => navigate('/profile')}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-muted hover:bg-muted/80 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold">{t('settings.title')}</h1>
          </div>
        </div>

        <motion.div
          className="px-4 py-6 space-y-6 pb-nav"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Profile Section */}
          <motion.div variants={itemVariants}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">{t('settings.personal')}</h2>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">{t('settings.first_name')}</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder={t('settings.enter_first_name')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">{t('settings.last_name')}</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder={t('settings.enter_last_name')}
                />
              </div>
              <Button
                onClick={handleSaveProfile}
                disabled={isSaving || !hasProfileChanges}
                className="w-full"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    {t('settings.saving')}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {t('settings.save_changes')}
                  </>
                )}
              </Button>
            </div>
          </motion.div>

          {/* Email Section */}
          <motion.div variants={itemVariants}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                <Mail className="w-5 h-5 text-blue-500" />
              </div>
              <h2 className="text-lg font-semibold">{t('settings.email')}</h2>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
              <div className="space-y-2">
                <Label>{t('settings.current_email')}</Label>
                <Input
                  value={user?.email || ''}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newEmail">{t('settings.new_email')}</Label>
                <Input
                  id="newEmail"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder={t('settings.enter_new_email')}
                />
                <p className="text-xs text-muted-foreground">
                  {t('settings.email_verify_note')}
                </p>
              </div>
              <Button
                onClick={handleChangeEmail}
                disabled={isChangingEmail || !newEmail.trim()}
                variant="outline"
                className="w-full"
              >
                {isChangingEmail ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    {t('settings.sending')}
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    {t('settings.change_email')}
                  </>
                )}
              </Button>
            </div>
          </motion.div>

          {/* Password Section */}
          <motion.div variants={itemVariants}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center">
                <Lock className="w-5 h-5 text-orange-500" />
              </div>
              <h2 className="text-lg font-semibold">{t('settings.change_password')}</h2>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">{t('settings.current_password')}</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder={t('settings.enter_current_password')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">{t('settings.new_password')}</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('settings.min_6')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('settings.confirm_password')}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('settings.repeat_password')}
                />
              </div>
              <Button
                onClick={handleChangePassword}
                disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
                variant="outline"
                className="w-full"
              >
                {isChangingPassword ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    {t('settings.changing_password')}
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    {t('settings.change_password_btn')}
                  </>
                )}
              </Button>
            </div>
          </motion.div>

          {/* Notifications Section - Granular */}
          <motion.div variants={itemVariants}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-chart-2/10 rounded-xl flex items-center justify-center">
                <Bell className="w-5 h-5 text-chart-2" />
              </div>
              <h2 className="text-lg font-semibold">{t('settings.notifications')}</h2>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
              {/* Master toggle */}
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="space-y-0.5">
                  <p className="font-medium">{t('settings.enable_notifications')}</p>
                  <p className="text-sm text-muted-foreground">
                    {isSubscribed ? t('settings.notifications_active') : t('settings.notifications_off')}
                  </p>
                </div>
                <Switch
                  checked={isSubscribed}
                  onCheckedChange={handleMasterNotificationToggle}
                  disabled={!isSupported || isTogglingNotifications}
                />
              </div>
              
              {/* Individual toggles */}
              {isSubscribed && (
                <div className="space-y-3 pt-1">
                  {notificationTypes.map((notif) => (
                    <div key={notif.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 ${notif.bgColor} rounded-lg flex items-center justify-center`}>
                          <notif.icon className={`w-4 h-4 ${notif.color}`} />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{notif.title}</p>
                          <p className="text-xs text-muted-foreground">{notif.description}</p>
                        </div>
                      </div>
                      <Switch
                        checked={notif.enabled}
                        onCheckedChange={(enabled) => handleNotificationTypeToggle(notif.id, enabled)}
                      />
                    </div>
                  ))}
                </div>
              )}
              
              {!isSupported && (
                <p className="text-sm text-muted-foreground">
                  {t('settings.no_notification_support')}
                </p>
              )}
            </div>
          </motion.div>
          {/* Language Section */}
          <motion.div variants={itemVariants}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center">
                <Globe className="w-5 h-5 text-purple-500" />
              </div>
              <h2 className="text-lg font-semibold">{t('settings.language')}</h2>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex gap-3">
                <button
                  onClick={() => changeLanguage('cs')}
                  className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors ${
                    currentLang === 'cs'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  🇨🇿 Čeština
                </button>
                <button
                  onClick={() => changeLanguage('en')}
                  className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors ${
                    currentLang === 'en'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  🇬🇧 English
                </button>
              </div>
            </div>
          </motion.div>

          {/* Privacy Section */}
          <motion.div variants={itemVariants}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold">{t('settings.privacy')}</h2>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
              <div className="space-y-2">
                <p className="font-medium">{t('settings.your_data')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('settings.data_desc')}
                </p>
              </div>
              <Button variant="outline" className="w-full justify-start gap-2" onClick={handleExportData}>
                <Download className="w-4 h-4" />
                {t('settings.download_data')}
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate('/privacy')}>
                <ExternalLink className="w-4 h-4" />
                {t('settings.privacy_policy')}
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate('/terms')}>
                <ExternalLink className="w-4 h-4" />
                {t('settings.terms')}
              </Button>
            </div>
          </motion.div>

          {/* Danger Zone */}
          <motion.div variants={itemVariants}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-destructive/10 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <h2 className="text-lg font-semibold text-destructive">{t('settings.danger_zone')}</h2>
            </div>
            <div className="bg-card border border-destructive/30 rounded-2xl p-4 space-y-4">
              <div className="space-y-2">
                <p className="font-medium">{t('settings.delete_account')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('settings.delete_desc')}
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full border-destructive text-destructive hover:bg-destructive/10"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t('settings.delete_btn')}
              </Button>
            </div>
          </motion.div>
        </motion.div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('settings.confirm_delete')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('settings.confirm_delete_desc')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('settings.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    {t('settings.deleting')}
                  </>
                ) : (
                  t('settings.delete_btn')
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PageTransition>
  );
};

export default Settings;
