import { useTranslation } from 'react-i18next';
import { UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';

// Štítek „Od trenéra {jméno}“ u plánu, který klientovi přiřadil trenér.
export const TrainerPlanBadge = ({
  trainerName,
  variant = 'default',
  className,
}: {
  trainerName: string | null;
  variant?: 'default' | 'hero';
  className?: string;
}) => {
  const { t } = useTranslation();
  const label = trainerName
    ? t('trainer_client.badge_from_trainer', { name: trainerName })
    : t('trainer_client.badge_from_trainer_noname');
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold max-w-full',
        variant === 'hero' ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary',
        className,
      )}
    >
      <UserRound className="w-3 h-3 shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
};

export default TrainerPlanBadge;
