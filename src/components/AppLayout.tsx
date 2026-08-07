import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';
import OfflineIndicator from './OfflineIndicator';
import { FeedbackButton } from './feedback/FeedbackButton';
import { useWatchMenu } from '@/hooks/useWatchMenu';

const AppLayout = () => {
  // Nabídka pro hodinky žije tady, ne v přehrávači — příkaz „spusť trénink"
  // dorazí ve chvíli, kdy žádný přehrávač neběží.
  useWatchMenu();

  return (
    <div className="h-[100dvh] flex flex-col bg-background overflow-hidden" style={{ overscrollBehavior: 'none' }}>
      <OfflineIndicator />
      <main className="flex-1 overflow-y-auto pb-nav" style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
        <Outlet />
      </main>
      <FeedbackButton />
      <BottomNav />
    </div>
  );
};

export default AppLayout;
