import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { useAuth } from '@/contexts/AuthContext';
import { useInvalidateTrainerData } from '@/hooks/useTrainerAssignments';
import {
  EMPTY_HEALTH_STATE,
  getHealthPlatform,
  isAutoSyncDue,
  readHealthState,
  subscribeHealthState,
  syncHealthWeights,
  type HealthSyncState,
} from '@/lib/healthWeights';

/** Stav propojení se Zdravím pro přihlášeného uživatele (živě, i ze synchronizace na pozadí). */
export const useHealthSyncState = (): HealthSyncState => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [state, setState] = useState<HealthSyncState>(() => (userId ? readHealthState(userId) : EMPTY_HEALTH_STATE));
  useEffect(() => {
    const refresh = () => setState(userId ? readHealthState(userId) : EMPTY_HEALTH_STATE);
    refresh();
    return subscribeHealthState(refresh);
  }, [userId]);
  return state;
};

// Automatický import vah ze Zdraví: při startu a návratu appky do popředí, nejvýš jednou za 6 h,
// jen když si uživatel propojení zapnul. Tiché — chyby jen do konzole.
export const HealthWeightAutoSync = () => {
  const { user } = useAuth();
  const invalidate = useInvalidateTrainerData();

  useEffect(() => {
    if (!user || !getHealthPlatform()) return;
    const userId = user.id;
    const run = async () => {
      if (!isAutoSyncDue(readHealthState(userId), new Date())) return;
      const res = await syncHealthWeights(userId);
      if (res.ok && res.imported > 0) await invalidate();
    };
    void run();
    let listener: Promise<{ remove: () => void }> | null = null;
    if (Capacitor.isNativePlatform()) listener = CapApp.addListener('resume', () => { void run(); });
    return () => { listener?.then((h) => h.remove()); };
  }, [user, invalidate]);

  return null;
};
