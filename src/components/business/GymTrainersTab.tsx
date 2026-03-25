import { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import TrainerDetailDrawer from './TrainerDetailDrawer';

export interface Trainer {
  id: string;
  name: string;
  photo: string;
  bio: string;
  specializations: string[];
  certifications: { name: string; description: string; date: string }[];
  pricing: { name: string; price: number }[];
  contact: {
    phone?: string;
    email?: string;
    facebook?: string;
    instagram?: string;
  };
}

interface GymTrainersTabProps {
  gymId?: string;
}

const GymTrainersTab = ({ gymId }: GymTrainersTabProps) => {
  const [selectedTrainer, setSelectedTrainer] = useState<Trainer | null>(null);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!gymId) {
      setTrainers([]);
      setIsLoading(false);
      return;
    }

    const fetchTrainers = async () => {
      const { data } = await supabase
        .from('gym_trainers')
        .select('*')
        .eq('gym_id', gymId)
        .eq('is_active', true)
        .order('sort_order');

      if (data && data.length > 0) {
        setTrainers(data.map(t => ({
          id: t.id,
          name: t.name,
          photo: t.photo_url || '',
          bio: t.bio || '',
          specializations: t.specializations || [],
          certifications: (t.certifications as any[]) || [],
          pricing: (t.pricing as any[]) || [],
          contact: (t.contact as any) || {},
        })));
      } else {
        setTrainers([]);
      }
      setIsLoading(false);
    };

    fetchTrainers();
  }, [gymId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (trainers.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        Žádní trenéři nejsou uvedeni
      </div>
    );
  }

  return (
    <>
      <div className="space-y-1">
        {trainers.map((trainer) => (
          <button
            key={trainer.id}
            onClick={() => setSelectedTrainer(trainer)}
            className="flex items-center justify-between w-full py-3 px-3 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              {trainer.photo ? (
                <img
                  src={trainer.photo}
                  alt={trainer.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                  {trainer.name.split(' ').map(n => n[0]).join('')}
                </div>
              )}
              <span className="font-medium text-sm">{trainer.name}</span>
            </div>
            <div className="flex items-center gap-1 text-primary text-sm">
              <span>Detail</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        ))}
      </div>

      <TrainerDetailDrawer
        trainer={selectedTrainer}
        open={!!selectedTrainer}
        onOpenChange={(open) => !open && setSelectedTrainer(null)}
      />
    </>
  );
};

export default GymTrainersTab;
