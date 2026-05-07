import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { MapPin, AlertTriangle, RefreshCw, X, ShieldAlert, Settings } from 'lucide-react';
import { useGymLocation } from '@/hooks/useGymLocation';
import { Capacitor } from '@capacitor/core';

interface GymLocationGateProps {
  gymLat: number;
  gymLng: number;
  gymName: string;
  onConfirmed: () => void;
  onCancel: () => void;
}

export const GymLocationGate = ({ gymLat, gymLng, gymName, onConfirmed, onCancel }: GymLocationGateProps) => {
  const { status, distanceFromGym, checkLocation, GYM_RADIUS_METRES } = useGymLocation();

  useEffect(() => {
    checkLocation(gymLat, gymLng).then((ok) => {
      if (ok) onConfirmed();
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const retry = () => {
    checkLocation(gymLat, gymLng).then((ok) => {
      if (ok) onConfirmed();
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] bg-background flex flex-col items-center justify-center px-6"
    >
      <button onClick={onCancel} className="absolute top-4 right-4 p-2 rounded-xl bg-muted text-muted-foreground" style={{ top: 'calc(1rem + env(safe-area-inset-top, 0px))' }}>
        <X className="w-5 h-5" />
      </button>

      {status === 'checking' || status === 'idle' ? (
        <CheckingState gymName={gymName} />
      ) : status === 'permission_denied' ? (
        <PermissionDeniedState gymName={gymName} onRetry={retry} onCancel={onCancel} />
      ) : status === 'outside' ? (
        <OutsideState gymName={gymName} distance={distanceFromGym} radius={GYM_RADIUS_METRES} onRetry={retry} onCancel={onCancel} />
      ) : status === 'error' ? (
        <ErrorState onRetry={retry} onCancel={onCancel} />
      ) : null}
    </motion.div>
  );
};

const CheckingState = ({ gymName }: { gymName: string }) => {
  const { t } = useTranslation();
  return (
    <div className="text-center">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
        <MapPin className="w-10 h-10 text-primary animate-pulse" />
      </div>
      <h2 className="text-xl font-bold mb-2">{t('workout.checking_location')}</h2>
      <p className="text-muted-foreground text-sm">{t('workout.checking_location_desc', { gymName })}</p>
      <div className="mt-6 flex justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );
};

const PermissionDeniedState = ({ gymName, onRetry, onCancel }: { gymName: string; onRetry: () => void; onCancel: () => void }) => {
  const { t } = useTranslation();
  const isNative = Capacitor.isNativePlatform();
  return (
    <div className="text-center max-w-xs">
      <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-6">
        <ShieldAlert className="w-10 h-10 text-amber-500" />
      </div>
      <h2 className="text-xl font-bold mb-2">{t('workout.location_permission')}</h2>
      <p className="text-muted-foreground text-sm mb-2">
        {t('workout.location_permission_desc', { gymName })}
      </p>
      {!isNative && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4 text-left">
          <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mb-1 flex items-center gap-1">
            <Settings className="w-3 h-3" />
            {t('workout.location_browser_blocked')}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('workout.location_browser_instructions')}
          </p>
        </div>
      )}
      <p className="text-muted-foreground text-xs mb-6">
        {t('workout.location_privacy')}
      </p>
      <button
        onClick={onRetry}
        className="w-full bg-primary text-white font-semibold rounded-xl py-3 mb-3 flex items-center justify-center gap-2"
      >
        <MapPin className="w-4 h-4" />
        {t('workout.allow_location')}
      </button>
      <button onClick={onCancel} className="w-full text-muted-foreground text-sm py-2">
        {t('workout.cancel')}
      </button>
    </div>
  );
};

const OutsideState = ({ gymName, distance, radius, onRetry, onCancel }: { gymName: string; distance: number | null; radius: number; onRetry: () => void; onCancel: () => void }) => {
  const { t } = useTranslation();
  return (
    <div className="text-center max-w-xs">
      <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
        <AlertTriangle className="w-10 h-10 text-destructive" />
      </div>
      <h2 className="text-xl font-bold mb-2">{t('workout.not_in_gym')}</h2>
      <p className="text-muted-foreground text-sm mb-2">
        {t('workout.not_in_gym_desc', { gymName })}
      </p>
      {distance != null && (
        <p className="text-xs text-muted-foreground mb-6">
          {t('workout.distance_info', { distance, radius })}
        </p>
      )}
      <button
        onClick={onRetry}
        className="w-full bg-primary text-white font-semibold rounded-xl py-3 mb-3 flex items-center justify-center gap-2"
      >
        <RefreshCw className="w-4 h-4" />
        {t('workout.retry')}
      </button>
      <button onClick={onCancel} className="w-full text-muted-foreground text-sm py-2">
        {t('workout.cancel')}
      </button>
    </div>
  );
};

const ErrorState = ({ onRetry, onCancel }: { onRetry: () => void; onCancel: () => void }) => {
  const { t } = useTranslation();
  return (
    <div className="text-center max-w-xs">
      <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
        <AlertTriangle className="w-10 h-10 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-bold mb-2">{t('workout.location_error')}</h2>
      <p className="text-muted-foreground text-sm mb-6">
        {t('workout.location_error_desc')}
      </p>
      <button
        onClick={onRetry}
        className="w-full bg-primary text-white font-semibold rounded-xl py-3 mb-3 flex items-center justify-center gap-2"
      >
        <RefreshCw className="w-4 h-4" />
        {t('workout.retry')}
      </button>
      <button onClick={onCancel} className="w-full text-muted-foreground text-sm py-2">
        {t('workout.cancel')}
      </button>
    </div>
  );
};
