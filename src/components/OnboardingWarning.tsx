import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

const OnboardingWarning = () => {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-4 mb-4"
    >
      <button
        onClick={() => navigate('/onboarding')}
        className="w-full p-3 bg-warning/10 border border-warning/30 rounded-xl flex items-center gap-3 hover:bg-warning/20 transition-colors"
      >
        <div className="p-2 bg-warning/20 rounded-full">
          <AlertTriangle className="w-5 h-5 text-warning" />
        </div>
        <div className="text-left flex-1">
          <p className="font-medium text-sm text-foreground">Dokonči svůj profil</p>
          <p className="text-xs text-muted-foreground">Klikni pro vyplnění dotazníku</p>
        </div>
      </button>
    </motion.div>
  );
};

export default OnboardingWarning;
