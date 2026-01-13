import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';
import OfflineIndicator from './OfflineIndicator';

const AppLayout = () => {
  return (
    <div className="min-h-screen bg-background">
      <OfflineIndicator />
      <main className="pb-nav">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
};

export default AppLayout;
