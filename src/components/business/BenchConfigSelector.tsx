import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useTranslation, TFunction } from 'react-i18next';

export const getBenchConfigs = (t: TFunction) => [
  { value: 'flat', label: t('business.bench_config_flat') },
  { value: 'incline', label: t('business.bench_config_incline') },
  { value: 'decline', label: t('business.bench_config_decline') },
] as const;

export const BENCH_CONFIG_VALUES = ['flat', 'incline', 'decline'] as const;
export type BenchConfig = typeof BENCH_CONFIG_VALUES[number];

interface BenchConfigSelectorProps {
  selectedConfigs: string[];
  onChange: (configs: string[]) => void;
}

export const BenchConfigSelector = ({ selectedConfigs, onChange }: BenchConfigSelectorProps) => {
  const { t } = useTranslation();
  const BENCH_CONFIGS = getBenchConfigs(t);

  const toggleConfig = (config: string) => {
    if (selectedConfigs.includes(config)) {
      onChange(selectedConfigs.filter(c => c !== config));
    } else {
      onChange([...selectedConfigs, config]);
    }
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">{t('business.bench_config_title')}</Label>
      <div className="space-y-2">
        {BENCH_CONFIGS.map((config) => (
          <div key={config.value} className="flex items-center space-x-3">
            <Checkbox
              id={`bench-config-${config.value}`}
              checked={selectedConfigs.includes(config.value)}
              onCheckedChange={() => toggleConfig(config.value)}
            />
            <Label
              htmlFor={`bench-config-${config.value}`}
              className="text-sm font-normal cursor-pointer"
            >
              {config.label}
            </Label>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {t('business.bench_config_desc')}
      </p>
    </div>
  );
};
