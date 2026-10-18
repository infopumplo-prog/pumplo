import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';

// Karta „Tvůj první trénink“ nahoře na Home pro lidi bez dokončeného tréninku
// (David 18. 10.). Tlačítko Začít je vložený StartWorkoutButton z Home — stejný
// tok s výběrem posilovny i volbou bez posilovny, žádná kopie logiky.

interface FirstWorkoutCardProps {
  workoutName: string;
  minutes: number | null;
  /** StartWorkoutButton z Home (sdílený start tréninku). */
  startButton: ReactNode;
  onDismiss: () => void;
}

export const FirstWorkoutCard = ({ workoutName, minutes, startButton, onDismiss }: FirstWorkoutCardProps) => {
  const { t } = useTranslation();
  return (
    <div
      data-testid="first-workout-card"
      className="relative overflow-hidden rounded-3xl p-6 text-white shadow-lg shadow-primary/25"
      style={{ background: 'var(--gradient-primary)' }}
    >
      <div className="absolute -right-10 -top-10 w-36 h-36 bg-white/15 rounded-full blur-2xl pointer-events-none" />
      <div className="relative">
        <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-4">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-2xl font-bold leading-tight">{t('home.first_workout_title')}</h2>
        <p className="mt-2 text-white/85 text-sm leading-relaxed">
          {minutes
            ? t('home.first_workout_subtitle', { workout: workoutName, minutes })
            : t('home.first_workout_subtitle_no_time', { workout: workoutName })}
        </p>
        <div className="mt-5 [&_button]:![background:white] [&_button]:!text-primary [&_button]:h-16 [&_button]:text-lg [&_button]:font-bold [&_button]:shadow-lg">
          {startButton}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-2 w-full min-h-[44px] text-sm font-medium text-white/85 active:opacity-70"
        >
          {t('home.first_workout_later')}
        </button>
      </div>
    </div>
  );
};
