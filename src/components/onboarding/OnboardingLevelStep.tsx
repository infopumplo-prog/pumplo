import { UserLevel } from '@/lib/trainingGoals';
import { IconBadge, LEVEL_ICONS } from '@/components/icons/appIcons';
import { USER_LEVEL_OPTIONS } from '@/lib/onboardingTypes';
import { useTranslation } from 'react-i18next';

interface OnboardingLevelStepProps {
  value: UserLevel | null;
  onChange: (level: UserLevel) => void;
}

const OnboardingLevelStep = ({ value, onChange }: OnboardingLevelStepProps) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">{t('onboarding.level_title')}</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          {t('onboarding.level_subtitle')}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {USER_LEVEL_OPTIONS.map((level) => (
          <button
            key={level.id}
            onClick={() => onChange(level.id)}
            className={`p-4 rounded-xl border-2 transition-all text-left flex items-center gap-4 ${
              value === level.id
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card hover:border-primary/50'
            }`}
          >
            <IconBadge icon={LEVEL_ICONS[level.id]} active={value === level.id} size="lg" />
            <div>
              <span className="font-medium block">{t(`onboarding.level_${level.id}`)}</span>
              <span className="text-sm text-muted-foreground">{t(`onboarding.level_${level.id}_desc`)}</span>
            </div>
          </button>
        ))}
      </div>
      {/* Lidé nevěděli, kam se zařadit (sportuje, ale do fitka nechodí) — feedback 13. 10. */}
      <p className="text-xs text-muted-foreground text-center px-2">{t('onboarding.level_help')}</p>
    </div>
  );
};

export default OnboardingLevelStep;
