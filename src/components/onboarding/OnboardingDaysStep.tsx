import { DAYS } from '@/lib/onboardingTypes';
import { useTranslation } from 'react-i18next';
import { SPLIT_INFO, SplitType, UserLevel, getSplitFromFrequency } from '@/lib/trainingGoals';

interface OnboardingDaysStepProps {
  value: string[];
  onChange: (days: string[]) => void;
  /** Ruční volba splitu; null = automatika podle frekvence. */
  splitOverride?: SplitType | null;
  onSplitOverrideChange?: (split: SplitType | null) => void;
  userLevel?: UserLevel | null;
}

const SPLIT_CHOICES: (SplitType | null)[] = [null, 'full_body', 'upper_lower', 'ppl'];

const OnboardingDaysStep = ({ value, onChange, splitOverride = null, onSplitOverrideChange, userLevel }: OnboardingDaysStepProps) => {
  const { t } = useTranslation();
  const autoSplit = getSplitFromFrequency(value.length > 0 ? value.length : 3, userLevel ?? 'beginner');

  const handleDayToggle = (dayId: string) => {
    if (value.includes(dayId)) {
      onChange(value.filter(d => d !== dayId));
    } else {
      onChange([...value, dayId]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-bold">{t('onboarding.days_title')}</h2>
        <p className="text-sm text-muted-foreground">{t('onboarding.days_subtitle')}</p>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {DAYS.map((day) => (
          <button
            key={day.id}
            onClick={() => handleDayToggle(day.id)}
            className={`p-4 rounded-xl border-2 transition-all ${
              value.includes(day.id)
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card hover:border-primary/50'
            }`}
          >
            <span className="font-medium">{t(`myplan.day_${day.id}`)}</span>
          </button>
        ))}
      </div>
      {onSplitOverrideChange && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-center">{t('onboarding.split_title')}</p>
          <div className="grid grid-cols-2 gap-2">
            {SPLIT_CHOICES.map((choice) => {
              const active = splitOverride === choice;
              const label = choice === null
                ? t('onboarding.split_auto', { split: SPLIT_INFO[autoSplit].labelCz })
                : SPLIT_INFO[choice].labelCz;
              const sub = choice === null
                ? t('onboarding.split_auto_hint')
                : t('onboarding.split_days_count', { n: SPLIT_INFO[choice].days.length });
              return (
                <button
                  key={choice ?? 'auto'}
                  onClick={() => onSplitOverrideChange(choice)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    active ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/50'
                  }`}
                >
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-xs text-muted-foreground">{sub}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default OnboardingDaysStep;
