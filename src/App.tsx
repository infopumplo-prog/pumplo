import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { StatusBar } from "@capacitor/status-bar";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { GymProvider } from "@/contexts/GymContext";
import { useUserRole } from "@/hooks/useUserRole";
import ErrorBoundary from "@/components/ErrorBoundary";
import AppLayout from "@/components/AppLayout";
import UpdateBanner from "@/components/UpdateBanner";
import { setUpdateBannerCallback, updateSW } from "@/main";
import { forceAppRefresh } from "@/lib/appVersion";
import Auth from "@/pages/Auth";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
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
import SharedPlan from "@/pages/SharedPlan";
import SharedExercisePage from "@/pages/SharedExercise";
import MyExercisesPage from "@/pages/MyExercises";
import ResetPassword from "@/pages/ResetPassword";
import { usePushRegistration } from "@/hooks/usePushRegistration";
import { usePushNavigation } from "@/hooks/usePushNavigation";
import { flushWorkoutSaveQueue } from "@/lib/workoutSaveQueue";
import WebGate from "@/components/WebGate";

const StationPage = lazy(() => import('./pages/StationPage'));
const FlyerLanding = lazy(() => import('./pages/FlyerLanding'));

// Handles deep links: com.pumplo.app://plan/{token} (custom scheme) and
// https://app.pumplo.com/plan/{token} | /cvik/{id} (Universal Links, iOS applinks)
const PlanDeepLinkNavigator = () => {
  const navigate = useNavigate();
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handle = (url: string) => {
      const m = url.match(/\/(plan|cvik)\/([^/?#]+)/);
      if (m) navigate(`/${m[1]}/${m[2]}`);
    };
    const listener = CapApp.addListener('appUrlOpen', ({ url }) => handle(url));
    // Studený start: appUrlOpen se vyvolá dřív, než je posluchač zaregistrovaný →
    // odkaz, kterým se appka spustila, vzít z getLaunchUrl (David 21. 9.: „otevře apku, ale ne ten trénink").
    CapApp.getLaunchUrl().then((r) => { if (r?.url) handle(r.url); }).catch(() => {});
    return () => { listener.then(h => h.remove()); };
  }, [navigate]);
  return null;
};

// Po přihlášení/registraci vrátí uživatele na sdílený plán, jehož uložení bylo rozdělané
// (localStorage 'pumplo_pending_plan_save'), ať odkaz z WhatsAppu „nezmizí" (David 21. 9.).
const PendingSharedPlanResume = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    let pending: string | null = null;
    try { pending = localStorage.getItem('pumplo_pending_plan_save'); } catch { /* noop */ }
    if (pending && !location.pathname.startsWith('/plan/') && !location.pathname.startsWith('/auth')) {
      navigate(`/plan/${pending}`);
    }
  }, [user, location.pathname, navigate]);
  return null;
};

// Navigates to /reset-password when a password reset deep link is detected
const PasswordResetNavigator = () => {
  const { pendingPasswordReset } = useAuth();
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (pendingPasswordReset && !handled.current) {
      handled.current = true;
      navigate('/reset-password', { replace: true });
    }
    if (!pendingPasswordReset) {
      handled.current = false;
    }
  }, [pendingPasswordReset, navigate]);

  return null;
};

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
  const { user, isLoading: authLoading, isRegistering } = useAuth();
  const { role, isLoading: roleLoading } = useUserRole();

  if (authLoading || roleLoading) {
    return <LoadingSpinner />;
  }

  // Během registrace se `user` objeví dřív, než je hotový profil a plán —
  // přesměrování domů musí počkat. Formulář ale musí zůstat namontovaný:
  // výměna za spinner by zahodila stav dotazníku i chybovou hlášku.
  if (user && !isRegistering) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// Retries workout saves that failed offline (F1): on app start, on native
// resume, and when the network comes back.
const SaveQueueFlusher = () => {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    flushWorkoutSaveQueue();
    const retry = () => { flushWorkoutSaveQueue(); };
    window.addEventListener('online', retry);
    let listener: Promise<{ remove: () => void }> | null = null;
    if (Capacitor.isNativePlatform()) {
      listener = CapApp.addListener('resume', retry);
    }
    return () => {
      window.removeEventListener('online', retry);
      listener?.then(h => h.remove());
    };
  }, [user]);
  return null;
};

// Gym data (pricing, opening hours, photos) is edited in the admin app, so a phone that has been
// sitting in the background would otherwise keep showing whatever it cached. Refetch on resume and
// when the network comes back.
const GymDataRefresher = () => {
  const queryClient = useQueryClient();
  useEffect(() => {
    const refresh = () => { queryClient.invalidateQueries({ queryKey: ['published-gyms'] }); };
    window.addEventListener('online', refresh);
    let listener: Promise<{ remove: () => void }> | null = null;
    if (Capacitor.isNativePlatform()) {
      listener = CapApp.addListener('resume', refresh);
    }
    return () => {
      window.removeEventListener('online', refresh);
      listener?.then(h => h.remove());
    };
  }, [queryClient]);
  return null;
};

const AppRoutes = () => {
  usePushRegistration();
  usePushNavigation();
  return (
  <>
    <PasswordResetNavigator />
    <PlanDeepLinkNavigator />
    <PendingSharedPlanResume />
    <SaveQueueFlusher />
    <GymDataRefresher />
  <WebGate>
  <Routes>
    <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/privacy" element={<Privacy />} />
    <Route path="/terms" element={<Terms />} />
    <Route path="/install" element={<Install />} />
    <Route path="/plan/:token" element={<SharedPlan />} />
    <Route path="/cvik/:id" element={<SharedExercisePage />} />
    <Route path="/go/:code" element={
      <Suspense fallback={
        <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#0B1222' }}>
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#4CC9FF' }} />
        </div>
      }>
        <FlyerLanding />
      </Suspense>
    } />
    <Route path="/s/:code" element={
      <Suspense fallback={
        <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#0B1222' }}>
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#4CC9FF' }} />
        </div>
      }>
        <StationPage />
      </Suspense>
    } />
    {/* Moje cviky = plná stránka bez spodní lišty a feedbacku (jen auth guard) */}
    <Route path="/profile/exercises" element={<ProtectedRoute><MyExercisesPage /></ProtectedRoute>} />
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
  </WebGate>
  </>
  );
};

const App = () => {
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);

  useEffect(() => {
    setUpdateBannerCallback(() => {
      setShowUpdateBanner(true);
    });

    if (Capacitor.isNativePlatform()) {
      StatusBar.setOverlaysWebView({ overlay: true });
      // Styl textu status baru řídí ThemeProvider podle aktivního tématu.
    }
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
      <ThemeProvider>
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
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
