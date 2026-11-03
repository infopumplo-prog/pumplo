import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import { IconBadge } from '@/components/icons/appIcons';
import { cn } from '@/lib/utils';
import { FREE_TEXT_MAX, clampFreeText } from '@/lib/onboardingFlow';

export interface ChoiceOption {
  id: string;
  icon: LucideIcon;
  label: string;
}

interface OnboardingChoiceStepProps {
  title: string;
  subtitle: string;
  options: ChoiceOption[];
  value: string[];
  onChange: (next: string[]) => void;
  freeText: string;
  onFreeTextChange: (v: string) => void;
  freeTextLabel: string;
  freeTextPlaceholder: string;
}

/**
 * Onboarding 2.0: výběr více možností + volitelná volná odpověď
 * (motivace, očekávání od appky). Volné odpovědi se ukládají do onboarding_answers.
 */
const OnboardingChoiceStep = ({
  title, subtitle, options, value, onChange, freeText, onFreeTextChange, freeTextLabel, freeTextPlaceholder,
}: OnboardingChoiceStepProps) => {
  const { t } = useTranslation();
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {options.map((o) => {
          const active = value.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => toggle(o.id)}
              aria-pressed={active}
              className={cn(
                'rounded-2xl border-2 p-3 text-left transition-all active:scale-[0.97] min-h-[84px] flex flex-col gap-1.5',
                active ? 'border-primary bg-primary/10' : 'border-border bg-card',
              )}
            >
              <IconBadge icon={o.icon} active={active} size="sm" />
              <span className="text-sm font-semibold leading-tight">{o.label}</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="onboarding-free-text">
          {freeTextLabel} <span className="text-muted-foreground font-normal">({t('onboarding.optional')})</span>
        </label>
        <textarea
          id="onboarding-free-text"
          value={freeText}
          onChange={(e) => onFreeTextChange(clampFreeText(e.target.value))}
          rows={2}
          placeholder={freeTextPlaceholder}
          className="w-full bg-muted rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none"
        />
        {freeText.length > FREE_TEXT_MAX - 50 && (
          <p className="text-[11px] text-muted-foreground text-right">{freeText.length}/{FREE_TEXT_MAX}</p>
        )}
      </div>
    </div>
  );
};

export default OnboardingChoiceStep;
