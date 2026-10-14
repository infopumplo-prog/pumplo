import { lazy, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';
import OfflineIndicator from './OfflineIndicator';
import { FeedbackButton } from './feedback/FeedbackButton';
import { useWatchMenu } from '@/hooks/useWatchMenu';
import { useAccentSync } from '@/hooks/useAccentSync';
import { useGuest } from '@/contexts/GuestContext';
// Check-in se načítá líně — hlavní bundle je u limitu PWA precache (14. 10.).
const WeeklyCheckinHost = lazy(() => import('./checkin/WeeklyCheckinHost'));

const AppLayout = () => {
  // Nabídka pro hodinky žije tady, ne v přehrávači — příkaz „spusť trénink"
  // dorazí ve chvíli, kdy žádný přehrávač neběží.
  useWatchMenu();
  useAccentSync();
  const { isGuest } = useGuest();

  return (
    <div className="h-[100dvh] flex flex-col bg-background overflow-hidden" style={{ overscrollBehavior: 'none' }}>
      <OfflineIndicator />
      <main className="flex-1 overflow-y-auto pb-nav" style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
        <Outlet />
      </main>
      {/* Feedback i check-in se ukládají k účtu — host je nevidí. */}
      {!isGuest && <FeedbackButton />}
      {/* Týdenní check-in (feedback 13. 10.) */}
      {!isGuest && <Suspense fallback={null}><WeeklyCheckinHost /></Suspense>}
      <BottomNav />
    </div>
  );
};

export default AppLayout;
