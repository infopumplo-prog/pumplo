import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import Home from './Home';

const Index = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { role, isLoading: roleLoading } = useUserRole();

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Business uživatel → /business
  if (role === 'business') {
    return <Navigate to="/business" replace />;
  }

  // Admin uživatel → /admin
  if (role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  return <Home />;
};

export default Index;
