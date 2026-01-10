import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, useMotionValue, useAnimationControls, PanInfo } from 'framer-motion';
import { Search, Lock, Heart, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useUserProfile } from '@/hooks/useUserProfile';
import { usePublishedGyms } from '@/hooks/usePublishedGyms';
import { useFavoriteGyms } from '@/hooks/useFavoriteGyms';
import { useToast } from '@/hooks/use-toast';
import OnboardingWarning from '@/components/OnboardingWarning';
import OnboardingDrawer from '@/components/OnboardingDrawer';
import GymMap from '@/components/map/GymMap';
import GymListItem from '@/components/map/GymListItem';
import GymProfilePreview from '@/components/business/GymProfilePreview';
import { Gym, OpeningHours } from '@/hooks/useGym';
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

// Snap points for the drawer (distance from top of screen)
const BOTTOM_NAV_HEIGHT = 100; // Height of bottom nav + padding
const getSnapPoints = () => {
  if (typeof window === 'undefined') return { collapsed: 500, half: 300, full: 60 };
  const vh = window.innerHeight;
  return {
    collapsed: vh - BOTTOM_NAV_HEIGHT - 100, // Just handle visible (lower default)
    half: vh * 0.45, // Half screen
    full: 60, // Almost full screen
  };
};

const Map = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile, isLoading: isProfileLoading, updateProfile } = useUserProfile();
  const { gyms, isLoading } = usePublishedGyms();
  const { favorites, toggleFavorite, isFavorite } = useFavoriteGyms();
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [hasGpsAccess, setHasGpsAccess] = useState<boolean | null>(null);
  const [selectedGym, setSelectedGym] = useState<Gym | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSelectingGym, setIsSelectingGym] = useState(false);
  
  const controls = useAnimationControls();
  const y = useMotionValue(getSnapPoints().collapsed);
  const [currentSnap, setCurrentSnap] = useState<'collapsed' | 'half' | 'full'>('collapsed');

  const isOnboardingComplete = profile?.onboarding_completed ?? false;

  // Snap to nearest point
  const snapTo = useCallback((snapPoint: 'collapsed' | 'half' | 'full') => {
    const snaps = getSnapPoints();
    setCurrentSnap(snapPoint);
    controls.start({ 
      y: snaps[snapPoint],
      transition: { type: 'spring', damping: 30, stiffness: 400 }
    });
  }, [controls]);

  // Handle drag end
  const handleDragEnd = (_: any, info: PanInfo) => {
    const snaps = getSnapPoints();
    const currentY = y.get();
    const velocity = info.velocity.y;
    
    // Determine snap based on position and velocity
    if (velocity < -500) {
      // Fast upward swipe
      if (currentSnap === 'collapsed') snapTo('half');
      else snapTo('full');
    } else if (velocity > 500) {
      // Fast downward swipe
      if (currentSnap === 'full') snapTo('half');
      else snapTo('collapsed');
    } else {
      // Snap to nearest
      const distances = {
        collapsed: Math.abs(currentY - snaps.collapsed),
        half: Math.abs(currentY - snaps.half),
        full: Math.abs(currentY - snaps.full),
      };
      
      const nearest = Object.entries(distances).reduce((a, b) => 
        a[1] < b[1] ? a : b
      )[0] as 'collapsed' | 'half' | 'full';
      
      snapTo(nearest);
    }
  };

  // Initialize position
  useEffect(() => {
    const snaps = getSnapPoints();
    controls.set({ y: snaps.collapsed });
  }, [controls]);

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
        // Don't set hasGpsAccess to false yet, watchPosition might work
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
        // Only set to false if we never got a position
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

  // Sort and filter gyms
  const sortedGyms = useMemo(() => {
    let filtered = gyms;
    
    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = gyms.filter(gym => 
        gym.name.toLowerCase().includes(query) ||
        gym.address?.toLowerCase().includes(query)
      );
    }

    // Calculate distances and open status
    const gymsWithMeta = filtered.map(gym => {
      const hours = gym.opening_hours as OpeningHours;
      const isOpen = isGymCurrentlyOpen(hours);
      const distance = userLocation && hasGpsAccess
        ? calculateDistance(userLocation.lat, userLocation.lng, gym.latitude, gym.longitude)
        : undefined;
      const isFav = isFavorite(gym.id);
      
      return { gym, distance, isOpen, isFavorite: isFav };
    });

    // Sort: favorites first, then open gyms, then by distance/alphabetically
    return gymsWithMeta.sort((a, b) => {
      // Favorites always first
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      
      // Open gyms before closed ones
      if (a.isOpen && !b.isOpen) return -1;
      if (!a.isOpen && b.isOpen) return 1;
      
      // Then by distance or alphabetically
      if (a.distance !== undefined && b.distance !== undefined) {
        return a.distance - b.distance;
      }
      return a.gym.name.localeCompare(b.gym.name, 'cs');
    });
  }, [gyms, userLocation, hasGpsAccess, searchQuery, favorites, isFavorite]);

  const handleGymSelect = (gym: Gym) => {
    setSelectedGym(gym);
  };

  const selectedGymIsOpen = selectedGym 
    ? isGymCurrentlyOpen(selectedGym.opening_hours as OpeningHours)
    : false;

  const isCurrentlySelectedGym = selectedGym?.id === profile?.selected_gym_id;

  const handleSelectGymForTraining = async () => {
    if (!selectedGym || !selectedGymIsOpen) return;
    
    setIsSelectingGym(true);
    try {
      await updateProfile({ selected_gym_id: selectedGym.id });
      toast({
        title: 'Posilovna vybrána',
        description: `${selectedGym.name} byla nastavena jako tvoje posilovna pro trénink.`
      });
      setSelectedGym(null);
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
        <div className="absolute inset-0" style={{ bottom: BOTTOM_NAV_HEIGHT + 120 }}>
          <GymMap
            gyms={gyms}
            userLocation={userLocation}
            onGymSelect={handleGymSelect}
            selectedGymId={selectedGym?.id}
          />
        </div>

        {/* Bottom Draggable Drawer for Gym List */}
        <motion.div
          className="fixed left-0 right-0 bg-card rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.15)] z-40"
          style={{ 
            y,
            height: '100vh',
            bottom: BOTTOM_NAV_HEIGHT,
          }}
          drag="y"
          dragConstraints={{
            top: getSnapPoints().full,
            bottom: getSnapPoints().collapsed,
          }}
          dragElastic={0.1}
          onDragEnd={handleDragEnd}
          animate={controls}
        >
          {/* Handle */}
          <div 
            className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none"
            onDoubleClick={() => snapTo(currentSnap === 'collapsed' ? 'half' : 'collapsed')}
          >
            <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full" />
          </div>
          
          {/* Search Bar */}
          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Hledat posilovny..."
                className="pl-12"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => snapTo('half')}
              />
            </div>
          </div>

          {/* Gym List */}
          <div 
            className="px-4 overflow-y-auto overscroll-contain"
            style={{ height: 'calc(100vh - 120px)' }}
          >
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-background border border-border rounded-xl p-4 flex items-center gap-4 animate-pulse">
                    <div className="w-12 h-12 bg-muted rounded-full" />
                    <div className="flex-1">
                      <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : sortedGyms.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                {searchQuery ? 'Žádné posilovny nenalezeny' : 'Zatím nejsou k dispozici žádné posilovny'}
              </div>
            ) : (
              <div className="space-y-3 pb-8">
                {sortedGyms.map(({ gym, distance, isFavorite: isFav }) => (
                  <GymListItem
                    key={gym.id}
                    gym={gym}
                    distance={distance}
                    onClick={() => handleGymSelect(gym)}
                    isFavorite={isFav}
                  />
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Gym Detail Drawer */}
        <Drawer open={!!selectedGym} onOpenChange={(open) => !open && setSelectedGym(null)}>
          <DrawerContent className="max-h-[90vh] border-0 z-[100]">
            <div className="overflow-y-auto max-h-[85vh] -mt-6">
              {selectedGym && (
                <>
                  <GymProfilePreview gym={selectedGym} variant="drawer" showBadge={false} />
                  
                  {/* Action Buttons */}
                  <div className="px-4 pb-6 pt-2 flex gap-3">
                    <Button
                      variant="outline"
                      size="lg"
                      className="flex-shrink-0"
                      onClick={() => toggleFavorite(selectedGym.id)}
                    >
                      <Heart 
                        className={cn(
                          "w-5 h-5",
                          isFavorite(selectedGym.id) && "fill-destructive text-destructive"
                        )} 
                      />
                    </Button>
                    <Button
                      size="lg"
                      className={cn(
                        "flex-1 gap-2",
                        isCurrentlySelectedGym && "bg-green-500 hover:bg-green-600"
                      )}
                      disabled={!selectedGymIsOpen || isSelectingGym}
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
                      ) : selectedGymIsOpen ? (
                        'Vybrat pro trénink'
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