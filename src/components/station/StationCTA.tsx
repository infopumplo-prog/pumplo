import { Dumbbell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { openAppOrStore, APP_STORE_URL } from '@/lib/appRedirect';
import { logStoreClick } from '@/lib/qrTracking';

export const StationCTA = () => {
  const { t } = useTranslation();
  const { code } = useParams<{ code: string }>();

  const handleOpen = () => {
    // Funnel analytics: the tap is logged before any redirect fires.
    if (code) logStoreClick('station', code);
    // Mobile: open the app (or fall back to its store). Desktop: there is no
    // app, so send straight to the App Store listing.
    if (!openAppOrStore('station')) {
      window.location.href = APP_STORE_URL;
    }
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
