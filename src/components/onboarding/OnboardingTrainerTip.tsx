import { motion } from 'framer-motion';
import { Shield, UserCheck, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface OnboardingTrainerTipProps {
  onContinue: () => void;
}

const OnboardingTrainerTip = ({ onContinue }: OnboardingTrainerTipProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center text-center px-2">
      {/* Illustration */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative mb-8 mt-4"
      >
        <div className="w-28 h-28 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500/30 to-orange-500/30 flex items-center justify-center">
            <Shield className="w-10 h-10 text-amber-500" />
          </div>
        </div>
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.3 }}
          className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-lg"
        >
          <UserCheck className="w-5 h-5 text-primary-foreground" />
        </motion.div>
      </motion.div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        className="space-y-4"
      >
        <h2 className="text-2xl font-bold text-foreground">
          {t('onboarding.trainer_tip_title')}
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-[300px] mx-auto">
          {t('onboarding.trainer_tip_desc')}
        </p>

        <div className="bg-muted/50 border border-border/50 rounded-xl p-4 text-left space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs font-bold text-primary">{n}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {t(`onboarding.trainer_tip_${n}`)}
              </p>
            </div>
          ))}
        </div>

        <button
          onClick={onContinue}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform mt-2"
        >
          {t('onboarding.trainer_tip_continue')}
          <ArrowRight className="w-4 h-4" />
        </button>
      </motion.div>
    </div>
  );
};

export default OnboardingTrainerTip;
