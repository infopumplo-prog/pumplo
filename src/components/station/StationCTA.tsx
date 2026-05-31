import { Dumbbell } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const APP_STORE_URL = 'https://apps.apple.com/app/pumplo/id6744960498';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.pumplo.app';

interface StationCTAProps {
  gymId?: string;
}

export const StationCTA = ({ gymId }: StationCTAProps) => {
  const { t } = useTranslation();

  const handleOpen = () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);

    if (isIOS) {
      // Try to open app, fall back to App Store after 500ms
      window.location.href = `com.pumplo.app://station`;
      setTimeout(() => {
        window.location.href = APP_STORE_URL;
      }, 500);
      return;
    }
    if (isAndroid) {
      // Try to open app, fall back to Google Play after 500ms
      window.location.href = `com.pumplo.app://station`;
      setTimeout(() => {
        window.location.href = PLAY_STORE_URL;
      }, 500);
      return;
    }
    const authUrl = gymId ? `/auth?gymId=${gymId}` : '/auth';
    window.location.href = authUrl;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-3"
      style={{ background: 'linear-gradient(to top, #0B1222 60%, transparent)' }}>
      <button onClick={handleOpen}
        className="flex items-center justify-center gap-2 w-full rounded-xl py-3.5"
        style={{ background: '#4CC9FF', color: '#fff', fontSize: '15px', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
        <Dumbbell className="w-5 h-5" />
        {t('station.cta_btn')}
      </button>
    </div>
  );
};
