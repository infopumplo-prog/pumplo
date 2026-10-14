import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, MapPin, BarChart3, User, Dumbbell } from 'lucide-react';
import { useUnreadMessageCount } from '@/hooks/useUnreadMessageCount';
import { useTranslation } from 'react-i18next';

const BottomNav = () => {
  const location = useLocation();
  const { unreadCount } = useUnreadMessageCount();
  const { t } = useTranslation();

  const navItems = [
    // Domů uprostřed (David 8. 10.), vedle nová sekce Tréninky.
    { path: '/map', label: t('nav.map'), icon: MapPin, coach: 'nav-map' },
    { path: '/workouts', label: t('nav.workouts'), icon: Dumbbell, coach: 'nav-workouts' },
    { path: '/', label: t('nav.home'), icon: Home, coach: 'nav-home' },
    { path: '/statistics', label: t('nav.statistics'), icon: BarChart3, coach: 'nav-stats' },
    { path: '/profile', label: t('nav.profile'), icon: User, coach: 'nav-profile' },
  ];

  // Hide bottom nav during active workout and chat
  if (location.pathname.startsWith('/custom-workout/') || location.pathname.startsWith('/custom-plan/') || location.pathname === '/training' || location.pathname.startsWith('/messages/chat/')) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4" style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))', touchAction: 'none' }}>
      <nav className="bg-background/95 backdrop-blur-lg border border-border rounded-2xl shadow-lg max-w-md mx-auto">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            // Domů = zvýrazněné kulaté tlačítko uprostřed lišty (David 8. 10.).
            if (item.path === '/') {
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  data-coach={item.coach}
                  aria-label={item.label}
                  className="flex flex-col items-center justify-center flex-1 h-full relative group [-webkit-tap-highlight-color:transparent]"
                >
                  <span
                    className={`-mt-7 w-14 h-14 rounded-full flex items-center justify-center shadow-lg ring-4 ring-background transition-transform group-active:scale-90 ${
                      isActive ? 'bg-primary text-primary-foreground' : 'bg-primary/90 text-primary-foreground'
                    }`}
                  >
                    <Icon className="w-6 h-6" strokeWidth={2.4} />
                  </span>
                  <span className={`text-xs mt-0.5 font-semibold ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                    {item.label}
                  </span>
                </NavLink>
              );
            }

            // Větší odezva na dotyk (feedback 13. 10.): zmáčknutí zmenší položku a podbarví ji.
            return (
              <NavLink
                key={item.path}
                to={item.path}
                data-coach={item.coach}
                aria-label={item.label}
                className="flex flex-col items-center justify-center flex-1 h-full min-w-[44px] relative group py-1.5 transition-transform active:scale-95 [-webkit-tap-highlight-color:transparent]"
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-2 bg-primary/10 rounded-xl"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                <span className="absolute inset-1.5 rounded-xl bg-primary/0 group-active:bg-primary/15 transition-colors" />
                <div className="relative flex flex-col items-center justify-center z-10">
                  <div className="relative">
                    <Icon
                      className={`w-6 h-6 relative z-10 transition-colors duration-200 ${
                        isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                      }`}
                    />
                    {item.path === '/profile' && unreadCount > 0 && (
                      <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-background z-20" />
                    )}
                  </div>
                  <span 
                    className={`text-xs mt-0.5 font-semibold relative z-10 transition-colors duration-200 ${
                      isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default BottomNav;
