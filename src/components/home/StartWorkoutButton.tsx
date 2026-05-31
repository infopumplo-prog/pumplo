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
import { supabase } from '@/integrations/supabase/client';

interface StartWorkoutButtonProps {
  selectedGymId: string | null;
  className?: string;
}

export const StartWorkoutButton = ({ selectedGymId, className }: StartWorkoutButtonProps) => {
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
      setGymName(gymData.name || 'Posilovna');
      setGymLat(gymData.latitude);
      setGymLng(gymData.longitude);
      setShowLocationGate(true);
    } else {
      navigate(`/training?start=true&gymId=${gymId}`);
    }
  };

  return (
    <>
      {showGymSelector && createPortal(
        <GymSelector
          onSelect={handleGymSelected}
          onCancel={() => setShowGymSelector(false)}
          selectedGymId={selectedGymId}
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
          onClick={() => setShowGymSelector(true)}
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
