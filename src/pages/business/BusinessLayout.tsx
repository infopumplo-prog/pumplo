import { ReactNode } from 'react';
import { Link, useLocation, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useUserRole } from '@/hooks/useUserRole';
import { Building2, Dumbbell, ArrowLeft, Loader2, Settings } from 'lucide-react';

interface BusinessLayoutProps {
  children: ReactNode;
}

const BusinessLayout = ({ children }: BusinessLayoutProps) => {
  const { isBusiness, isLoading } = useUserRole();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isBusiness) {
    return <Navigate to="/" replace />;
  }

  const navItems = [
    { path: '/business', icon: Building2, label: 'Posilňovňa' },
    { path: '/business/machines', icon: Dumbbell, label: 'Stroje' },
    { path: '/business/settings', icon: Settings, label: 'Nastavenia' },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20">
      {/* Minimal Top Bar */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link 
            to="/" 
            className="flex items-center justify-center w-9 h-9 rounded-full bg-muted hover:bg-muted/80 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-semibold">Business</h1>
        </div>
      </header>

      {/* Content */}
      <motion.main
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex-1 px-4 py-2"
      >
        {children}
      </motion.main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4">
        <div className="bg-card/95 backdrop-blur-lg border border-border rounded-2xl shadow-lg mx-auto max-w-md">
          <div className="flex items-center justify-around py-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex flex-col items-center gap-1 px-4 py-2 relative rounded-xl transition-colors ${
                    isActive ? 'bg-primary/10' : ''
                  }`}
                >
                  <item.icon 
                    className={`w-5 h-5 transition-colors ${
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    }`} 
                  />
                  <span 
                    className={`text-xs font-medium transition-colors ${
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
};

export default BusinessLayout;
