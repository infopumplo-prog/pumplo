import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Lock, Heart, GripHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useUserProfile } from '@/hooks/useUserProfile';
import { usePublishedGyms } from '@/hooks/usePublishedGyms';
import { useFavoriteGyms } from '@/hooks/useFavoriteGyms';
import OnboardingWarning from '@/components/OnboardingWarning';
import OnboardingDrawer from '@/components/OnboardingDrawer';
import GymMap from '@/components/map/GymMap';
import GymListItem from '@/components/map/GymListItem';
import GymProfilePreview from '@/components/business/GymProfilePreview';
import { Gym, OpeningHours } from '@/hooks/useGym';
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';
import { isGymCurrentlyOpen } from '@/lib/gymUtils';
import { cn } from '@/lib/utils';
import PageTransition from '@/components/PageTransition';
import MapPageSkeleton from '@/components/skeletons/MapPageSkeleton';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';

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

const Map = () => {
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const { gyms, isLoading } = usePublishedGyms();
  const { favorites, toggleFavorite, isFavorite } = useFavoriteGyms();
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [hasGpsAccess, setHasGpsAccess] = useState<boolean | null>(null);
  const [selectedGym, setSelectedGym] = useState<Gym | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const isOnboardingComplete = profile?.onboarding_completed ?? false;

  // Get user location
  useEffect(() => {
    if (!navigator.geolocation) {
      setHasGpsAccess(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setHasGpsAccess(true);
      },
      () => {
        setHasGpsAccess(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
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
      <div className="fixed inset-0 bg-background">
        {/* Fullscreen Map */}
        <div className="absolute inset-0">
          <GymMap
            gyms={gyms}
            userLocation={userLocation}
            onGymSelect={handleGymSelect}
            selectedGymId={selectedGym?.id}
          />
        </div>

        {/* Bottom Pull-up Sheet for Gym List */}
        <Sheet>
          <SheetTrigger asChild>
            <button className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-card border border-border shadow-lg rounded-full px-6 py-3 flex items-center gap-2">
              <GripHorizontal className="w-5 h-5 text-muted-foreground" />
              <span className="font-medium text-foreground">
                {hasGpsAccess ? 'Posilovny poblíž' : 'Zobrazit posilovny'}
              </span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl px-0 pt-0">
            <div className="flex flex-col h-full">
              {/* Handle */}
              <div className="flex justify-center py-3">
                <div className="w-12 h-1.5 bg-muted rounded-full" />
              </div>
              
              {/* Search Bar */}
              <div className="px-4 pb-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Hledat posilovny..."
                    className="pl-12"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* Gym List */}
              <div className="flex-1 overflow-y-auto px-4 pb-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  {hasGpsAccess ? 'Posilovny poblíž' : 'Posilovny'}
                </h3>
                
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 animate-pulse">
                        <div className="w-12 h-12 bg-muted rounded-full" />
                        <div className="flex-1">
                          <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                          <div className="h-3 bg-muted rounded w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : sortedGyms.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchQuery ? 'Žádné posilovny nenalezeny' : 'Zatím nejsou k dispozici žádné posilovny'}
                  </div>
                ) : (
                  <div className="space-y-3">
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
            </div>
          </SheetContent>
        </Sheet>

        {/* Gym Detail Drawer */}
        <Drawer open={!!selectedGym} onOpenChange={(open) => !open && setSelectedGym(null)}>
          <DrawerContent className="max-h-[90vh] border-0">
            <div className="overflow-y-auto -mt-6">
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
                      className="flex-1"
                      disabled={!selectedGymIsOpen}
                    >
                      {selectedGymIsOpen ? 'Vybrat posilovnu' : 'Posilovna je zavřená'}
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
