import { motion } from 'framer-motion';
import { Check, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import davidPhoto from '@/assets/david-benisek.png';

interface OnboardingTrainerWelcomeProps {
  onStart: () => void;
  /** „Vyzkoušet bez registrace“ — prohlížení bez účtu (feedback 13. 10.). */
  onTryAsGuest?: () => void;
}

const OnboardingTrainerWelcome = ({ onStart, onTryAsGuest }: OnboardingTrainerWelcomeProps) => {
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
          <Check className="w-4 h-4 text-primary-foreground" strokeWidth={3} aria-hidden="true" />
        </div>
      </div>

      <h3 className="text-xl font-bold">David Beníšek</h3>
      <p className="text-sm text-primary font-medium mt-0.5 mb-6">{t('onboarding.trainer_welcome_role')}</p>

      {/* Jen jedna věta — dřív byl úvod moc dlouhý (David 15. 10.) */}
      <div className="bg-muted/60 rounded-2xl p-5 text-center mb-8 border border-border/40 w-full">
        <p className="text-base leading-relaxed text-foreground">
          "{t('onboarding.trainer_welcome_short')}"
        </p>
      </div>

      <Button
        onClick={onStart}
        className="w-full h-12 text-base font-semibold rounded-xl gap-2"
      >
        {t('onboarding.trainer_welcome_start')}
        <ChevronRight className="w-5 h-5" />
      </Button>

      {onTryAsGuest && (
        <>
          <Button
            variant="outline"
            onClick={onTryAsGuest}
            className="w-full h-12 text-base font-semibold rounded-xl mt-3"
          >
            {t('guest.try_without_signup')}
          </Button>
          <p className="text-xs text-muted-foreground mt-2 px-2">{t('guest.try_hint')}</p>
        </>
      )}
    </motion.div>
  );
};

export default OnboardingTrainerWelcome;
