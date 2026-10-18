import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { HevyImportSection } from '@/components/settings/HevyImportSection';
import AccentPicker from '@/components/AccentPicker';
import type { AccentColor } from '@/lib/accentColors';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Bell, Shield, Trash2, Save, AlertTriangle, Lock, Mail, Clock, Flame, MapPin, Download, ExternalLink, Globe, Heart, Moon, Sun, Smartphone, BarChart3, ChevronRight, Calendar, Dumbbell, Upload, Palette, HelpCircle, FileText, LogOut, type LucideIcon } from 'lucide-react';
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
import { signUpErrorMessage } from '@/lib/authErrors';
import PageTransition from '@/components/PageTransition';
import { Capacitor } from '@capacitor/core';
import { useAppConsent } from '@/hooks/useAppConsent';
import { openAppConsentSettings } from '@/lib/appAnalytics';
import { loadInjuryNote } from '@/lib/injuryNote';
import { CoachTour, useCoachTour, CoachHelpButton } from '@/components/coach/CoachTour';
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
  const { preference, setPreference, theme, amoled, setAmoled, accent, setAccent } = useTheme();
  // Barva appky: hned lokálně + do profilu, ať platí i na jiném telefonu.
  const [accentOpen, setAccentOpen] = useState(false);
  const changeAccent = (next: AccentColor) => {
    setAccent(next);
    if (user) void supabase.from('user_profiles').update({ accent_color: next }).eq('user_id', user.id);
  };

  // First-visit hints.
  const tour = useCoachTour('settings', 1, true);
  const tourSteps = [
    { title: t('tour.settings.overview_title'), body: t('tour.settings.overview_body'), target: '[data-coach="help-btn"]' },
    { target: '[data-coach="help-btn"]', title: t('tour.common.help_title'), body: t('tour.common.help_body') },
  ];
  const currentLang = i18n.language as 'cs' | 'en';
  const appConsent = useAppConsent();
  const onOff = (v: boolean | undefined) => t(v ? 'settings.measurement_on' : 'settings.measurement_off');

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
  // Rozbalená položka seznamu (formuláře účtu, import) — vždy jen jedna.
  const [openSection, setOpenSection] = useState<SectionKey | null>(null);
  
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
      const description = error instanceof Error
        ? signUpErrorMessage(error as { code?: string; message: string })
        : t('toast.password_change_failed');
      toast({ title: t('toast.error'), description, variant: 'destructive' });
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
      const [{ data: profile }, { data: sessions }, { data: checkins }, injuryNote] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('user_id', user.id).single(),
        supabase.from('workout_sessions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(200),
        // Týdenní check-iny patří do exportu (GDPR přenositelnost, 13. 10.)
        supabase.from('weekly_checkins').select('*').eq('user_id', user.id).order('week_start', { ascending: false }),
        // Popis zranění je mimo profil (user_injury_notes, 17. 10.) — v exportu nesmí chybět.
        loadInjuryNote(user.id),
      ]);
      const exportData = {
        exported_at: new Date().toISOString(),
        user: { id: user.id, email: user.email },
        profile,
        workout_sessions: sessions ?? [],
        weekly_checkins: checkins ?? [],
        injury_note: injuryNote,
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
        throw new Error(error.message || t('toast.delete_failed'));
      }
      
      if (!data?.success) {
        throw new Error(data?.error || t('toast.delete_failed'));
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

  // E-maily s tipy: zapnuto = není odhlášený ani neodmítl tipy při registraci.
  // Zapnutí je výslovná volba, proto ruší i odmítnutí z registrace.
  const [isTogglingEmailTips, setIsTogglingEmailTips] = useState(false);
  const emailTipsEnabled = !profile?.email_unsubscribed_at && !profile?.marketing_optout_at;
  const handleEmailTipsToggle = async (enabled: boolean) => {
    setIsTogglingEmailTips(true);
    const result = await updateProfile(
      enabled
        ? { email_unsubscribed_at: null, marketing_optout_at: null }
        : { email_unsubscribed_at: new Date().toISOString() },
    );
    setIsTogglingEmailTips(false);
    if (result.success) {
      toast({ title: t('toast.saved'), description: enabled ? t('settings.email_tips_on') : t('settings.email_tips_off') });
    } else {
      toast({ title: t('settings.email_tips_title'), description: result.error, variant: 'destructive' });
    }
  };

  // Check if profile data has changed
  const hasProfileChanges = 
    firstName !== (profile?.first_name || '') || 
    lastName !== (profile?.last_name || '');

  // Typy oznámení — ikony v barvě appky (feedback 13. 10.).
  const notificationTypes = [
    { id: 'morning_reminder' as const, icon: Clock, title: t('settings.notif.morning_title'), description: t('settings.notif.morning_desc'), enabled: morningReminder },
    { id: 'missed_workout' as const, icon: Flame, title: t('settings.notif.missed_title'), description: t('settings.notif.missed_desc'), enabled: missedWorkout },
    { id: 'closing_soon' as const, icon: MapPin, title: t('settings.notif.closing_title'), description: t('settings.notif.closing_desc'), enabled: closingSoon },
    { id: 'comeback' as const, icon: Heart, title: t('settings.notif.comeback_title'), description: t('settings.notif.comeback_desc'), enabled: comeback },
  ];

  const toggleSection = (key: SectionKey) => setOpenSection((cur) => (cur === key ? null : key));
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');

  return (
    <PageTransition>
      <div className="min-h-screen bg-background safe-top">
        {/* Header */}
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border">
          <div className="flex items-center gap-4 px-4 py-4">
            <button
              onClick={() => navigate('/profile')}
              aria-label={t('settings.back')}
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-muted hover:bg-muted/80 active:scale-95 active:bg-muted/60 transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold">{t('settings.title')}</h1>
            <CoachHelpButton onClick={tour.openTour} />
          </div>
        </div>

        {/* Nastavení ve skupinách jako v iOS (feedback 13. 10.: „strašně pod sebou, nejde se v tom vyznat“) */}
        <motion.div
          className="px-4 py-5 space-y-6 pb-nav"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* ── Účet ── */}
          <motion.div variants={itemVariants}>
            <SettingsGroup title={t('settings.group_account')}>
              <SettingsRow
                icon={User}
                label={t('settings.personal')}
                value={fullName || undefined}
                expanded={openSection === 'name'}
                onClick={() => toggleSection('name')}
              />
              {openSection === 'name' && (
                <div className="px-4 pb-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">{t('settings.first_name')}</Label>
                    <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder={t('settings.enter_first_name')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">{t('settings.last_name')}</Label>
                    <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder={t('settings.enter_last_name')} />
                  </div>
                  <Button onClick={handleSaveProfile} disabled={isSaving || !hasProfileChanges} className="w-full">
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
              )}

              <SettingsRow
                icon={Mail}
                label={t('settings.email')}
                value={user?.email || undefined}
                expanded={openSection === 'email'}
                onClick={() => toggleSection('email')}
              />
              {openSection === 'email' && (
                <div className="px-4 pb-4 space-y-4">
                  <div className="space-y-2">
                    <Label>{t('settings.current_email')}</Label>
                    <Input value={user?.email || ''} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newEmail">{t('settings.new_email')}</Label>
                    <Input id="newEmail" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder={t('settings.enter_new_email')} />
                    <p className="text-xs text-muted-foreground">{t('settings.email_verify_note')}</p>
                  </div>
                  <Button onClick={handleChangeEmail} disabled={isChangingEmail || !newEmail.trim()} className="w-full">
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
              )}

              <SettingsRow
                icon={Lock}
                label={t('settings.change_password')}
                hint={t('settings.password_hint')}
                expanded={openSection === 'password'}
                onClick={() => toggleSection('password')}
              />
              {openSection === 'password' && (
                <div className="px-4 pb-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">{t('settings.current_password')}</Label>
                    <Input id="currentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder={t('settings.enter_current_password')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">{t('settings.new_password')}</Label>
                    <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t('settings.min_6')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">{t('settings.confirm_password')}</Label>
                    <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={t('settings.repeat_password')} />
                  </div>
                  <Button
                    onClick={handleChangePassword}
                    disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
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
              )}
            </SettingsGroup>
          </motion.div>

          {/* ── Vzhled a jazyk ── */}
          <motion.div variants={itemVariants}>
            <SettingsGroup title={t('settings.group_appearance')}>
              <div className="px-4 py-3.5">
                <RowTitle icon={Moon} label={t('settings.theme')} />
                <div className="flex gap-2 mt-3">
                  {([
                    { value: 'light', label: t('settings.theme_light'), icon: Sun },
                    { value: 'dark', label: t('settings.theme_dark'), icon: Moon },
                    { value: 'system', label: t('settings.theme_system'), icon: Smartphone },
                  ] as const).map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => setPreference(value)}
                      aria-pressed={preference === value}
                      className={`flex-1 min-h-[56px] flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-xl font-medium text-xs transition-all active:scale-95 ${
                        preference === value
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80 active:bg-muted/60'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </div>
                {preference === 'system' && (
                  <p className="text-xs text-muted-foreground mt-2.5">{t('settings.theme_system_hint')}</p>
                )}
              </div>

              {theme === 'dark' && (
                <button
                  onClick={() => setAmoled(!amoled)}
                  role="switch"
                  aria-checked={amoled}
                  className="w-full min-h-[56px] flex items-center gap-3 px-4 py-3 text-left active:bg-muted/60 transition-colors"
                >
                  <RowIcon icon={Smartphone} />
                  <span className="flex-1 min-w-0 text-[15px] font-medium">
                    {t('settings.amoled')}
                    <span className="block text-xs text-muted-foreground font-normal">{t('settings.amoled_hint')}</span>
                  </span>
                  <span className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${amoled ? 'bg-primary' : 'bg-border'}`}>
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${amoled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                  </span>
                </button>
              )}

              {/* Výběr barvy se rozbalí na klepnutí — rozbalený zabíral moc místa (David 17. 10.). */}
              <div>
                <button
                  type="button"
                  onClick={() => setAccentOpen(o => !o)}
                  aria-expanded={accentOpen}
                  className="w-full min-h-[56px] flex items-center gap-3 px-4 py-3 text-left active:bg-muted/60 transition-colors"
                >
                  <RowIcon icon={Palette} />
                  <span className="flex-1 min-w-0 text-[15px] font-medium">
                    {t('accent.title')}
                    <span className="block text-xs text-muted-foreground font-normal">{t('settings.accent_hint')}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0 text-sm text-muted-foreground">
                    <span className="w-4 h-4 rounded-full" style={{ background: 'hsl(var(--primary))' }} />
                    {t(`accent.${accent}`)}
                  </span>
                  <ChevronRight className={`w-5 h-5 text-muted-foreground shrink-0 transition-transform ${accentOpen ? 'rotate-90' : ''}`} />
                </button>
                {accentOpen && (
                  <div className="px-4 pb-3.5">
                    <AccentPicker value={accent} onChange={changeAccent} />
                  </div>
                )}
              </div>

              <div className="px-4 py-3.5">
                <RowTitle icon={Globe} label={t('settings.language')} />
                <div className="flex gap-2 mt-3">
                  {([['cs', '🇨🇿 Čeština'], ['en', '🇬🇧 English']] as const).map(([lang, label]) => (
                    <button
                      key={lang}
                      onClick={() => changeLanguage(lang)}
                      aria-pressed={currentLang === lang}
                      className={`flex-1 min-h-[44px] py-2.5 rounded-xl font-medium text-sm transition-all active:scale-95 ${
                        currentLang === lang
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80 active:bg-muted/60'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </SettingsGroup>
          </motion.div>

          {/* ── Trénink ── */}
          <motion.div variants={itemVariants}>
            <SettingsGroup title={t('settings.group_training')}>
              <SettingsRow icon={Calendar} label={t('profile.my_plan')} hint={t('settings.my_plan_hint')} onClick={() => navigate('/profile/plan')} />
              <SettingsRow icon={Dumbbell} label={t('profile.my_exercises')} hint={t('settings.my_exercises_hint')} onClick={() => navigate('/profile/exercises')} />
              {/* Import z Hevy používá málokdo → sbalené */}
              <SettingsRow
                icon={Upload}
                label={t('hevy.title')}
                hint={t('settings.hevy_hint')}
                expanded={openSection === 'hevy'}
                onClick={() => toggleSection('hevy')}
              />
              {openSection === 'hevy' && (
                <div className="px-3 pb-3">
                  <HevyImportSection />
                </div>
              )}
            </SettingsGroup>
          </motion.div>

          {/* ── Oznámení ── */}
          <motion.div variants={itemVariants}>
            <SettingsGroup title={t('settings.notifications')} footer={t('settings.notifications_hint')}>
              <div className="min-h-[56px] flex items-center gap-3 px-4 py-3">
                <RowIcon icon={Bell} />
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium">{t('settings.enable_notifications')}</p>
                  <p className="text-xs text-muted-foreground">
                    {isSubscribed ? t('settings.notifications_active') : t('settings.notifications_off')}
                  </p>
                </div>
                <Switch
                  checked={isSubscribed}
                  onCheckedChange={handleMasterNotificationToggle}
                  disabled={!isSupported || isTogglingNotifications}
                />
              </div>
              {isSubscribed && notificationTypes.map((notif) => (
                <div key={notif.id} className="min-h-[56px] flex items-center gap-3 px-4 py-3">
                  <RowIcon icon={notif.icon} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium">{notif.title}</p>
                    <p className="text-xs text-muted-foreground">{notif.description}</p>
                  </div>
                  <Switch
                    checked={notif.enabled}
                    onCheckedChange={(enabled) => handleNotificationTypeToggle(notif.id, enabled)}
                  />
                </div>
              ))}
              {!isSupported && (
                <p className="px-4 py-3 text-sm text-muted-foreground">{t('settings.no_notification_support')}</p>
              )}
              {/* E-maily s tipy (F0 e-maily 18. 10.): vypnutí = email_unsubscribed_at, nezávisle na pushi. */}
              <div className="min-h-[56px] flex items-center gap-3 px-4 py-3">
                <RowIcon icon={Mail} />
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium">{t('settings.email_tips_title')}</p>
                  <p className="text-xs text-muted-foreground">{t('settings.email_tips_desc')}</p>
                </div>
                <Switch
                  checked={emailTipsEnabled}
                  onCheckedChange={handleEmailTipsToggle}
                  disabled={!profile || isTogglingEmailTips}
                  aria-label={t('settings.email_tips_title')}
                />
              </div>
            </SettingsGroup>
          </motion.div>

          {/* ── Soukromí a data ── */}
          <motion.div variants={itemVariants}>
            <SettingsGroup title={t('settings.group_privacy')} footer={t('settings.data_desc')}>
              <SettingsRow icon={Download} label={t('settings.download_data')} hint={t('settings.export_hint')} onClick={handleExportData} />
              {Capacitor.isNativePlatform() && (
                <SettingsRow
                  icon={BarChart3}
                  label={t('settings.measurement')}
                  hint={`${t('consent.cat_analytics')}: ${onOff(appConsent?.analytics)} · ${t('consent.cat_marketing')}: ${onOff(appConsent?.marketing)}`}
                  onClick={openAppConsentSettings}
                  dataConsentSettings
                />
              )}
            </SettingsGroup>
          </motion.div>

          {/* ── Podpora a o aplikaci ── */}
          <motion.div variants={itemVariants}>
            <SettingsGroup title={t('settings.group_support')}>
              <SettingsRow icon={HelpCircle} label={t('settings.help_tour')} onClick={tour.openTour} />
              <SettingsRow icon={Shield} label={t('settings.privacy_policy')} onClick={() => navigate('/privacy')} trailing={ExternalLink} />
              <SettingsRow icon={FileText} label={t('settings.terms')} onClick={() => navigate('/terms')} trailing={ExternalLink} />
            </SettingsGroup>
          </motion.div>

          {/* ── Odhlášení a smazání účtu (úplně dole) ── */}
          <motion.div variants={itemVariants} className="space-y-3">
            <Button variant="outline" size="lg" className="w-full" onClick={logout}>
              <LogOut className="w-5 h-5" />
              {t('profile.sign_out')}
            </Button>
            <div className="bg-card border border-destructive/30 rounded-2xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-destructive/10 rounded-lg flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-destructive">{t('settings.danger_zone')}</p>
                  <p className="text-sm text-muted-foreground">{t('settings.delete_desc')}</p>
                </div>
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
      <CoachTour screenId="settings" steps={tourSteps} open={tour.open} onClose={tour.closeTour} />
    </PageTransition>
  );
};

// ── Stavební kameny seskupeného seznamu (feedback 13. 10.) ──
type SectionKey = 'name' | 'email' | 'password' | 'hevy';

const SettingsGroup = ({ title, footer, children }: { title: string; footer?: string; children: React.ReactNode }) => (
  <section>
    <h2 className="px-4 mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
    <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">{children}</div>
    {footer && <p className="px-4 mt-2 text-xs text-muted-foreground">{footer}</p>}
  </section>
);

const RowIcon = ({ icon: Icon }: { icon: LucideIcon }) => (
  <span className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
    <Icon className="w-[18px] h-[18px] text-primary" />
  </span>
);

const RowTitle = ({ icon, label, hint }: { icon: LucideIcon; label: string; hint?: string }) => (
  <div className="flex items-center gap-3">
    <RowIcon icon={icon} />
    <div className="min-w-0">
      <p className="text-[15px] font-medium">{label}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  </div>
);

const SettingsRow = ({ icon, label, hint, value, onClick, expanded, trailing: Trailing, dataConsentSettings }: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  value?: string;
  onClick: () => void;
  expanded?: boolean;
  trailing?: LucideIcon;
  dataConsentSettings?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-expanded={expanded}
    data-consent-settings={dataConsentSettings ? '' : undefined}
    className="w-full min-h-[56px] flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 active:bg-muted transition-colors"
  >
    <RowIcon icon={icon} />
    <span className="flex-1 min-w-0">
      <span className="block text-[15px] font-medium">{label}</span>
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </span>
    {value && <span className="max-w-[45%] truncate text-sm text-muted-foreground">{value}</span>}
    {Trailing ? (
      <Trailing className="w-4 h-4 text-muted-foreground shrink-0" />
    ) : (
      <ChevronRight className={`w-5 h-5 text-muted-foreground shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
    )}
  </button>
);

export default Settings;
