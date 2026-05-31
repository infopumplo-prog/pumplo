import { AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

interface OnboardingWarningProps {
  onClick: () => void;
}

const OnboardingWarning = ({ onClick }: OnboardingWarningProps) => {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-4 mb-4"
    >
      <button
        onClick={onClick}
        className="w-full p-3 bg-warning/10 border border-warning/30 rounded-xl flex items-center gap-3 hover:bg-warning/20 transition-colors"
      >
        <div className="p-2 bg-warning/20 rounded-full">
          <AlertTriangle className="w-5 h-5 text-warning" />
        </div>
        <div className="text-left flex-1">
          <p className="font-medium text-sm text-foreground">{t('onboarding.complete_profile')}</p>
          <p className="text-xs text-muted-foreground">{t('onboarding.click_to_fill')}</p>
        </div>
      </button>
    </motion.div>
  );
};

export default OnboardingWarning;
