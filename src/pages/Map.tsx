import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Lock, Heart, Check, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useUserProfile } from '@/hooks/useUserProfile';
import { usePublishedGyms, PublicGym } from '@/hooks/usePublishedGyms';
import { useFavoriteGyms } from '@/hooks/useFavoriteGyms';
import { useToast } from '@/hooks/use-toast';
import OnboardingWarning from '@/components/OnboardingWarning';
import OnboardingDrawer from '@/components/OnboardingDrawer';
import GymMap from '@/components/map/GymMap';
import GymQuickPreview from '@/components/map/GymQuickPreview';
import GymProfilePreview from '@/components/business/GymProfilePreview';
import { OpeningHours } from '@/hooks/useGym';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { isGymCurrentlyOpen } from '@/lib/gymUtils';
import { cn } from '@/lib/utils';
import PageTransition from '@/components/PageTransition';
import MapPageSkeleton from '@/components/skeletons/MapPageSkeleton';

// Calculate distance between two points using Haversine formula
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const BOTTOM_NAV_HEIGHT = 80;

// Open native navigation app (Apple Maps on iOS, Google Maps on Android/web)
const openNavigation = (gym: PublicGym) => {
  const { latitude, longitude } = gym;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  
  const url = isIOS 
    ? `https://maps.apple.com/?daddr=${latitude},${longitude}`
    : `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  
  window.open(url, '_blank');
};

const Map = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile, isLoading: isProfileLoading, updateProfile } = useUserProfile();
  const { gyms } = usePublishedGyms();
  const { toggleFavorite, isFavorite } = useFavoriteGyms();
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [hasGpsAccess, setHasGpsAccess] = useState<boolean | null>(null);
  const [isSelectingGym, setIsSelectingGym] = useState(false);
  
  // State for two-step interaction
  const [quickPreviewGym, setQuickPreviewGym] = useState<PublicGym | null>(null);
  const [detailGym, setDetailGym] = useState<PublicGym | null>(null);

  const isOnboardingComplete = profile?.onboarding_completed ?? false;

  // Calculate distance for a specific gym
  const getGymDistance = useCallback((gym: PublicGym) => {
    if (!userLocation || !hasGpsAccess) return undefined;
    return calculateDistance(userLocation.lat, userLocation.lng, gym.latitude, gym.longitude);
  }, [userLocation, hasGpsAccess]);

  // Get user location with watchPosition for real-time updates
  useEffect(() => {
    if (!navigator.geolocation) {
      console.log('Geolocation not supported');
      setHasGpsAccess(false);
      return;
    }

    let watchId: number;

    // First try getCurrentPosition for quick initial location
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('Got initial position:', position.coords);
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setHasGpsAccess(true);
      },
      (error) => {
        console.log('getCurrentPosition error:', error.code, error.message);
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
    );

    // Also use watchPosition for continuous updates
    watchId = navigator.geolocation.watchPosition(
      (position) => {
        console.log('Watch position update:', position.coords);
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setHasGpsAccess(true);
      },
      (error) => {
        console.log('watchPosition error:', error.code, error.message);
        if (!userLocation) {
          setHasGpsAccess(false);
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );

    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  // Handle marker click - show quick preview
  const handleGymSelect = (gym: PublicGym) => {
    setQuickPreviewGym(gym);
    setDetailGym(null);
  };

  // Handle detail button click - show fullscreen detail
  const handleDetailClick = () => {
    if (quickPreviewGym) {
      setDetailGym(quickPreviewGym);
      setQuickPreviewGym(null);
    }
  };

  // Handle navigation button click
  const handleNavigateClick = () => {
    if (quickPreviewGym) {
      openNavigation(quickPreviewGym);
    }
  };

  const detailGymIsOpen = detailGym 
    ? isGymCurrentlyOpen(detailGym.opening_hours as OpeningHours)
    : false;

  const isCurrentlySelectedGym = detailGym?.id === profile?.selected_gym_id;

  const handleSelectGymForTraining = async () => {
    if (!detailGym || !detailGymIsOpen) return;
    
    setIsSelectingGym(true);
    try {
      await updateProfile({ selected_gym_id: detailGym.id });
      toast({
        title: 'Posilovna vybrána',
        description: `${detailGym.name} byla nastavena jako tvoje posilovna pro trénink.`
      });
      setDetailGym(null);
      navigate('/training');
    } catch (error) {
      toast({
        title: 'Chyba',
        description: 'Nepodařilo se vybrat posilovnu.',
        variant: 'destructive'
      });
    } finally {
      setIsSelectingGym(false);
    }
  };

  // Early returns AFTER all hooks
  if (isProfileLoading) {
    return <MapPageSkeleton />;
  }

  if (!isOnboardingComplete) {
    return (
      <PageTransition>
      <div className="min-h-screen bg-background safe-top">
        <div className="pt-4">
          <OnboardingWarning onClick={() => setOnboardingOpen(true)} />
        </div>

        <div className="flex flex-col items-center justify-center px-6 py-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
              <Lock className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Mapa je uzamčená</h2>
            <p className="text-muted-foreground mb-6">
              Pro přístup k mapě posiloven nejdříve vyplň dotazník
            </p>
            <button
              onClick={() => setOnboardingOpen(true)}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium"
            >
              Vyplnit dotazník
            </button>
          </motion.div>
        </div>

        <OnboardingDrawer open={onboardingOpen} onOpenChange={setOnboardingOpen} />
      </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="fixed inset-0 bg-background overflow-hidden">
        {/* Fullscreen Map */}
        <div className="absolute inset-0" style={{ bottom: BOTTOM_NAV_HEIGHT }}>
          <GymMap
            gyms={gyms}
            userLocation={userLocation}
            onGymSelect={handleGymSelect}
            selectedGymId={quickPreviewGym?.id || detailGym?.id}
          />
        </div>

        {/* Quick Preview Card - positioned above bottom nav */}
        {quickPreviewGym && (
          <div className="fixed left-4 right-4 z-50" style={{ bottom: BOTTOM_NAV_HEIGHT + 16 }}>
            <GymQuickPreview
              gym={quickPreviewGym}
              distance={getGymDistance(quickPreviewGym)}
              onDetailClick={handleDetailClick}
              onNavigateClick={handleNavigateClick}
            />
          </div>
        )}

        {/* Fullscreen Gym Detail Drawer */}
        <Drawer open={!!detailGym} onOpenChange={(open) => !open && setDetailGym(null)}>
          <DrawerContent className="max-h-[90vh] border-0 z-[100]">
            <div className="overflow-y-auto max-h-[85vh] -mt-6">
              {detailGym && (
                <>
                  <GymProfilePreview 
                    gym={detailGym} 
                    variant="drawer" 
                    showBadge={false}
                    onBack={() => {
                      setDetailGym(null);
                      setQuickPreviewGym(detailGym);
                    }}
                  />
                  
                  {/* Action Buttons */}
                  <div className="px-4 pb-6 pt-2 flex gap-3">
                    <Button
                      variant="outline"
                      size="lg"
                      className="flex-shrink-0"
                      onClick={() => toggleFavorite(detailGym.id)}
                    >
                      <Heart 
                        className={cn(
                          "w-5 h-5",
                          isFavorite(detailGym.id) && "fill-destructive text-destructive"
                        )} 
                      />
                    </Button>
                    <Button
                      size="lg"
                      className={cn(
                        "flex-1 gap-2",
                        isCurrentlySelectedGym && "bg-green-500 hover:bg-green-600"
                      )}
                      disabled={!detailGymIsOpen || isSelectingGym}
                      onClick={handleSelectGymForTraining}
                    >
                      {isSelectingGym ? (
                        <>
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          Vybírám...
                        </>
                      ) : isCurrentlySelectedGym ? (
                        <>
                          <Check className="w-5 h-5" />
                          Aktuální posilovna
                        </>
                      ) : detailGymIsOpen ? (
                        <>
                          <Play className="w-5 h-5" />
                          Zahájit trénink
                        </>
                      ) : (
                        'Posilovna je zavřená'
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </PageTransition>
  );
};

export default Map;