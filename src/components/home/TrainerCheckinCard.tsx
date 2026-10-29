import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTrainerCheckins } from '@/hooks/useTrainerCheckins';
import type { MyTrainer } from '@/lib/trainerClient';
import TrainerCheckinSheet from '@/components/trainer/TrainerCheckinSheet';

// Home: od dne check-inu (nastaví trenér) do neděle, dokud klient check-in neodešle.
// Bez trenéra / bez nastaveného check-inu / bez migrace se nic nevykreslí.
const TrainerCheckinCard = () => {
  const { t } = useTranslation();
  const { due } = useTrainerCheckins();
  const [active, setActive] = useState<MyTrainer | null>(null);

  if (due.length === 0 && !active) return null;

  return (
    <>
      {due.map((trainer) => (
        <div key={trainer.link_id} className="rounded-2xl border border-primary/30 bg-primary/5 p-4" data-testid="trainer-checkin-card">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <ClipboardCheck className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground">{t('trainer_client.ci_card_title', { name: trainer.trainer_name })}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t('trainer_client.ci_card_desc')}</p>
            </div>
          </div>
          <Button size="sm" className="w-full mt-3 rounded-xl min-h-[44px]" onClick={() => setActive(trainer)}>
            {t('trainer_client.ci_card_cta')}
          </Button>
        </div>
      ))}
      <TrainerCheckinSheet trainer={active} open={!!active} onClose={() => setActive(null)} />
    </>
  );
};

export default TrainerCheckinCard;
