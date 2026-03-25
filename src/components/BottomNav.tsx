import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, MapPin, BarChart3, User } from 'lucide-react';
import { useUnreadMessageCount } from '@/hooks/useUnreadMessageCount';

const navItems = [
  { path: '/', label: 'Domů', icon: Home },
  { path: '/map', label: 'Mapa', icon: MapPin },
  { path: '/statistics', label: 'Statistiky', icon: BarChart3 },
  { path: '/profile', label: 'Profil', icon: User },
];

const BottomNav = () => {
  const location = useLocation();
  const { unreadCount } = useUnreadMessageCount();

  // Hide bottom nav during active workout
  if (location.pathname.startsWith('/custom-workout/') || location.pathname === '/training') return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6" style={{ touchAction: 'none' }}>
      <nav className="bg-background/95 backdrop-blur-lg border border-border rounded-2xl shadow-lg max-w-md mx-auto">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className="flex flex-col items-center justify-center flex-1 h-full relative group py-2"
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-2 bg-primary/10 rounded-xl"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                <div className="relative flex flex-col items-center justify-center z-10">
                  <div className="relative">
                    <Icon
                      className={`w-5 h-5 relative z-10 transition-colors duration-200 ${
                        isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                      }`}
                    />
                    {item.path === '/profile' && unreadCount > 0 && (
                      <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-background z-20" />
                    )}
                  </div>
                  <span 
                    className={`text-xs mt-1 font-medium relative z-10 transition-colors duration-200 ${
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
