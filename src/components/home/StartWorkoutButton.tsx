import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { unlockAudio } from '@/lib/workoutAudio';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GymSelector } from '@/components/workout/GymSelector';
import { GymLocationGate } from '@/components/workout/GymLocationGate';
import { prefetchGymLocation } from '@/hooks/useGymLocation';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { tr } from '@/lib/uiLocale';

interface StartWorkoutButtonProps {
  selectedGymId: string | null;
  /** Vlastní vybavení z profilu (feedback 13. 10.) */
  customEquipment?: string[] | null;
  className?: string;
}

export const StartWorkoutButton = ({ selectedGymId, customEquipment, className }: StartWorkoutButtonProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [showGymSelector, setShowGymSelector] = useState(false);
  const [showLocationGate, setShowLocationGate] = useState(false);
  const [pickedGymId, setPickedGymId] = useState<string | null>(null);
  const [gymName, setGymName] = useState('');
  const [gymLat, setGymLat] = useState<number | null>(null);
  const [gymLng, setGymLng] = useState<number | null>(null);

  const handleGymSelected = async (gymId: string) => {
    unlockAudio();
    setShowGymSelector(false);
    setPickedGymId(gymId);

    const { data: gymData } = await supabase
      .from('gyms')
      .select('name, latitude, longitude')
      .eq('id', gymId)
      .single();

    if (gymData?.latitude != null && gymData?.longitude != null) {
      setGymName(gymData.name || tr('training.gym_fallback'));
      setGymLat(gymData.latitude);
      setGymLng(gymData.longitude);
      setShowLocationGate(true);
    } else {
      navigate(`/training?start=true&gymId=${gymId}`);
    }
  };

  // „Nejsem v žádné z těchto posiloven" (feedback 13. 10.): uložit vybavení, posilovnu zrušit
  const handleNoGymSelected = async (equipment: string[]) => {
    unlockAudio();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from('user_profiles')
      .update({ selected_gym_id: null, custom_equipment: equipment })
      .eq('user_id', user.id);
    if (error) {
      console.error('[StartWorkoutButton] custom equipment not saved', error);
      toast.error(t('nogym.save_error'));
      return;
    }
    setShowGymSelector(false);
    navigate(`/training?start=true&nogym=${encodeURIComponent(equipment.join(','))}`);
  };

  return (
    <>
      {showGymSelector && createPortal(
        <GymSelector
          onSelect={handleGymSelected}
          onCancel={() => setShowGymSelector(false)}
          selectedGymId={selectedGymId}
          onSelectNoGym={handleNoGymSelected}
          customEquipment={customEquipment}
        />,
        document.body
      )}

      {showLocationGate && gymLat !== null && gymLng !== null && createPortal(
        <GymLocationGate
          gymLat={gymLat}
          gymLng={gymLng}
          gymName={gymName}
          onConfirmed={() => {
            setShowLocationGate(false);
            navigate(`/training?start=true&gymId=${pickedGymId}`);
          }}
          onCancel={() => setShowLocationGate(false)}
        />,
        document.body
      )}

      <motion.div
        className={className}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Button
          onClick={() => { prefetchGymLocation(); setShowGymSelector(true); }}
          size="lg"
          variant="gradient"
          className="w-full gap-3 h-14 text-base font-semibold rounded-2xl"
        >
          <Play className="w-5 h-5" />
          {t('home.start_workout')}
        </Button>
      </motion.div>
    </>
  );
};
