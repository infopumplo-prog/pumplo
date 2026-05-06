import { AlertTriangle, Loader2, Trash2, Building2, LogOut, EyeOff, Eye } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import BusinessLayout from './BusinessLayout';
import { useGym } from '@/hooks/useGym';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';

const GymSettings = () => {
  const { t } = useTranslation();
  const { gym, gyms, isLoading, refetch, togglePublish } = useGym();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const handleToggleVisibility = async () => {
    setIsToggling(true);
    await togglePublish();
    setIsToggling(false);
  };

  const handleDeleteGym = async () => {
    if (!gym) return;

    setIsDeleting(true);
    const { error } = await supabase
      .from('gyms')
      .delete()
      .eq('id', gym.id);

    if (error) {
      toast.error(t('business.delete_dialog_title', { name: gym.name }));
      setIsDeleting(false);
    } else {
      toast.success(t('business.gym_deleted'));
      await refetch();
      navigate('/business');
    }
  };

  if (isLoading) {
    return (
      <BusinessLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </BusinessLayout>
    );
  }

  if (!gym) {
    return (
      <BusinessLayout>
        <div className="space-y-4">
          <Alert variant="default" className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800 dark:text-amber-200">
              {t('business.no_gym_profile')}
            </AlertTitle>
            <AlertDescription className="text-amber-700 dark:text-amber-300">
              {t('business.settings_no_gym')}
            </AlertDescription>
          </Alert>
          <Button asChild className="w-full">
            <Link to="/business">{t('business.settings_create_profile')}</Link>
          </Button>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('business.settings_account')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full border-destructive text-destructive hover:bg-destructive/10"
                onClick={logout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                {t('business.settings_logout')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </BusinessLayout>
    );
  }

  return (
    <BusinessLayout>
      <div className="space-y-4">
        {/* Current Gym Indicator */}
        {gyms.length > 1 && (
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{t('business.settings_for')}</span>
            <Badge variant="secondary">{gym.name}</Badge>
            <Link to="/business" className="ml-auto text-xs text-primary hover:underline">
              {t('business.settings_change')}
            </Link>
          </div>
        )}

        <h2 className="text-lg font-semibold">{t('business.settings_title')}</h2>

        {/* Visibility Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('business.visibility')}</CardTitle>
            <CardDescription>
              {t('business.visibility_desc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full gap-2" disabled={isToggling}>
                  {isToggling ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : gym.is_published ? (
                    <>
                      <EyeOff className="w-4 h-4" />
                      {t('business.hide_from_map')}
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4" />
                      {t('business.show_on_map')}
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {gym.is_published
                      ? t('business.hide_dialog_title', { name: gym.name })
                      : t('business.show_dialog_title', { name: gym.name })}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {gym.is_published
                      ? t('business.hide_dialog_desc')
                      : t('business.show_dialog_desc')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('business.cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleToggleVisibility}>
                    {gym.is_published ? t('business.hide_btn') : t('business.show_btn')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        {/* Danger Zone - Delete */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-muted-foreground">{t('business.danger_zone')}</CardTitle>
            <CardDescription>
              {t('business.danger_zone_desc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                  {t('business.delete_gym')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-destructive">
                    {t('business.delete_dialog_title', { name: gym.name })}
                  </AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-2">
                      <p>{t('business.delete_dialog_desc')}</p>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('business.cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteGym}
                    disabled={isDeleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {t('business.deleting')}
                      </>
                    ) : (
                      t('business.delete_confirm')
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        {/* Account Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('business.settings_account')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full border-destructive text-destructive hover:bg-destructive/10"
              onClick={logout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              {t('business.settings_logout')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </BusinessLayout>
  );
};

export default GymSettings;
