import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { cs, enUS } from 'date-fns/locale';
import { HeartPulse, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useHealthConnectActions, useHealthSyncState } from '@/hooks/useHealthWeights';
import { getHealthPlatform, openHealthConnectStore, openHealthSettings } from '@/lib/healthWeights';

// Propojení se Zdravím (iOS) / Health Connect (Android): import vah, stav, ruční synchronizace.
// Na webu/PWA se nezobrazuje.
const HealthConnectCard = ({ className = '' }: { className?: string }) => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const state = useHealthSyncState();
  const { busy, problem, emptyHint, connect, syncNow, disconnect } = useHealthConnectActions();
  const platform = getHealthPlatform();
  if (!platform || !user) return null;

  const ios = platform === 'ios';
  const locale = i18n.language === 'en' ? enUS : cs;
  const lastSync = state.lastSyncAt ? (() => {
    try { return format(parseISO(state.lastSyncAt), 'd. M. HH:mm', { locale }); } catch { return null; }
  })() : null;

  return (
    <div className={`rounded-2xl border border-border bg-card p-4 space-y-3 ${className}`}>
      <div className="flex items-start gap-3">
        <HeartPulse className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold">
            {ios ? t('trainer_client.health_title_ios') : t('trainer_client.health_title_android')}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {state.connected
              ? (lastSync
                ? t('trainer_client.health_connected_last', { date: lastSync })
                : t('trainer_client.health_connected'))
              : t('trainer_client.health_desc')}
          </p>
        </div>
      </div>

      {state.connected ? (
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1 rounded-xl min-h-[44px] gap-2" disabled={busy} onClick={() => void syncNow()}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {t('trainer_client.health_sync_now')}
          </Button>
          <Button variant="ghost" className="rounded-xl min-h-[44px] text-muted-foreground" disabled={busy} onClick={disconnect}>
            {t('trainer_client.health_disconnect')}
          </Button>
        </div>
      ) : (
        <Button className="w-full rounded-xl min-h-[44px] gap-2" disabled={busy} onClick={() => void connect()}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          {ios ? t('trainer_client.health_connect_ios') : t('trainer_client.health_connect_android')}
        </Button>
      )}

      {problem === 'denied' && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{t('trainer_client.health_denied_android')}</p>
          <Button variant="outline" className="w-full rounded-xl min-h-[44px]" onClick={() => void openHealthSettings()}>
            {t('trainer_client.health_open_settings')}
          </Button>
        </div>
      )}
      {(problem === 'not_installed' || problem === 'update_required') && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {problem === 'update_required' ? t('trainer_client.health_update_required') : t('trainer_client.health_not_installed')}
          </p>
          <Button variant="outline" className="w-full rounded-xl min-h-[44px]" onClick={() => void openHealthConnectStore()}>
            {t('trainer_client.health_open_store')}
          </Button>
        </div>
      )}
      {problem === 'unsupported' && (
        <p className="text-xs text-muted-foreground">{t('trainer_client.health_unsupported')}</p>
      )}
      {emptyHint && (
        <p className="text-xs text-muted-foreground">{t('trainer_client.health_ios_empty_hint')}</p>
      )}
      {!ios && problem !== 'unsupported' && (
        // Android: váhy se do Health Connect dostanou ze Samsung Health, Google Fit, Withings, Xiaomi/Zepp…
        <p className="text-xs text-muted-foreground">{t('trainer_client.health_android_sources_hint')}</p>
      )}
    </div>
  );
};

export default HealthConnectCard;
