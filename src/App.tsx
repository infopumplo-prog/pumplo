import { useState, useEffect } from "react";
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
import UpdateBanner from "@/components/UpdateBanner";
import { setUpdateBannerCallback, updateSW } from "@/main";
import { forceAppRefresh } from "@/lib/appVersion";
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
import ExerciseSkipFeedback from "@/pages/admin/ExerciseSkipFeedback";
import DayTemplatesManagement from "@/pages/admin/DayTemplatesManagement";
import TrainingRolesManagement from "@/pages/admin/TrainingRolesManagement";
import AppFeedbackList from "@/pages/admin/AppFeedbackList";
import UserFeedbackList from "@/pages/admin/UserFeedbackList";
import GymDashboard from "@/pages/business/GymDashboard";
import GymMachines from "@/pages/business/GymMachines";
import GymSettings from "@/pages/business/GymSettings";
import GymStats from "@/pages/business/GymStats";
import Training from "@/pages/Training";
import WorkoutHistory from "@/pages/WorkoutHistory";
import MyPlan from "@/pages/MyPlan";
import Install from "@/pages/Install";
import Settings from "@/pages/Settings";
import Statistics from "@/pages/Statistics";
import CustomPlanDetail from "@/pages/CustomPlanDetail";
import CustomWorkoutPlayer from "@/pages/CustomWorkoutPlayer";
import Messages from "@/pages/Messages";
import ChatThread from "@/pages/ChatThread";
import BecomeTrainer from "@/pages/BecomeTrainer";
import TrainerProfile from "@/pages/TrainerProfile";

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
  const { user, isLoading: authLoading } = useAuth();
  const { role, isLoading: roleLoading } = useUserRole();
  
  if (authLoading || roleLoading) {
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
      <Route path="/statistics" element={<Statistics />} />
      <Route path="/training" element={<Training />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/profile/history" element={<WorkoutHistory />} />
      <Route path="/profile/plan" element={<MyPlan />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/messages" element={<Messages />} />
      <Route path="/messages/chat/:conversationId" element={<ChatThread />} />
      <Route path="/custom-plan/:id" element={<CustomPlanDetail />} />
      <Route path="/custom-workout/:id" element={<CustomWorkoutPlayer />} />
      <Route path="/become-trainer" element={<BecomeTrainer />} />
      <Route path="/trainer-profile" element={<TrainerProfile />} />
    </Route>
    
    {/* Admin & Business routes removed — use pumplo-admin.vercel.app */}
    <Route path="/admin/*" element={<Navigate to="/" replace />} />
    <Route path="/business/*" element={<Navigate to="/" replace />} />
    
    {/* Fallback */}
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => {
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);

  useEffect(() => {
    // Register callback for update banner
    setUpdateBannerCallback(() => {
      setShowUpdateBanner(true);
    });
  }, []);

  const handleUpdate = async () => {
    try {
      // Try to update via SW first
      await updateSW(true);
    } catch (e) {
      console.error('[App] SW update failed, forcing refresh:', e);
      // Fallback to force refresh
      await forceAppRefresh();
    }
  };

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          {showUpdateBanner && <UpdateBanner onUpdate={handleUpdate} />}
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
};

export default App;
