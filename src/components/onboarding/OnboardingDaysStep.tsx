import { DAYS } from '@/lib/onboardingTypes';
import { useTranslation } from 'react-i18next';

interface OnboardingDaysStepProps {
  value: string[];
  onChange: (days: string[]) => void;
}

const OnboardingDaysStep = ({ value, onChange }: OnboardingDaysStepProps) => {
  const { t } = useTranslation();

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
    </div>
  );
};

export default OnboardingDaysStep;
