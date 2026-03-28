import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { unlockAudio } from '@/lib/workoutAudio';
import { motion } from 'framer-motion';
import { Play, MapPin, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { supabase } from '@/integrations/supabase/client';
import { isGymCurrentlyOpen } from '@/lib/gymUtils';
import { OpeningHours } from '@/hooks/useGym';
import { toast } from 'sonner';

interface StartWorkoutButtonProps {
  selectedGymId: string | null;
  className?: string;
}

export const StartWorkoutButton = ({ selectedGymId, className }: StartWorkoutButtonProps) => {
  const navigate = useNavigate();
  
  const [showGymConfirmDialog, setShowGymConfirmDialog] = useState(false);
  const [showGymClosedWarning, setShowGymClosedWarning] = useState(false);
  const [gymName, setGymName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleStartWorkout = async () => {
    // Uživatel musí mít vybranou posilovnu
    if (!selectedGymId) {
      toast.error('Nejdříve vyber posilovnu na mapě');
      navigate('/map');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Načti název posilovny
      const { data: gymData } = await supabase
        .from('gyms')
        .select('name, opening_hours')
        .eq('id', selectedGymId)
        .single();
      
      if (!gymData) {
        toast.error('Posilovna nebyla nalezena');
        return;
      }
      
      setGymName(gymData.name || 'Vybraná posilovna');
      
      // Zkontroluj otevírací hodiny
      if (gymData.opening_hours) {
        const isOpen = isGymCurrentlyOpen(gymData.opening_hours as OpeningHours);
        if (!isOpen) {
          setShowGymClosedWarning(true);
          return;
        }
      }
      
      // Zobraz potvrzovací dialog
      setShowGymConfirmDialog(true);
    } catch (error) {
      console.error('Error checking gym:', error);
      toast.error('Chyba při kontrole posilovny');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmGymAndStart = () => {
    unlockAudio(); // Unlock audio on user gesture for mobile
    setShowGymConfirmDialog(false);
    // Navigate to training with auto-start parameter
    navigate('/training?start=true');
  };

  const handleChangeGym = () => {
    setShowGymConfirmDialog(false);
    setShowGymClosedWarning(false);
    navigate('/map');
  };

  return (
    <>
      <motion.div
        className={className}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Button
          onClick={handleStartWorkout}
          disabled={isLoading}
          size="lg"
          variant="gradient"
          className="w-full gap-3 h-14 text-base font-semibold rounded-2xl"
        >
          <Play className="w-5 h-5" />
          {isLoading ? 'Načítám...' : 'Začít trénink'}
        </Button>
      </motion.div>

      {/* Gym Confirmation Dialog */}
      <AlertDialog open={showGymConfirmDialog} onOpenChange={setShowGymConfirmDialog}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <MapPin className="w-6 h-6 text-primary" />
              </div>
              <AlertDialogTitle className="text-xl">Jdeš cvičit do {gymName}?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base">
              Trénink bude přizpůsoben vybavení této posilovny.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={handleChangeGym} className="rounded-xl">
              Vybrat jinou
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmGymAndStart} className="rounded-xl gap-2">
              <Play className="w-4 h-4" />
              Ano, začít
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Gym Closed Warning Dialog */}
      <AlertDialog open={showGymClosedWarning} onOpenChange={setShowGymClosedWarning}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-warning/10 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-warning" />
              </div>
              <AlertDialogTitle className="text-xl">Posilovna je zavřená</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base">
              {gymName} je aktuálně zavřená. Vyber jinou posilovnu nebo počkej na otevírací dobu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="rounded-xl">
              Zrušit
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleChangeGym} className="rounded-xl gap-2">
              <MapPin className="w-4 h-4" />
              Vybrat jinou posilovnu
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
