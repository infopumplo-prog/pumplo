import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { HeartPulse, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useHealthConnectActions, useHealthSyncState } from '@/hooks/useHealthWeights';
import { getHealthPlatform } from '@/lib/healthWeights';
import {
  dismissHealthOffer,
  EMPTY_HEALTH_OFFER,
  readHealthOffer,
  shouldShowHealthOffer,
  type HealthOfferState,
} from '@/lib/healthOffer';

// Home: sama nabídne propojení se Zdravím / Health Connect (David, 9. 11. 2026).
// Pravidla zobrazení v lib/healthOffer.ts; po propojení zmizí, další správa v Nastavení → Propojené aplikace.
const HealthConnectOfferCard = ({ onboardingComplete }: { onboardingComplete: boolean }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const state = useHealthSyncState();
  const { busy, problem, connect } = useHealthConnectActions();
  const [offer, setOffer] = useState<HealthOfferState>(() => (user ? readHealthOffer(user.id) : EMPTY_HEALTH_OFFER));
  useEffect(() => { setOffer(user ? readHealthOffer(user.id) : EMPTY_HEALTH_OFFER); }, [user]);

  const platform = getHealthPlatform();
  if (!user || !shouldShowHealthOffer({ platform, connected: state.connected, onboardingComplete, offer, now: Date.now() })) return null;
  const ios = platform === 'ios';

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4" data-testid="health-offer-card">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <HeartPulse className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground">
            {ios ? t('trainer_client.health_offer_title_ios') : t('trainer_client.health_offer_title_android')}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{t('trainer_client.health_offer_desc')}</p>
        </div>
      </div>
      {problem ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">{t('trainer_client.health_offer_problem')}</p>
          <Button size="sm" variant="outline" className="w-full rounded-xl" onClick={() => navigate('/settings#propojeni')}>
            {t('trainer_client.health_offer_open_settings')}
          </Button>
        </div>
      ) : (
        <div className="flex gap-2 mt-3">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 rounded-xl"
            disabled={busy}
            onClick={() => setOffer(dismissHealthOffer(user.id))}
          >
            {t('trainer_client.health_offer_later')}
          </Button>
          <Button size="sm" className="flex-1 rounded-xl gap-2" disabled={busy} onClick={() => void connect()}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('trainer_client.health_offer_cta')}
          </Button>
        </div>
      )}
    </div>
  );
};

export default HealthConnectOfferCard;
