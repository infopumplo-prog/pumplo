import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Search, Lock, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useUserProfile } from '@/hooks/useUserProfile';
import { usePublishedGyms } from '@/hooks/usePublishedGyms';
import OnboardingWarning from '@/components/OnboardingWarning';
import OnboardingDrawer from '@/components/OnboardingDrawer';
import GymMap from '@/components/map/GymMap';
import GymListItem from '@/components/map/GymListItem';
import GymProfilePreview from '@/components/business/GymProfilePreview';
import { Gym } from '@/hooks/useGym';
import { Drawer, DrawerContent } from '@/components/ui/drawer';

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
  const { profile } = useUserProfile();
  const { gyms, isLoading } = usePublishedGyms();
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
  const sortedGyms = useCallback(() => {
    let filtered = gyms;
    
    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = gyms.filter(gym => 
        gym.name.toLowerCase().includes(query) ||
        gym.address?.toLowerCase().includes(query)
      );
    }

    // Sort by distance or alphabetically
    if (userLocation && hasGpsAccess) {
      return filtered
        .map(gym => ({
          gym,
          distance: calculateDistance(userLocation.lat, userLocation.lng, gym.latitude, gym.longitude),
        }))
        .sort((a, b) => a.distance - b.distance);
    } else {
      return filtered
        .map(gym => ({ gym, distance: undefined }))
        .sort((a, b) => a.gym.name.localeCompare(b.gym.name, 'cs'));
    }
  }, [gyms, userLocation, hasGpsAccess, searchQuery])();

  const handleGymSelect = (gym: Gym) => {
    setSelectedGym(gym);
  };

  if (!isOnboardingComplete) {
    return (
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
    );
  }

  return (
    <div className="min-h-screen bg-background safe-top pb-24">
      {/* Header */}
      <div className="px-6 pt-8 pb-4">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-2xl font-bold text-foreground mb-4">Mapa</h1>
          
          {/* Search */}
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
        </motion.div>
      </div>

      {/* Map */}
      <motion.div
        className="mx-6"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <GymMap
          gyms={gyms}
          userLocation={userLocation}
          onGymSelect={handleGymSelect}
          selectedGymId={selectedGym?.id}
        />
      </motion.div>

      {/* Nearby Gyms List */}
      <motion.div
        className="px-6 py-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
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
            {sortedGyms.map(({ gym, distance }) => (
              <GymListItem
                key={gym.id}
                gym={gym}
                distance={distance}
                onClick={() => handleGymSelect(gym)}
              />
            ))}
          </div>
        )}
      </motion.div>

      {/* Gym Detail Drawer */}
      <Drawer open={!!selectedGym} onOpenChange={(open) => !open && setSelectedGym(null)}>
        <DrawerContent className="max-h-[85vh]">
          <div className="overflow-y-auto">
            {selectedGym && (
              <div className="pb-6">
                <GymProfilePreview gym={selectedGym} />
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default Map;
