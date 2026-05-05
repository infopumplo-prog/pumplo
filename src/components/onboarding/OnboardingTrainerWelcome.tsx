import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import davidPhoto from '@/assets/david-benisek.png';

interface OnboardingTrainerWelcomeProps {
  onStart: () => void;
}

const OnboardingTrainerWelcome = ({ onStart }: OnboardingTrainerWelcomeProps) => {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col items-center text-center py-2"
    >
      <div className="relative mb-5">
        <div className="w-44 h-44 rounded-full overflow-hidden border-4 border-primary/25 shadow-xl">
          <img
            src={davidPhoto}
            alt="David Beníšek"
            className="w-full h-full object-cover object-top"
          />
        </div>
        <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-md">
          <span className="text-xs font-bold text-primary-foreground">✓</span>
        </div>
      </div>

      <h3 className="text-xl font-bold">David Beníšek</h3>
      <p className="text-sm text-primary font-medium mt-0.5 mb-6">{t('onboarding.trainer_welcome_role')}</p>

      <div className="bg-muted/60 rounded-2xl p-5 text-left mb-8 border border-border/40 w-full">
        <p className="text-sm leading-relaxed text-foreground/90">
          "Za 12 let jsem natrénoval desítky klientů od nuly až po první závody. A vím, že největší problém není motivace —{' '}
          <span className="font-semibold text-foreground">je to plán, který nesedí.</span>
        </p>
        <p className="text-sm leading-relaxed text-foreground/90 mt-3">
          Zodpověz mi pár otázek. Sestavíme ti ho přesně na míru."
        </p>
      </div>

      <Button
        onClick={onStart}
        className="w-full h-12 text-base font-semibold rounded-xl gap-2"
      >
        {t('onboarding.trainer_welcome_start')}
        <ChevronRight className="w-5 h-5" />
      </Button>
    </motion.div>
  );
};

export default OnboardingTrainerWelcome;
