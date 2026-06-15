import { Input } from '@/components/ui/input';
import { useTranslation } from 'react-i18next';

interface OnboardingDemographicsStepProps {
  firstName: string;
  lastName: string;
  gender: string | null;
  age: string;
  height: string;
  weight: string;
  onFirstNameChange: (v: string) => void;
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
  onLastNameChange,
  onGenderChange,
  onAgeChange,
  onHeightChange,
  onWeightChange,
}: OnboardingDemographicsStepProps) => {
  const { t } = useTranslation();

  const genders = [
    { id: 'muž', label: t('onboarding.male'), emoji: '👨' },
    { id: 'žena', label: t('onboarding.female'), emoji: '👩' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-center">{t('onboarding.demographics_title')}</h2>

      {/* Name is collected at account creation (required there) — not here. */}

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
                  ? 'border-primary bg-primary/10 shadow-primary'
                  : 'border-border bg-card hover:border-primary/50'
              }`}
            >
              <span className="text-2xl block mb-1">{g.emoji}</span>
              <span className="font-medium">{g.label}</span>
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
            placeholder="25"
            className="text-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">{t('onboarding.height_label')}</label>
          <Input
            type="number"
            value={height}
            onChange={(e) => onHeightChange(e.target.value)}
            placeholder="175"
            className="text-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">{t('onboarding.weight_label')}</label>
          <Input
            type="number"
            value={weight}
            onChange={(e) => onWeightChange(e.target.value)}
            placeholder="75"
            className="text-lg"
          />
        </div>
      </div>
    </div>
  );
};

export default OnboardingDemographicsStep;
