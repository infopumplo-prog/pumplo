import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Check, Dumbbell, Video } from 'lucide-react';
import davidPhoto from '@/assets/david-benisek.png';
import { GOAL_ICONS, IconBadge, LEVEL_ICONS } from '@/components/icons/appIcons';
import { DAYS } from '@/lib/onboardingTypes';
import { PLAN_DURATION_WEEKS, type TrainingGoalId, type UserLevel } from '@/lib/trainingGoals';
import { floorPlus, sharePercent, type SocialProof } from '@/lib/socialProof';

export type ProofVariant = 'goal' | 'level' | 'plan';

interface OnboardingProofStepProps {
  variant: ProofVariant;
  goal: TrainingGoalId | null;
  level: UserLevel | null;
  trainingDays: string[];
  durationMinutes: number;
  proof: SocialProof | null;
}

const RING_R = 52;
const RING_C = 2 * Math.PI * RING_R;

/** Kruhový graf podílu v barvě appky (animovaný). */
const ShareRing = ({ percent }: { percent: number }) => (
  <div className="relative w-40 h-40 mx-auto">
    <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90" aria-hidden="true">
      <circle cx="60" cy="60" r={RING_R} fill="none" stroke="hsl(var(--primary) / 0.15)" strokeWidth="12" />
      <motion.circle
        cx="60" cy="60" r={RING_R} fill="none" stroke="hsl(var(--primary))" strokeWidth="12" strokeLinecap="round"
        strokeDasharray={RING_C}
        initial={{ strokeDashoffset: RING_C }}
        animate={{ strokeDashoffset: RING_C * (1 - percent / 100) }}
        transition={{ duration: 1.1, ease: 'easeOut', delay: 0.15 }}
      />
    </svg>
    <div className="absolute inset-0 flex items-center justify-center">
      <span className="text-4xl font-black text-primary tabular-nums">{percent} %</span>
    </div>
  </div>
);

const Bullet = ({ children }: { children: React.ReactNode }) => (
  <li className="flex items-start gap-3 text-sm">
    <span className="w-6 h-6 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0 mt-0.5">
      <Check className="w-3.5 h-3.5" strokeWidth={3} aria-hidden="true" />
    </span>
    <span>{children}</span>
  </li>
);

/**
 * Onboarding 2.0: grafiky mezi kroky, které zvedají důvěru — podle toho, co člověk zvolil.
 * Jen skutečná čísla z databáze, zaokrouhlená dolů (viz lib/socialProof). Bez čísel (offline,
 * funkce ještě není nasazená) se ukáže varianta bez čísel, nikdy vymyšlené číslo.
 */
const OnboardingProofStep = ({ variant, goal, level, trainingDays, durationMinutes, proof }: OnboardingProofStepProps) => {
  const { t } = useTranslation();
  const exercises = proof && proof.exercisesWithVideo > 0 ? floorPlus(proof.exercisesWithVideo) : null;
  const goalLabel = goal ? t(`onboarding.goal_${goal}_label`) : '';
  const GoalIcon = goal ? GOAL_ICONS[goal] : Dumbbell;

  if (variant === 'goal') {
    const percent = goal ? sharePercent(proof?.goalShare[goal]) : null;
    return (
      <div className="space-y-6 text-center">
        <h2 className="text-2xl font-bold">{t('onboarding.proof_goal_title')}</h2>
        {percent !== null ? (
          <>
            <ShareRing percent={percent} />
            <p className="text-base">{t('onboarding.proof_goal_share', { percent, goal: goalLabel.toLowerCase() })}</p>
          </>
        ) : (
          <div className="flex justify-center"><IconBadge icon={GoalIcon} size="lg" active /></div>
        )}
        <div className="rounded-2xl bg-card border border-border p-4 flex items-start gap-3 text-left">
          <IconBadge icon={GoalIcon} size="sm" />
          <p className="text-sm text-muted-foreground">{goal ? t(`onboarding.proof_goal_method_${goal}`) : ''}</p>
        </div>
      </div>
    );
  }

  if (variant === 'level') {
    const LevelIcon = level ? LEVEL_ICONS[level] : Dumbbell;
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-center">{t('onboarding.proof_level_title')}</h2>
        <div className="rounded-2xl bg-card border border-border p-4 flex items-center gap-4">
          <img src={davidPhoto} alt="" className="w-16 h-16 rounded-2xl object-cover object-top ring-2 ring-primary/40" />
          <div className="min-w-0">
            <p className="font-bold">David Beníšek</p>
            <p className="text-sm text-primary font-semibold">{t('onboarding.proof_trainer_role')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t('onboarding.proof_trainer_years')}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-primary/10 p-4 text-center">
            <Video className="w-6 h-6 text-primary mx-auto mb-1" aria-hidden="true" />
            <p className="text-2xl font-black text-primary">{exercises ?? t('onboarding.proof_exercises_nonumber_short')}</p>
            <p className="text-xs text-muted-foreground">{t('onboarding.proof_exercises_label')}</p>
          </div>
          <div className="rounded-2xl bg-primary/10 p-4 text-center">
            <LevelIcon className="w-6 h-6 text-primary mx-auto mb-1" aria-hidden="true" />
            <p className="text-sm font-bold mt-1">{level ? t(`onboarding.level_${level}`) : ''}</p>
            <p className="text-xs text-muted-foreground">{t('onboarding.proof_level_fit')}</p>
          </div>
        </div>
        <p className="text-sm text-center text-muted-foreground">{level ? t(`onboarding.proof_level_${level}`) : ''}</p>
      </div>
    );
  }

  // variant === 'plan' — shrnutí jejich voleb jako „hotový plán“
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-center">{t('onboarding.proof_plan_title')}</h2>
      <div className="rounded-2xl gradient-primary text-primary-foreground p-4 shadow-primary">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
            <GoalIcon className="w-6 h-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs opacity-80">{t('onboarding.proof_plan_goal')}</p>
            <p className="font-bold">{goalLabel}</p>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {DAYS.map((d) => {
            const on = trainingDays.includes(d.id);
            return (
              <div key={d.id} className={`rounded-lg py-2 text-center text-xs font-bold ${on ? 'bg-white text-primary' : 'bg-white/15 text-white/70'}`}>
                {t(`myplan.day_${d.id}`).slice(0, 2)}
              </div>
            );
          })}
        </div>
        <p className="text-sm mt-3 opacity-90">
          {t('onboarding.proof_plan_week', { count: trainingDays.length, minutes: durationMinutes })}
        </p>
      </div>
      <ul className="space-y-3">
        <Bullet>{t('onboarding.proof_plan_blocks', { weeks: PLAN_DURATION_WEEKS })}</Bullet>
        <Bullet>{t('onboarding.proof_plan_gym')}</Bullet>
        <Bullet>{exercises ? t('onboarding.proof_plan_exercises', { n: exercises }) : t('onboarding.proof_plan_exercises_nonumber')}</Bullet>
      </ul>
    </div>
  );
};

export default OnboardingProofStep;
