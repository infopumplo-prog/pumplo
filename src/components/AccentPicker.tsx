import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { ACCENT_COLORS, ACCENT_SWATCH, type AccentColor } from '@/lib/accentColors';

interface AccentPickerProps {
  value: AccentColor;
  onChange: (accent: AccentColor) => void;
  className?: string;
  /** Jen řada koleček (dotazník u jména), název vybrané barvy pod nimi. */
  compact?: boolean;
}

/** Výběr barvy appky — dotazník i Nastavení (fáze 2 Onboarding 2.0). */
const AccentPicker = ({ value, onChange, className, compact = false }: AccentPickerProps) => {
  const { t } = useTranslation();
  if (compact) {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex justify-between gap-2" role="radiogroup" aria-label={t('accent.title')}>
          {ACCENT_COLORS.map((c) => {
            const active = value === c;
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={t(`accent.${c}`)}
                onClick={() => onChange(c)}
                className={cn(
                  'w-11 h-11 rounded-full flex items-center justify-center transition-transform active:scale-90',
                  active ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground/60 scale-105' : '',
                )}
                style={{ background: `hsl(${ACCENT_SWATCH[c].light})` }}
              >
                {active && <Check className="w-5 h-5 text-white" strokeWidth={3} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-center text-muted-foreground">{t(`accent.${value}`)}</p>
      </div>
    );
  }
  return (
    <div className={cn('grid grid-cols-3 gap-3', className)} role="radiogroup" aria-label={t('accent.title')}>
      {ACCENT_COLORS.map((c) => {
        const active = value === c;
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(c)}
            className={cn(
              'flex flex-col items-center gap-2 rounded-2xl border-2 py-3 transition-all active:scale-[0.97]',
              active ? 'border-foreground/70 bg-muted/60' : 'border-border bg-card',
            )}
          >
            <span
              className="w-10 h-10 rounded-full flex items-center justify-center shadow-sm"
              style={{ background: `hsl(${ACCENT_SWATCH[c].light})` }}
            >
              {active && <Check className="w-5 h-5 text-white" strokeWidth={3} aria-hidden="true" />}
            </span>
            <span className="text-xs font-semibold">{t(`accent.${c}`)}</span>
          </button>
        );
      })}
    </div>
  );
};

export default AccentPicker;
