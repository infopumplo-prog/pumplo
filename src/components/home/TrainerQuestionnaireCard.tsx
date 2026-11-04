import { ClipboardList, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { QuestionnaireCardPlacement } from '@/lib/trainerClientOnboarding';

interface TrainerQuestionnaireCardProps {
  placement: QuestionnaireCardPlacement;
  onStart: () => void;
  /** „Teď ne“ — jen u nenápadné karty pod plány od trenéra. */
  onDismiss?: () => void;
}

// Klient trenéra bez dotazníku (26. 10. 2026): nabídka vlastního Pumplo plánu, nikdy neblokuje.
const TrainerQuestionnaireCard = ({ placement, onStart, onDismiss }: TrainerQuestionnaireCardProps) => {
  const { t } = useTranslation();

  if (placement === 'custom_tab') {
    return (
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4" data-testid="trainer-questionnaire-card">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground">{t('trainer_client.qcard_title')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t('trainer_client.qcard_desc')}</p>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          {onDismiss && (
            <Button variant="ghost" size="sm" className="flex-1 rounded-xl" onClick={onDismiss}>
              {t('trainer_client.qcard_later')}
            </Button>
          )}
          <Button size="sm" className="flex-1 rounded-xl" onClick={onStart}>
            {t('trainer_client.qcard_cta')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-accent/20 via-primary/10 to-transparent border border-primary/20 p-6" data-testid="trainer-questionnaire-card">
      <div className="absolute -right-8 -top-8 w-32 h-32 bg-primary/20 rounded-full blur-3xl" />
      <div className="relative">
        <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mb-4">
          <ClipboardList className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2">{t('trainer_client.qcard_title')}</h3>
        <p className="text-muted-foreground mb-6">{t('trainer_client.qcard_pumplo_tab_desc')}</p>
        <Button onClick={onStart} size="lg" className="gap-2 rounded-xl">
          <Sparkles className="w-5 h-5" />
          {t('trainer_client.qcard_cta')}
        </Button>
      </div>
    </div>
  );
};

export default TrainerQuestionnaireCard;
