import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Bell, Shield, Trash2, Save, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useTrainingNotifications } from '@/hooks/useTrainingNotifications';
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
  const { isSupported, notificationPermission, requestPermission } = useTrainingNotifications();
  const { toast } = useToast();

  const [firstName, setFirstName] = useState(profile?.first_name || '');
  const [lastName, setLastName] = useState(profile?.last_name || '');
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(notificationPermission === 'granted');

  // Update local state when profile loads
  useState(() => {
    if (profile) {
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
    }
  });

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

  const handleNotificationToggle = async (enabled: boolean) => {
    if (enabled && notificationPermission !== 'granted') {
      const granted = await requestPermission();
      setNotificationsEnabled(granted);
      if (granted) {
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
      setNotificationsEnabled(enabled);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    
    setIsDeleting(true);
    try {
      // Delete user profile first
      const { error: profileError } = await supabase
        .from('user_profiles')
        .delete()
        .eq('user_id', user.id);
      
      if (profileError) throw profileError;

      // Delete user role
      const { error: roleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', user.id);
      
      if (roleError) console.error('Role deletion error:', roleError);

      // Sign out and redirect
      await supabase.auth.signOut();
      
      toast({
        title: 'Účet smazán',
        description: 'Váš účet byl úspěšně odstraněn.',
      });
      
      navigate('/auth');
    } catch (error) {
      console.error('Delete account error:', error);
      toast({
        title: 'Chyba',
        description: 'Nepodařilo se smazat účet. Zkuste to znovu.',
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
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input
                  value={user?.email || ''}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">E-mail nelze změnit</p>
              </div>
              <Button
                onClick={handleSaveProfile}
                disabled={isSaving}
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

          {/* Notifications Section */}
          <motion.div variants={itemVariants}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-chart-2/10 rounded-xl flex items-center justify-center">
                <Bell className="w-5 h-5 text-chart-2" />
              </div>
              <h2 className="text-lg font-semibold">Oznámení</h2>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="font-medium">Připomínky tréninku</p>
                  <p className="text-sm text-muted-foreground">
                    Dostávejte upozornění v dny tréninku
                  </p>
                </div>
                <Switch
                  checked={notificationsEnabled}
                  onCheckedChange={handleNotificationToggle}
                  disabled={!isSupported}
                />
              </div>
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
