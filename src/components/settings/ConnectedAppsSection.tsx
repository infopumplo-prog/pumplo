import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Scale } from 'lucide-react';
import HealthConnectCard from '@/components/trainer/HealthConnectCard';
import BodyWeightSheet from '@/components/trainer/BodyWeightSheet';
import { getHealthPlatform, type HealthPlatform } from '@/lib/healthWeights';

type ConnectorStatus = 'via_health' | 'soon';
interface Connector { name: string; status: ConnectorStatus }

// Další appky: co umí poslat vážení do Zdraví / Health Connect, to Pumplo načte už teď;
// přímé napojení (Strava, Fitbit na iOS, Garmin na Androidu) zatím připravujeme.
const CONNECTORS: Record<HealthPlatform, Connector[]> = {
  ios: [
    { name: 'Withings', status: 'via_health' },
    { name: 'Garmin Connect', status: 'via_health' },
    { name: 'Zepp Life', status: 'via_health' },
    { name: 'Fitbit', status: 'soon' },
    { name: 'Strava', status: 'soon' },
  ],
  android: [
    { name: 'Samsung Health', status: 'via_health' },
    { name: 'Withings', status: 'via_health' },
    { name: 'Fitbit', status: 'via_health' },
    { name: 'Zepp Life', status: 'via_health' },
    { name: 'Garmin Connect', status: 'soon' },
    { name: 'Strava', status: 'soon' },
  ],
};

// Nastavení → Propojené aplikace (David, 9. 11. 2026): Zdraví / Health Connect jednoduše na jednom
// místě pro všechny, ne schované u trenéra, plus nabídka dalších konektorů. Cíl odkazu #propojeni.
export const ConnectedAppsSection = () => {
  const { t } = useTranslation();
  const [weightOpen, setWeightOpen] = useState(false);
  const platform = getHealthPlatform();
  const list = CONNECTORS[platform ?? 'ios'];
  const viaLabel = platform === 'android' ? t('trainer_client.conn_via_health_connect') : t('trainer_client.conn_via_apple_health');

  return (
    <section id="propojeni" className="scroll-mt-24 space-y-3">
      <h2 className="px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('trainer_client.conn_group')}</h2>

      {platform ? (
        <HealthConnectCard />
      ) : (
        <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">{t('trainer_client.conn_web_note')}</p>
      )}

      <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
        <button
          type="button"
          onClick={() => setWeightOpen(true)}
          className="w-full flex items-center gap-3 px-4 py-3 min-h-[52px] text-left active:bg-muted/60"
        >
          <Scale className="w-5 h-5 text-primary shrink-0" />
          <span className="flex-1 text-[15px]">{t('trainer_client.weight_title')}</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div>
        <p className="px-4 mb-2 text-xs font-semibold text-muted-foreground">{t('trainer_client.conn_more_title')}</p>
        <ul className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
          {list.map((c) => (
            <li key={c.name} className="flex items-center gap-3 px-4 py-3 min-h-[48px]">
              <span className="flex-1 text-[15px]">{c.name}</span>
              <span
                className={`text-xs rounded-full px-2 py-0.5 ${c.status === 'via_health' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
              >
                {c.status === 'via_health' ? viaLabel : t('trainer_client.conn_soon')}
              </span>
            </li>
          ))}
        </ul>
        <p className="px-4 mt-2 text-xs text-muted-foreground">
          {platform === 'android' ? t('trainer_client.conn_footer_android') : t('trainer_client.conn_footer_ios')}
        </p>
      </div>

      <BodyWeightSheet open={weightOpen} onClose={() => setWeightOpen(false)} />
    </section>
  );
};
