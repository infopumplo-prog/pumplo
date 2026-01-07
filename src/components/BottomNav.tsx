import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, MapPin, User } from 'lucide-react';

const navItems = [
  { path: '/', label: 'Domů', icon: Home },
  { path: '/map', label: 'Mapa', icon: MapPin },
  { path: '/profile', label: 'Můj profil', icon: User },
];

const BottomNav = () => {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-lg border-t border-border safe-bottom z-50">
      <div className="flex items-center justify-around h-nav max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className="flex flex-col items-center justify-center flex-1 h-full relative group"
            >
              <div className="relative flex flex-col items-center">
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute -top-1 left-1/2 -translate-x-1/2 w-12 h-12 bg-primary/10 rounded-2xl"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                <Icon 
                  className={`w-6 h-6 relative z-10 transition-colors duration-200 ${
                    isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                  }`} 
                />
                <span 
                  className={`text-xs mt-1 font-medium transition-colors duration-200 ${
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
  );
};

export default BottomNav;
