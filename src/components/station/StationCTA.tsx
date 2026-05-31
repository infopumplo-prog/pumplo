import { Dumbbell } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface StationCTAProps {
  gymId?: string;
}

export const StationCTA = ({ gymId }: StationCTAProps) => {
  const { t } = useTranslation();
  const authUrl = gymId ? `/auth?gymId=${gymId}` : '/auth';

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-3"
      style={{ background: 'linear-gradient(to top, #0B1222 60%, transparent)' }}>
      <a href={authUrl}
        className="flex items-center justify-center gap-2 w-full rounded-xl py-3.5"
        style={{ background: '#4CC9FF', color: '#fff', fontSize: '15px', fontWeight: 600, textDecoration: 'none' }}>
        <Dumbbell className="w-5 h-5" />
        {t('station.cta_btn')}
      </a>
    </div>
  );
};
