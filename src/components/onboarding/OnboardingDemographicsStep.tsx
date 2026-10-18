import { Input } from '@/components/ui/input';
import { Check } from 'lucide-react';
import { GENDER_ICONS, IconBadge } from '@/components/icons/appIcons';
import { useTranslation } from 'react-i18next';

interface OnboardingDemographicsStepProps {
  firstName: string;
  lastName: string;
  gender: string | null;
  age: string;
  height: string;
  weight: string;
  onFirstNameChange: (v: string) => void;
  /** Zobrazit pole jména — jen v editaci profilu (při registraci se sbírá jinde). */
  showName?: boolean;
  onLastNameChange: (v: string) => void;
  onGenderChange: (gender: string) => void;
  onAgeChange: (age: string) => void;
  onHeightChange: (height: string) => void;
  onWeightChange: (weight: string) => void;
}

const OnboardingDemographicsStep = ({
  firstName,
  lastName,
  gender,
  age,
  height,
  weight,
  onFirstNameChange,
  showName = false,
  onLastNameChange,
  onGenderChange,
  onAgeChange,
  onHeightChange,
  onWeightChange,
}: OnboardingDemographicsStepProps) => {
  const { t } = useTranslation();

  // Vyplněné vs. nevyplněné muselo jít poznat na první pohled (feedback 13. 10.):
  // vzorová hodnota jako „např. 25“, vyplněné pole s barevným rámečkem.
  const filledClass = (v: string) =>
    `text-lg placeholder:text-muted-foreground/50 placeholder:italic ${v ? 'border-primary border-2 font-semibold' : ''}`;

  const genders = [
    { id: 'muž', label: t('onboarding.male') },
    { id: 'žena', label: t('onboarding.female') },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-center">{t('onboarding.demographics_title')}</h2>

      {/* Jméno se sbírá při registraci; v editaci profilu (dotazník z Profilu) ho
          ale musí jít změnit — dřív nikde nešlo (nález 12. 9.). */}
      {showName && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="block text-sm font-medium">{t('onboarding.first_name_label')}</label>
            <Input value={firstName} onChange={(e) => onFirstNameChange(e.target.value)} placeholder={t('onboarding.first_name_ph')} autoComplete="given-name" />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium">{t('onboarding.last_name_label')}</label>
            <Input value={lastName} onChange={(e) => onLastNameChange(e.target.value)} placeholder={t('onboarding.last_name_ph')} autoComplete="family-name" />
          </div>
        </div>
      )}

      {/* Gender Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">{t('onboarding.gender')}</label>
        <div className="grid grid-cols-2 gap-4">
          {genders.map((g) => (
            <button
              key={g.id}
              onClick={() => onGenderChange(g.id)}
              className={`p-4 rounded-xl border-2 transition-all ${
                gender === g.id
                  ? 'border-primary bg-primary/20 ring-2 ring-primary/40 shadow-primary'
                  : 'border-border bg-card opacity-80 hover:border-primary/50'
              } relative`}
            >
              <span className="flex justify-center mb-2"><IconBadge icon={GENDER_ICONS[g.id]} active={gender === g.id} /></span>
              <span className="font-medium">{g.label}</span>
              {gender === g.id && (
                <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center">
                  <Check className="w-3.5 h-3.5" />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">{t('onboarding.age_label')}</label>
          <Input
            type="number"
            value={age}
            onChange={(e) => onAgeChange(e.target.value)}
            placeholder={t('onboarding.example_value', { value: 25 })}
            className={filledClass(age)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">{t('onboarding.height_label')}</label>
          <Input
            type="number"
            value={height}
            onChange={(e) => onHeightChange(e.target.value)}
            placeholder={t('onboarding.example_value', { value: 175 })}
            className={filledClass(height)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">{t('onboarding.weight_label')}</label>
          <Input
            type="number"
            value={weight}
            onChange={(e) => onWeightChange(e.target.value)}
            placeholder={t('onboarding.example_value', { value: 75 })}
            className={filledClass(weight)}
          />
        </div>
      </div>
    </div>
  );
};

export default OnboardingDemographicsStep;
