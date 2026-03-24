import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
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

// Static trainers data - will be moved to DB later
const STATIC_TRAINERS: Record<string, Trainer[]> = {
  // Default trainers for any gym (Eurogym)
  default: [
    {
      id: 'jarmila-valentova',
      name: 'Jarmila Valentová',
      photo: 'https://udqwjqgdsjobdufdxbpn.supabase.co/storage/v1/object/public/gym-assets/39684b2f-9e5a-484b-bf84-d30eae18691c/trainers/jarmila-valentova.jpg',
      bio: 'Mám dlouholeté zkušenosti ve fitness světě i mimo něj. Aktivně se věnuji cyklistice a turistice. Kromě silového tréninku se zaměřuji i na kondiční trénink, takže tě dokážu skvěle podpořit i v jiných fyzických aktivitách, kterým se věnuješ.',
      specializations: [
        'Redukce tuku – pomohu ti shodit přebytečná kila zdravou a udržitelnou cestou.',
        'Nabírání svalové hmoty – sestavím ti tréninkový plán pro budování silného a funkčního těla.',
        'Jídelníček – napíšu ti jídelníček na míru pro redukci, nabírání svalové hmoty nebo udržování.',
        'Zlepšení fyzické kondice – zvýšíme tvoji vytrvalost i sílu tak, aby sis užil/a nejen trénink, ale i běh, kolo, turistiku nebo jakoukoli jinou aktivitu.',
      ],
      certifications: [
        {
          name: 'Osobní trenérka ve fitness',
          description: 'Certifikace od Ronnie.cz',
          date: '2024',
        },
      ],
      pricing: [
        { name: 'Individuální trénink (60 min)', price: 500 },
        { name: 'Tréninkový plán na míru', price: 1500 },
        { name: 'Jídelníček na míru', price: 1200 },
        { name: 'Balíček 10 tréninků', price: 4500 },
      ],
      contact: {
        phone: '+420 735 831 247',
        email: 'trenerkajarmila@seznam.cz',
        facebook: 'Facebook',
        instagram: 'Instagram',
      },
    },
  ],
};

interface GymTrainersTabProps {
  gymId?: string;
}

const GymTrainersTab = ({ gymId }: GymTrainersTabProps) => {
  const [selectedTrainer, setSelectedTrainer] = useState<Trainer | null>(null);

  // Get trainers for this gym (fallback to default)
  const trainers = (gymId && STATIC_TRAINERS[gymId]) || STATIC_TRAINERS.default;

  if (!trainers || trainers.length === 0) {
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
