import { useState, useEffect } from 'react';
import { WifiOff, Wifi, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

const OfflineIndicator = () => {
  const { t } = useTranslation();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);
  // Lišta jde zavřít křížkem — překrývala ovládání nahoře (křížek dotazníku apod., nález 12. 9.).
  // Po dalším výpadku sítě se ukáže znovu.
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      // Hide the "reconnected" message after 3 seconds
      setTimeout(() => setShowReconnected(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
      setDismissed(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {((!isOnline && !dismissed) || showReconnected) && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
          className={`fixed top-0 left-0 right-0 z-[1000] px-4 py-3 flex items-center justify-center gap-2 text-sm font-medium ${
            isOnline 
              ? 'bg-green-500 text-white' 
              : 'bg-amber-500 text-white'
          }`}
        >
          {isOnline ? (
            <>
              <Wifi className="w-4 h-4" />
              <span>{t('misc.connection_restored')}</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4" />
              <span>{t('misc.offline_mode')}</span>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                aria-label="Zavřít"
                className="ml-2 -mr-2 p-1 rounded-full hover:bg-white/20"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OfflineIndicator;
