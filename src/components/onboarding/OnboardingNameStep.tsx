import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import PumploLogo from '@/components/PumploLogo';
import AccentPicker from '@/components/AccentPicker';
import { useTheme } from '@/contexts/ThemeContext';

interface OnboardingNameStepProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}

/**
 * Onboarding 2.0: jméno hned na začátku (používají ho reakce trenéra) a rovnou i barva appky
 * (David 8. 10.) — celý dotazník už běží v jejich barvě. Změnit jde kdykoli v Nastavení.
 */
const OnboardingNameStep = ({ value, onChange, onSubmit }: OnboardingNameStepProps) => {
  const { t } = useTranslation();
  const { accent, setAccent } = useTheme();
  return (
    <div className="space-y-6">
      {/* Logo v barvě appky — při výběru barvy níž se přebarví (David 8. 10.) */}
      <PumploLogo className="h-12 mx-auto" />
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">{t('onboarding.name_title')}</h2>
        <p className="text-sm text-muted-foreground">{t('onboarding.name_subtitle')}</p>
      </div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 40))}
        onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); }}
        placeholder={t('onboarding.name_placeholder')}
        autoComplete="given-name"
        autoCapitalize="words"
        enterKeyHint="next"
        className="h-14 text-lg text-center rounded-2xl"
      />
      <div className="space-y-3 pt-2">
        <div className="text-center">
          <p className="text-sm font-semibold">{t('accent.onboarding_title')}</p>
          <p className="text-xs text-muted-foreground">{t('accent.onboarding_subtitle')}</p>
        </div>
        <AccentPicker compact value={accent} onChange={setAccent} />
      </div>
    </div>
  );
};

export default OnboardingNameStep;
