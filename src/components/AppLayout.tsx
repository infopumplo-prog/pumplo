import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';
import OfflineIndicator from './OfflineIndicator';
import { FeedbackButton } from './feedback/FeedbackButton';

const AppLayout = () => {
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
