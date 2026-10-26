import { useTranslation } from 'react-i18next';
import { Heart, MessageSquareText } from 'lucide-react';
import { DIFFICULTY_LABEL_KEYS, isValidDifficulty } from '@/lib/trainerClient';

// Pod kartou tréninku v historii: srdíčko od trenéra + vlastní hodnocení po tréninku.
export const SessionTrainerFeedback = ({
  heart,
  difficulty,
  note,
}: {
  heart: boolean;
  difficulty: number | null;
  note: string | null;
}) => {
  const { t } = useTranslation();
  const hasDifficulty = isValidDifficulty(difficulty);
  const trimmedNote = note?.trim() || null;
  if (!heart && !hasDifficulty && !trimmedNote) return null;
  return (
    <div className="mt-1.5 px-3 py-2.5 rounded-xl bg-muted/50 space-y-1.5 text-sm">
      {heart && (
        <p className="flex items-center gap-1.5 font-medium text-rose-500 dark:text-rose-400">
          <Heart className="w-4 h-4 shrink-0" fill="currentColor" aria-hidden />
          {t('trainer_client.heart_from_trainer')}
        </p>
      )}
      {hasDifficulty && (
        <p className="text-muted-foreground">
          {t('trainer_client.your_rating', { label: `${difficulty}/5 · ${t(DIFFICULTY_LABEL_KEYS[difficulty])}` })}
        </p>
      )}
      {trimmedNote && (
        <div className="flex items-start gap-1.5 text-muted-foreground">
          <MessageSquareText className="w-4 h-4 shrink-0 mt-0.5" aria-label={t('trainer_client.your_note')} />
          <p className="whitespace-pre-line break-words min-w-0">{trimmedNote}</p>
        </div>
      )}
    </div>
  );
};

export default SessionTrainerFeedback;
