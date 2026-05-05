import { EQUIPMENT_OPTIONS } from '@/lib/onboardingTypes';
import { useTranslation } from 'react-i18next';

interface OnboardingEquipmentStepProps {
  value: string | null;
  onChange: (equipment: string) => void;
}

const OnboardingEquipmentStep = ({ value, onChange }: OnboardingEquipmentStepProps) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">{t('onboarding.equipment_title')}</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          {t('onboarding.equipment_subtitle')}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {EQUIPMENT_OPTIONS.map((eq) => (
          <button
            key={eq.id}
            onClick={() => onChange(eq.id)}
            className={`p-4 rounded-xl border-2 transition-all text-left ${
              value === eq.id
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card hover:border-primary/50'
            }`}
          >
            <span className="font-medium block">{t(`onboarding.equipment_${eq.id}`)}</span>
            <span className="text-sm text-muted-foreground">{t(`onboarding.equipment_${eq.id}_desc`)}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default OnboardingEquipmentStep;
