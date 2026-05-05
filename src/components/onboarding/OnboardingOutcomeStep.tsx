import { motion } from 'framer-motion';
import { CheckCircle, Calendar, Target, Zap } from 'lucide-react';
import { TrainingGoalId, UserLevel, getSplitFromFrequency, SPLIT_INFO, MVP_GOALS } from '@/lib/trainingGoals';
import { DAYS } from '@/lib/onboardingTypes';
import { useTranslation } from 'react-i18next';

interface OnboardingOutcomeStepProps {
  goal: TrainingGoalId;
  level: UserLevel;
  trainingDays: string[];
}

const OnboardingOutcomeStep = ({ goal, level, trainingDays }: OnboardingOutcomeStepProps) => {
  const { t } = useTranslation();
  const split = getSplitFromFrequency(trainingDays.length, level);
  const splitInfo = SPLIT_INFO[split];
  const goalInfo = MVP_GOALS.find(g => g.id === goal);
  const dayLabels = DAYS.filter(d => trainingDays.includes(d.id)).map(d => t(`onboarding.days_${d.id}`));

  const levelKey = level === 'beginner' ? 'onboarding.level_beginner'
    : level === 'intermediate' ? 'onboarding.level_intermediate'
    : 'onboarding.level_expert';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
        className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mb-4"
      >
        <CheckCircle className="w-8 h-8 text-primary" />
      </motion.div>

      <h2 className="text-2xl font-bold mb-1">{t('onboarding.outcome_title')}</h2>
      <p className="text-sm text-muted-foreground mb-7">
        {t('onboarding.outcome_subtitle')}
      </p>

      <div className="w-full space-y-3 mb-6">
        {/* Split */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          className="flex items-center gap-4 bg-card border border-border rounded-2xl px-4 py-3.5 text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('onboarding.training_type')}</p>
            <p className="font-semibold text-sm">{splitInfo.labelCz}</p>
            <p className="text-xs text-muted-foreground">dny {splitInfo.days.join(' / ')}</p>
          </div>
        </motion.div>

        {/* Goal */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.22 }}
          className="flex items-center gap-4 bg-card border border-border rounded-2xl px-4 py-3.5 text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Target className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('onboarding.goal_label')}</p>
            <p className="font-semibold text-sm">{goalInfo?.label} {goalInfo?.emoji}</p>
            <p className="text-xs text-muted-foreground">{t(levelKey)}</p>
          </div>
        </motion.div>

        {/* Days */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.29 }}
          className="flex items-center gap-4 bg-card border border-border rounded-2xl px-4 py-3.5 text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('onboarding.frequency')}</p>
            <p className="font-semibold text-sm">{t('onboarding.times_per_week', { n: trainingDays.length })}</p>
            <p className="text-xs text-muted-foreground">{dayLabels.join(', ')}</p>
          </div>
        </motion.div>
      </div>

      <p className="text-xs text-muted-foreground">
        {t('onboarding.create_account_unlock')}
      </p>
    </motion.div>
  );
};

export default OnboardingOutcomeStep;
