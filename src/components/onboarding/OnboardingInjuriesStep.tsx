import { INJURIES_LIST } from '@/lib/onboardingTypes';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface OnboardingInjuriesStepProps {
  value: string[];
  onChange: (injuries: string[]) => void;
}

const OnboardingInjuriesStep = ({ value, onChange }: OnboardingInjuriesStepProps) => {
  const { t } = useTranslation();

  const handleInjuryToggle = (injuryId: string) => {
    if (injuryId === 'none') {
      onChange(value.includes('none') ? [] : ['none']);
    } else {
      const newInjuries = value.filter(i => i !== 'none');
      if (newInjuries.includes(injuryId)) {
        onChange(newInjuries.filter(i => i !== injuryId));
      } else {
        onChange([...newInjuries, injuryId]);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">{t('onboarding.injuries_title')}</h2>
        <p className="text-muted-foreground mt-2 text-sm">{t('onboarding.injuries_subtitle')}</p>
      </div>
      {/* „Nemám zranění“ jako první a výrazná volba — většina lidí žádné nemá (feedback 13. 10.) */}
      <button
        onClick={() => handleInjuryToggle('none')}
        className={`w-full p-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
          value.includes('none')
            ? 'border-green-500 bg-green-500/15 text-green-600 dark:text-green-400'
            : 'border-border bg-card hover:border-green-500/50'
        }`}
      >
        <Check className="w-5 h-5" />
        <span className="font-semibold">{t('onboarding.injury_none')}</span>
      </button>
      <p className="text-xs text-muted-foreground text-center -mt-2">{t('onboarding.injuries_or_pick')}</p>
      <div className="grid grid-cols-2 gap-2">
        {INJURIES_LIST.filter((injury) => injury.id !== 'none').map((injury) => (
          <button
            key={injury.id}
            onClick={() => handleInjuryToggle(injury.id)}
            className={`p-3 rounded-xl border-2 transition-all ${
              value.includes(injury.id)
                ? injury.id === 'none'
                  ? 'border-green-500 bg-green-500/10'
                  : 'border-destructive bg-destructive/10'
                : 'border-border bg-card hover:border-primary/50'
            }`}
          >
            <span className="font-medium text-sm">{t(`onboarding.injury_${injury.id}`)}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default OnboardingInjuriesStep;
