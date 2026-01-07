import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

const GymSettings = () => {
  const { gym, isLoading, refetch } = useGym();
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteGym = async () => {
    if (!gym) return;
    
    setIsDeleting(true);
    const { error } = await supabase
      .from('gyms')
      .delete()
      .eq('id', gym.id);

    if (error) {
      toast.error('Nepodarilo sa odstrániť posilňovňu');
      setIsDeleting(false);
    } else {
      toast.success('Posilňovňa bola odstránená');
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
        <Alert variant="default" className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-200">
            Nemáte vytvorený profil posilňovne
          </AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            Pre prístup k nastaveniam musíte mať vytvorený profil posilňovne.
          </AlertDescription>
        </Alert>
        <Button asChild className="w-full mt-4">
          <Link to="/business">Vytvoriť profil</Link>
        </Button>
      </BusinessLayout>
    );
  }

  return (
    <BusinessLayout>
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Nastavenia</h2>

        {/* Danger Zone */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Nebezpečná zóna</CardTitle>
            <CardDescription>
              Tieto akcie sú nezvratné. Buďte opatrní.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full gap-2">
                  <Trash2 className="w-4 h-4" />
                  Odstrániť posilňovňu
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Ste si istí?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Táto akcia je nezvratná. Váš profil posilňovne "{gym.name}" bude 
                    permanentne odstránený spolu so všetkými strojmi.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Zrušiť</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDeleteGym}
                    disabled={isDeleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Odstraňujem...
                      </>
                    ) : (
                      'Odstrániť'
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </BusinessLayout>
  );
};

export default GymSettings;
