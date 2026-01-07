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
    <div className="fixed bottom-0 left-0 right-0 safe-bottom z-50 px-4 pb-2">
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
                <div className="relative flex flex-col items-center justify-center">
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute -inset-1.5 bg-primary/10 rounded-xl"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                  <Icon 
                    className={`w-5 h-5 relative z-10 transition-colors duration-200 ${
                      isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                    }`} 
                  />
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
