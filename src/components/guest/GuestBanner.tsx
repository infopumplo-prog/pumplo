import { UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useGuest } from '@/contexts/GuestContext';

/** Proužek v katalogu pro hosta — vždy viditelná cesta k účtu (feedback 13. 10.). */
const GuestBanner = () => {
  const { t } = useTranslation();
  const { isGuest, requireAccount } = useGuest();
  if (!isGuest) return null;
  return (
    <div className="mt-4 rounded-2xl bg-primary/10 border border-primary/20 px-4 py-2.5 flex items-center justify-between gap-3">
      <span className="text-xs font-medium text-foreground">{t('guest.banner_text')}</span>
      <button
        type="button"
        onClick={() => requireAccount()}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold active:scale-95 transition-transform"
      >
        <UserPlus className="w-3.5 h-3.5" />
        {t('guest.banner_cta')}
      </button>
    </div>
  );
};

export default GuestBanner;
