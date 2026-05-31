import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';

interface UpdateBannerProps {
  onUpdate: () => void;
}

const UpdateBanner = ({ onUpdate }: UpdateBannerProps) => {
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 500);
    return () => clearTimeout(timer);
  }, [countdown]);

  return (
    <motion.div 
      className="fixed top-0 left-0 right-0 z-[9999] bg-primary text-primary-foreground px-4 py-3 shadow-lg"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
    >
      <div className="flex items-center justify-between max-w-md mx-auto">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="font-medium text-sm">
            Aktualizace za {countdown > 0 ? `${countdown}s` : '...'}
          </span>
        </div>
        <Button 
          size="sm" 
          variant="secondary" 
          onClick={onUpdate}
          className="shrink-0"
        >
          Aktualizovat teď
        </Button>
      </div>
    </motion.div>
  );
};

export default UpdateBanner;
