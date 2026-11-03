import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import davidPhoto from '@/assets/david-benisek.png';

interface OnboardingTrainerReactionProps {
  text: string;
}

/**
 * Bublina od trenéra mezi kroky dotazníku — reakce na předchozí odpověď
 * (Onboarding 2.0). Navazuje na úvodní obrazovku s Davidem Beníškem.
 */
const OnboardingTrainerReaction = ({ text }: OnboardingTrainerReactionProps) => {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex items-start gap-3 mb-6"
      role="status"
    >
      <img
        src={davidPhoto}
        alt=""
        className="w-10 h-10 rounded-full object-cover ring-2 ring-primary/40 shrink-0"
      />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-primary mb-0.5">{t('onboarding.reaction_trainer_name')}</p>
        <div className="bg-primary/10 text-foreground rounded-2xl rounded-tl-md px-4 py-2.5 text-sm leading-snug">
          {text}
        </div>
      </div>
    </motion.div>
  );
};

export default OnboardingTrainerReaction;
