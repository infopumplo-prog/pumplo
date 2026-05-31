import { useParams } from 'react-router-dom';
import { useStationData } from '@/hooks/useStationData';
import { StationBanner } from '@/components/station/StationBanner';
import { StationCTA } from '@/components/station/StationCTA';
import { StationVideoPlayer } from '@/components/station/StationVideoPlayer';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';

const StationPage = () => {
  const { code } = useParams<{ code: string }>();
  const { data, isLoading, error } = useStationData(code);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (data) {
      const titleName = (i18n.language === 'en' && data.machineName_en) ? data.machineName_en : data.machineName;
      document.title = `${titleName} — ${t('station.title_suffix')} | ${data.gymName} | Pumplo`;
    }
  }, [data, t]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#0B1222' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#4CC9FF' }} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center px-6" style={{ background: '#0B1222' }}>
        <p style={{ color: '#fff', fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
          {t('station.not_found')}
        </p>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', textAlign: 'center' }}>
          {t('station.invalid_qr')}
        </p>
      </div>
    );
  }

  if (data.exercises.length === 0) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center px-6" style={{ background: '#0B1222' }}>
        <StationBanner gymName={data.gymName} gymIsVerified={data.gymIsVerified} />
        <p style={{ color: '#fff', fontSize: '20px', fontWeight: 700, marginBottom: '8px', marginTop: '60px' }}>
          {(i18n.language === 'en' && data.machineName_en) ? data.machineName_en : data.machineName}
        </p>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', textAlign: 'center' }}>
          {t('station.no_videos')}
        </p>
        <StationCTA />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: '#000' }}>
      <StationBanner gymName={data.gymName} gymIsVerified={data.gymIsVerified} onDismiss={() => setBannerDismissed(true)} />
      <div className="flex-1">
        <StationVideoPlayer exercises={data.exercises} machineName={data.machineName} machineName_en={data.machineName_en} bannerVisible={!bannerDismissed} />
      </div>
      <StationCTA gymId={data.gymId} />
    </div>
  );
};

export default StationPage;
