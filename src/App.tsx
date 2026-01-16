import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { GymProvider } from "@/contexts/GymContext";
import { useUserRole } from "@/hooks/useUserRole";
import ErrorBoundary from "@/components/ErrorBoundary";
import AppLayout from "@/components/AppLayout";
import Auth from "@/pages/Auth";
import Index from "@/pages/Index";
import Map from "@/pages/Map";
import Profile from "@/pages/Profile";
import NotFound from "@/pages/NotFound";
import Forbidden from "@/pages/Forbidden";
import Dashboard from "@/pages/admin/Dashboard";
import UsersManagement from "@/pages/admin/UsersManagement";
import GymsManagement from "@/pages/admin/GymsManagement";
import AdminGymDetail from "@/pages/admin/AdminGymDetail";
import MachinesManagement from "@/pages/admin/MachinesManagement";
import ExercisesManagement from "@/pages/admin/ExercisesManagement";
import ImportExercises from "@/pages/admin/ImportExercises";
import ImportMachines from "@/pages/admin/ImportMachines";
import GymDashboard from "@/pages/business/GymDashboard";
import GymMachines from "@/pages/business/GymMachines";
import GymSettings from "@/pages/business/GymSettings";
import Training from "@/pages/Training";
import WorkoutHistory from "@/pages/WorkoutHistory";
import Install from "@/pages/Install";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

const LoadingSpinner = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return <LoadingSpinner />;
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading: authLoading } = useAuth();
  const { role, isLoading: roleLoading } = useUserRole();
  
  if (authLoading || roleLoading) {
    return <LoadingSpinner />;
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  if (role !== 'admin') {
    return <Forbidden requiredRole="admin" />;
  }
  
  return <>{children}</>;
};

const BusinessLayout = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { role, isLoading: roleLoading } = useUserRole();
  
  if (authLoading || roleLoading) {
    return <LoadingSpinner />;
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  // Only business role can access business pages
  if (role !== 'business') {
    return <Forbidden requiredRole="business" />;
  }
  
  return (
    <GymProvider>
      <Outlet />
    </GymProvider>
  );
};

const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return <LoadingSpinner />;
  }
  
  if (user) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
    <Route path="/install" element={<Install />} />
    <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
      <Route path="/" element={<Index />} />
      <Route path="/map" element={<Map />} />
      <Route path="/training" element={<Training />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/profile/history" element={<WorkoutHistory />} />
    </Route>
    
    {/* Admin Routes */}
    <Route path="/admin" element={<AdminRoute><Dashboard /></AdminRoute>} />
    <Route path="/admin/users" element={<AdminRoute><UsersManagement /></AdminRoute>} />
    <Route path="/admin/gyms" element={<AdminRoute><GymsManagement /></AdminRoute>} />
    <Route path="/admin/gym/:id" element={<AdminRoute><AdminGymDetail /></AdminRoute>} />
    <Route path="/admin/machines" element={<AdminRoute><MachinesManagement /></AdminRoute>} />
    <Route path="/admin/exercises" element={<AdminRoute><ExercisesManagement /></AdminRoute>} />
    <Route path="/admin/import" element={<AdminRoute><ImportExercises /></AdminRoute>} />
    <Route path="/admin/import-machines" element={<AdminRoute><ImportMachines /></AdminRoute>} />
    
    {/* Business Routes - share GymProvider via BusinessLayout */}
    <Route element={<BusinessLayout />}>
      <Route path="/business" element={<GymDashboard />} />
      <Route path="/business/machines" element={<GymMachines />} />
      <Route path="/business/settings" element={<GymSettings />} />
    </Route>
    
    {/* Fallback */}
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
