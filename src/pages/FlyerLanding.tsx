import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Download, Dumbbell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { logQrScan, logStoreClick, detectPlatform } from '@/lib/qrTracking';

// Landing behind flyer QR codes (/go/<code>): logs the scan for the funnel
// analytics and sends the visitor to their app store. Must stay dependency-light
// and work logged-out — it's the first Pumplo screen a flyer reader ever sees.
const FlyerLanding = () => {
  const { code } = useParams<{ code: string }>();
  const { t } = useTranslation();
  const platform = detectPlatform();

  useEffect(() => {
    if (code) logQrScan('flyer', code);
  }, [code]);

  const openStore = (target: 'ios' | 'android') => {
    const { appStoreUrl, playStoreUrl } = logStoreClick('flyer', code ?? '');
    window.location.href = target === 'ios' ? appStoreUrl : playStoreUrl;
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center px-8 text-center" style={{ background: '#0B1222' }}>
      <img src="/pumplo-icon.png" alt="Pumplo" className="w-24 h-24 rounded-3xl mb-6" />
      <h1 className="text-3xl font-black text-white mb-3">{t('flyer.headline')}</h1>
      <p className="text-base mb-10" style={{ color: 'rgba(255,255,255,0.6)' }}>{t('flyer.sub')}</p>

      {platform === 'other' ? (
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button onClick={() => openStore('ios')}
            className="flex items-center justify-center gap-2 rounded-xl py-3.5 font-bold text-[#0B1222] active:scale-95 transition-transform"
            style={{ background: '#4CC9FF' }}>
            <Download className="w-5 h-5" /> App Store
          </button>
          <button onClick={() => openStore('android')}
            className="flex items-center justify-center gap-2 rounded-xl py-3.5 font-bold text-white active:scale-95 transition-transform"
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}>
            <Download className="w-5 h-5" /> Google Play
          </button>
        </div>
      ) : (
        <button onClick={() => openStore(platform)}
          className="flex items-center justify-center gap-2 w-full max-w-xs rounded-xl py-4 text-lg font-bold text-[#0B1222] active:scale-95 transition-transform"
          style={{ background: '#4CC9FF' }}>
          <Download className="w-5 h-5" /> {t('flyer.download')}
        </button>
      )}

      <div className="flex items-center gap-2 mt-10" style={{ color: 'rgba(255,255,255,0.35)' }}>
        <Dumbbell className="w-4 h-4" />
        <span className="text-sm">{t('flyer.tagline')}</span>
      </div>
    </div>
  );
};

export default FlyerLanding;
