import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export const BENCH_CONFIGS = [
  { value: 'flat', label: 'Flat (rovná)' },
  { value: 'incline', label: 'Incline (šikmá nahoru)' },
  { value: 'decline', label: 'Decline (šikmá dolů)' },
] as const;

export type BenchConfig = typeof BENCH_CONFIGS[number]['value'];

interface BenchConfigSelectorProps {
  selectedConfigs: string[];
  onChange: (configs: string[]) => void;
}

export const BenchConfigSelector = ({ selectedConfigs, onChange }: BenchConfigSelectorProps) => {
  const toggleConfig = (config: string) => {
    if (selectedConfigs.includes(config)) {
      onChange(selectedConfigs.filter(c => c !== config));
    } else {
      onChange([...selectedConfigs, config]);
    }
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Konfigurace lavice</Label>
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
        Vyberte, které konfigurace váš bench press podporuje
      </p>
    </div>
  );
};
