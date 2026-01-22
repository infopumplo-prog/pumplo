import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';
import OfflineIndicator from './OfflineIndicator';
import { FeedbackButton } from './feedback/FeedbackButton';

const AppLayout = () => {
  return (
    <div className="min-h-screen bg-background">
      <OfflineIndicator />
      <main className="pb-nav">
        <Outlet />
      </main>
      <FeedbackButton />
      <BottomNav />
    </div>
  );
};

export default AppLayout;
