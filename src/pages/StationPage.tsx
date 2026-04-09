import { useParams } from 'react-router-dom';
import { useStationData } from '@/hooks/useStationData';
import { StationBanner } from '@/components/station/StationBanner';
import { StationCTA } from '@/components/station/StationCTA';
import { StationVideoPlayer } from '@/components/station/StationVideoPlayer';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

const StationPage = () => {
  const { code } = useParams<{ code: string }>();
  const { data, isLoading, error } = useStationData(code);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    if (data) {
      document.title = `${data.machineName} — cviky | ${data.gymName} | Pumplo`;
    }
  }, [data]);

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
          Cvičiště nenalezeno
        </p>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', textAlign: 'center' }}>
          QR kód je neplatný nebo byl odstraněn.
        </p>
      </div>
    );
  }

  if (data.exercises.length === 0) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center px-6" style={{ background: '#0B1222' }}>
        <StationBanner gymName={data.gymName} />
        <p style={{ color: '#fff', fontSize: '20px', fontWeight: 700, marginBottom: '8px', marginTop: '60px' }}>
          {data.machineName}
        </p>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', textAlign: 'center' }}>
          Pro toto cvičiště zatím nemáme videa.
        </p>
        <StationCTA />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: '#000' }}>
      <StationBanner gymName={data.gymName} onDismiss={() => setBannerDismissed(true)} />
      <div className="flex-1">
        <StationVideoPlayer exercises={data.exercises} machineName={data.machineName} bannerVisible={!bannerDismissed} />
      </div>
      <StationCTA />
    </div>
  );
};

export default StationPage;
