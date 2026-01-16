import { ReactNode } from 'react';
import { Link, useLocation, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useUserRole } from '@/hooks/useUserRole';
import { LayoutDashboard, Users, Dumbbell, ArrowLeft, Loader2, Activity, Building2 } from 'lucide-react';

interface AdminLayoutProps {
  children: ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const { isAdmin, isLoading } = useUserRole();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const navItems = [
    { path: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/admin/users', icon: Users, label: 'Používatelia' },
    { path: '/admin/gyms', icon: Building2, label: 'Posilovne' },
    { path: '/admin/machines', icon: Dumbbell, label: 'Stroje' },
    { path: '/admin/exercises', icon: Activity, label: 'Cviky' },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20">
      {/* Minimal Top Bar - just back button */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link 
            to="/" 
            className="flex items-center justify-center w-9 h-9 rounded-full bg-muted hover:bg-muted/80 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-semibold">Admin</h1>
        </div>
      </header>

      {/* Content - scrollable area */}
      <motion.main
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex-1 px-4 py-2"
      >
        {children}
      </motion.main>

      {/* Bottom Navigation - Apple-style */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-4">
        <div className="bg-card/95 backdrop-blur-lg border border-border rounded-2xl shadow-lg mx-auto max-w-lg overflow-x-auto">
          <div className="flex items-center justify-between py-2 px-1 min-w-max">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex flex-col items-center gap-0.5 px-3 py-1.5 relative rounded-xl transition-colors flex-shrink-0 ${
                    isActive ? 'bg-primary/10' : ''
                  }`}
                >
                  <item.icon 
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    }`} 
                  />
                  <span 
                    className={`text-[10px] font-medium transition-colors whitespace-nowrap ${
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

export default AdminLayout;
