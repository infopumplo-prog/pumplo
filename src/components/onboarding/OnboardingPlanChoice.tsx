import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Sparkles, BadgeCheck, Wrench, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DAYS } from '@/lib/onboardingTypes';
import { PLAN_CHOICES, type PlanChoice } from '@/lib/onboardingFlow';
import { resolveSplit, type SplitType, type UserLevel } from '@/lib/trainingGoals';

interface OnboardingPlanChoiceProps {
  value: PlanChoice;
  onChange: (v: PlanChoice) => void;
  /** Pro „Co tě čeká“ u plánu od Pumplo. */
  level: UserLevel;
  trainingDays: string[];
  splitOverride: SplitType | null;
  /** Kolik tréninků od trenérů uvidí nový uživatel — 0 = volba se nenabídne. */
  trainerWorkouts: number;
  exercisesLabel: string | null;
}

const ICONS = { pumplo: Sparkles, trainer: BadgeCheck, own: Wrench } as const;

/**
 * Onboarding 2.0: samostatná obrazovka „Jak chceš začít?“ (David 8. 10.: shrnutí plánu nad volbou
 * bylo nepřehledné). U vybrané karty se rozbalí, co přesně ho po registraci čeká.
 */
const OnboardingPlanChoice = ({
  value, onChange, level, trainingDays, splitOverride, trainerWorkouts, exercisesLabel,
}: OnboardingPlanChoiceProps) => {
  const { t } = useTranslation();
  const split = resolveSplit(trainingDays.length, level, splitOverride);
  const dayNames = DAYS.filter((d) => trainingDays.includes(d.id)).map((d) => t(`onboarding.days_${d.id}`)).join(', ');

  const detail = (c: PlanChoice): string => {
    if (c === 'pumplo') {
      return t('onboarding.plan_choice_pumplo_next', { split: t(`onboarding.split_${split}`), times: trainingDays.length, days: dayNames });
    }
    if (c === 'trainer') return t('onboarding.plan_choice_trainer_next', { count: trainerWorkouts });
    return exercisesLabel
      ? t('onboarding.plan_choice_own_next', { n: exercisesLabel })
      : t('onboarding.plan_choice_own_next_nonumber');
  };

  return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">{t('onboarding.plan_choice_title')}</h2>
        <p className="text-sm text-muted-foreground">{t('onboarding.plan_choice_subtitle')}</p>
      </div>
      <div className="space-y-3">
        {PLAN_CHOICES.map((c) => {
          const Icon = ICONS[c];
          const active = value === c;
          const unavailable = c === 'trainer' && trainerWorkouts === 0;
          return (
            <button
              key={c}
              type="button"
              onClick={() => !unavailable && onChange(c)}
              disabled={unavailable}
              aria-pressed={active}
              className={cn(
                'w-full rounded-2xl border-2 p-4 text-left transition-all',
                unavailable ? 'opacity-50 border-border bg-card cursor-not-allowed' : 'active:scale-[0.98]',
                active ? 'border-primary bg-primary/10' : !unavailable && 'border-border bg-card',
              )}
            >
              <span className="flex items-center gap-3">
                <span className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', active ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary')}>
                  <Icon className="w-5 h-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold">{t(`onboarding.plan_choice_${c}`)}</span>
                    {c === 'pumplo' && (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">
                        {t('onboarding.plan_choice_recommended')}
                      </span>
                    )}
                    {unavailable && (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {t('onboarding.plan_choice_soon')}
                      </span>
                    )}
                  </span>
                  <span className="block text-sm text-muted-foreground mt-0.5">{t(`onboarding.plan_choice_${c}_desc`)}</span>
                </span>
                {active && <Check className="w-5 h-5 text-primary shrink-0" strokeWidth={3} aria-hidden="true" />}
              </span>
              <AnimatePresence initial={false}>
                {active && (
                  <motion.span
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="block overflow-hidden"
                  >
                    <span className="block mt-3 pt-3 border-t border-primary/20 text-sm">
                      <span className="block text-xs font-semibold text-primary mb-1">{t('onboarding.plan_choice_next_label')}</span>
                      {detail(c)}
                    </span>
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default OnboardingPlanChoice;
