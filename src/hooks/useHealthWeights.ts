import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { useAuth } from '@/contexts/AuthContext';
import { useInvalidateTrainerData } from '@/hooks/useTrainerAssignments';
import {
  connectHealth,
  disconnectHealth,
  EMPTY_HEALTH_STATE,
  getHealthPlatform,
  isAutoSyncDue,
  readHealthState,
  subscribeHealthState,
  syncHealthWeights,
  type HealthSyncResult,
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

export type HealthConnectProblem = 'denied' | 'not_installed' | 'update_required' | 'unsupported' | null;

// Propojit / synchronizovat / odpojit — sdílené kartou v Nastavení i nabídkou na Home.
export const useHealthConnectActions = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const invalidate = useInvalidateTrainerData();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<HealthConnectProblem>(null);
  const [emptyHint, setEmptyHint] = useState(false);
  const ios = getHealthPlatform() === 'ios';

  const afterSync = useCallback(async (res: HealthSyncResult) => {
    if (!('imported' in res)) { toast.error(t('trainer_client.health_sync_error')); return; }
    if (res.failed > 0) toast.error(t('trainer_client.health_sync_partial', { count: res.failed }));
    else if (res.imported > 0) toast.success(t('trainer_client.health_sync_done', { count: res.imported }));
    else toast(t('trainer_client.health_sync_nothing'));
    // iOS neprozradí zamítnuté čtení — bez dat nabídnout, kde ho povolit.
    setEmptyHint(ios && res.imported === 0 && res.failed === 0);
    if (res.imported > 0) await invalidate();
  }, [t, ios, invalidate]);

  /** true = propojeno; false = problém (v `problem`) nebo chyba. */
  const connect = useCallback(async (): Promise<boolean> => {
    if (busy || !user) return false;
    setBusy(true);
    setProblem(null);
    const res = await connectHealth(user.id);
    setBusy(false);
    if ('reason' in res) {
      if (res.reason === 'error') toast.error(t('trainer_client.health_sync_error'));
      else setProblem(res.reason);
      return false;
    }
    if ('sync' in res) await afterSync(res.sync);
    return true;
  }, [busy, user, t, afterSync]);

  const syncNow = useCallback(async () => {
    if (busy || !user) return;
    setBusy(true);
    const res = await syncHealthWeights(user.id);
    setBusy(false);
    await afterSync(res);
  }, [busy, user, afterSync]);

  const disconnect = useCallback(() => {
    if (!user) return;
    disconnectHealth(user.id);
    setEmptyHint(false);
    toast(t('trainer_client.health_disconnected'));
  }, [user, t]);

  return { busy, problem, emptyHint, connect, syncNow, disconnect };
};
