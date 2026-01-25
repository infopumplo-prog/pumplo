import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Bell, Shield, Trash2, Save, AlertTriangle, Lock, Mail, Clock, Flame, MapPin } from 'lucide-react';
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
  }, [notificationPreferences]);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const result = await updateProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      });
      
      if (result.success) {
        toast({
          title: 'Uloženo',
          description: 'Profil byl úspěšně aktualizován.',
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({
        title: 'Chyba',
        description: 'Nepodařilo se uložit změny.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!newEmail.trim()) {
      toast({
        title: 'Chyba',
        description: 'Zadejte nový e-mail.',
        variant: 'destructive',
      });
      return;
    }

    if (newEmail === user?.email) {
      toast({
        title: 'Chyba',
        description: 'Nový e-mail je stejný jako současný.',
        variant: 'destructive',
      });
      return;
    }

    setIsChangingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail.trim(),
      });

      if (error) throw error;

      toast({
        title: 'Ověřovací e-mail odeslán',
        description: 'Zkontrolujte svou novou e-mailovou schránku a potvrďte změnu.',
      });
      setNewEmail('');
    } catch (error: any) {
      toast({
        title: 'Chyba',
        description: error.message || 'Nepodařilo se změnit e-mail.',
        variant: 'destructive',
      });
    } finally {
      setIsChangingEmail(false);
    }
  };

  const handleChangePassword = async () => {
    // Validation
    if (!currentPassword) {
      toast({
        title: 'Chyba',
        description: 'Zadejte aktuální heslo.',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: 'Chyba',
        description: 'Nové heslo musí mít alespoň 6 znaků.',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Chyba',
        description: 'Hesla se neshodují.',
        variant: 'destructive',
      });
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
        toast({
          title: 'Chyba',
          description: 'Nesprávné aktuální heslo.',
          variant: 'destructive',
        });
        return;
      }

      // Change password
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast({
        title: 'Heslo změněno',
        description: 'Vaše heslo bylo úspěšně aktualizováno.',
      });
      
      // Clear form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast({
        title: 'Chyba',
        description: error.message || 'Nepodařilo se změnit heslo.',
        variant: 'destructive',
      });
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
          toast({
            title: 'Oznámení povolena',
            description: 'Budete dostávat připomínky na trénink.',
          });
        } else {
          toast({
            title: 'Oznámení zamítnuta',
            description: 'Povolte oznámení v nastavení prohlížeče.',
            variant: 'destructive',
          });
        }
      } else {
        await unsubscribeFromPush();
        toast({
          title: 'Oznámení vypnuta',
          description: 'Nebudete dostávat žádná oznámení.',
        });
      }
    } finally {
      setIsTogglingNotifications(false);
    }
  };

  const handleNotificationTypeToggle = async (
    type: 'morning_reminder' | 'missed_workout' | 'closing_soon',
    enabled: boolean
  ) => {
    // Update local state immediately for responsiveness
    if (type === 'morning_reminder') setMorningReminder(enabled);
    if (type === 'missed_workout') setMissedWorkout(enabled);
    if (type === 'closing_soon') setClosingSoon(enabled);
    
    // Persist to database
    const success = await updateNotificationPreference(type, enabled);
    if (!success) {
      // Revert on error
      if (type === 'morning_reminder') setMorningReminder(!enabled);
      if (type === 'missed_workout') setMissedWorkout(!enabled);
      if (type === 'closing_soon') setClosingSoon(!enabled);
      toast({
        title: 'Chyba',
        description: 'Nepodařilo se uložit nastavení.',
        variant: 'destructive',
      });
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

      toast({
        title: 'Účet smazán',
        description: 'Váš účet byl úspěšně odstraněn.',
      });
      
      // Sign out locally and redirect
      await supabase.auth.signOut();
      navigate('/auth');
    } catch (error: any) {
      console.error('Delete account error:', error);
      toast({
        title: 'Chyba',
        description: error.message || 'Nepodařilo se smazat účet. Zkuste to znovu.',
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
      title: 'Ranní připomínka',
      description: 'Připomenutí tréninku ráno',
      enabled: morningReminder,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    {
      id: 'missed_workout' as const,
      icon: Flame,
      title: 'Zmeškaný trénink',
      description: 'Upozornění po vynechaném tréninku',
      enabled: missedWorkout,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10'
    },
    {
      id: 'closing_soon' as const,
      icon: MapPin,
      title: 'Posilovna zavírá',
      description: 'Upozornění 2h před zavíračkou',
      enabled: closingSoon,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10'
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
            <h1 className="text-xl font-bold">Nastavení</h1>
          </div>
        </div>

        <motion.div
          className="px-4 py-6 space-y-6 pb-32"
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
              <h2 className="text-lg font-semibold">Osobní údaje</h2>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Jméno</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Zadejte jméno"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Příjmení</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Zadejte příjmení"
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
                    Ukládám...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Uložit změny
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
              <h2 className="text-lg font-semibold">E-mail</h2>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
              <div className="space-y-2">
                <Label>Aktuální e-mail</Label>
                <Input
                  value={user?.email || ''}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newEmail">Nový e-mail</Label>
                <Input
                  id="newEmail"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Zadejte nový e-mail"
                />
                <p className="text-xs text-muted-foreground">
                  Na novou adresu bude odeslán ověřovací e-mail
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
                    Odesílám...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Změnit e-mail
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
              <h2 className="text-lg font-semibold">Změna hesla</h2>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Aktuální heslo</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Zadejte aktuální heslo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nové heslo</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimálně 6 znaků"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Potvrdit nové heslo</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Zopakujte nové heslo"
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
                    Měním heslo...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Změnit heslo
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
              <h2 className="text-lg font-semibold">Oznámení</h2>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
              {/* Master toggle */}
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="space-y-0.5">
                  <p className="font-medium">Povolit oznámení</p>
                  <p className="text-sm text-muted-foreground">
                    {isSubscribed ? 'Oznámení jsou aktivní' : 'Oznámení jsou vypnutá'}
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
                  Váš prohlížeč nepodporuje oznámení.
                </p>
              )}
            </div>
          </motion.div>
          {/* Privacy Section */}
          <motion.div variants={itemVariants}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold">Soukromí a bezpečnost</h2>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
              <div className="space-y-2">
                <p className="font-medium">Vaše data</p>
                <p className="text-sm text-muted-foreground">
                  Vaše osobní údaje a historie tréninků jsou bezpečně uloženy a nejsou sdíleny s třetími stranami.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Danger Zone */}
          <motion.div variants={itemVariants}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-destructive/10 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <h2 className="text-lg font-semibold text-destructive">Nebezpečná zóna</h2>
            </div>
            <div className="bg-card border border-destructive/30 rounded-2xl p-4 space-y-4">
              <div className="space-y-2">
                <p className="font-medium">Smazat účet</p>
                <p className="text-sm text-muted-foreground">
                  Tato akce je nevratná. Všechny vaše data budou trvale odstraněny.
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full border-destructive text-destructive hover:bg-destructive/10"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Smazat účet
              </Button>
            </div>
          </motion.div>
        </motion.div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Opravdu chcete smazat účet?</AlertDialogTitle>
              <AlertDialogDescription>
                Tato akce je nevratná. Všechny vaše tréninky, statistiky a osobní údaje budou trvale smazány.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Zrušit</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    Mažu...
                  </>
                ) : (
                  'Smazat účet'
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
