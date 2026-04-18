import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUserProfile } from '@/hooks/useUserProfile';
import { usePublishedGyms, PublicGym } from '@/hooks/usePublishedGyms';
import { useFavoriteGyms } from '@/hooks/useFavoriteGyms';
import { useToast } from '@/hooks/use-toast';
import OnboardingWarning from '@/components/OnboardingWarning';
import OnboardingDrawer from '@/components/OnboardingDrawer';
import GymMap, { GymMapHandle } from '@/components/map/GymMap';
import GymQuickPreview from '@/components/map/GymQuickPreview';
import GymProfilePreview from '@/components/business/GymProfilePreview';
import { GymFiltersDrawer, GymFilters, DEFAULT_FILTERS, countActiveFilters } from '@/components/map/GymFiltersDrawer';
import { OpeningHours } from '@/hooks/useGym';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { isGymCurrentlyOpen } from '@/lib/gymUtils';
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
  const [gymMachinesMap, setGymMachinesMap] = useState<Record<string, string[]>>({});
  const [availableMachines, setAvailableMachines] = useState<string[]>([]);

  useEffect(() => {
    const fetchMachines = async () => {
      const { data } = await (await import('@/integrations/supabase/client')).supabase
        .from('gym_machines')
        .select('gym_id, machines(name)');
      if (!data) return;
      const map: Record<string, string[]> = {};
      const allNames = new Set<string>();
      data.forEach((row: any) => {
        const name = row.machines?.name;
        if (!name) return;
        if (!map[row.gym_id]) map[row.gym_id] = [];
        map[row.gym_id].push(name.toLowerCase());
        allNames.add(name);
      });
      setGymMachinesMap(map);
      setAvailableMachines([...allNames].sort());
    };
    fetchMachines();
  }, []);
  const { toggleFavorite, isFavorite } = useFavoriteGyms();
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [hasGpsAccess, setHasGpsAccess] = useState<boolean | null>(null);
  const [isSelectingGym, setIsSelectingGym] = useState(false);
  const mapHandleRef = useRef<GymMapHandle | null>(null);

  // State for two-step interaction
  const [quickPreviewGym, setQuickPreviewGym] = useState<PublicGym | null>(null);
  const [detailGym, setDetailGym] = useState<PublicGym | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<GymFilters>(DEFAULT_FILTERS);

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

  // Center on user - re-request location if needed
  const handleCenterOnUser = () => {
    if (userLocation) {
      mapHandleRef.current?.centerOnUser();
      return;
    }

    // Try to get location again
    if (!navigator.geolocation) {
      toast({ title: 'Geolokace není podporována', variant: 'destructive' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
        setUserLocation(loc);
        setHasGpsAccess(true);
        // Center after state update - use small timeout
        setTimeout(() => mapHandleRef.current?.centerOnUser(), 100);
      },
      (error) => {
        console.log('Geolocation error:', error.code, error.message);
        if (error.code === 1) {
          toast({
            title: 'Přístup k poloze zamítnut',
            description: 'Povol přístup k poloze v nastavení prohlížeče.',
            variant: 'destructive'
          });
        } else {
          toast({
            title: 'Nepodařilo se získat polohu',
            description: 'Zkontroluj připojení nebo nastavení GPS.',
            variant: 'destructive'
          });
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Compute dynamic slider maximums from real data
  const maxSinglePrice = useMemo(() => {
    let max = 200;
    gyms.forEach(gym => {
      ((gym.pricing as any)?.single_entries || []).forEach((e: any) =>
        (e.prices || []).forEach((p: any) => { if (p.price > max) max = p.price; })
      );
    });
    return Math.ceil(max / 10) * 10;
  }, [gyms]);

  const getMonthlyPrice = (m: any): number | null => {
    const name = (m.name || '').toLowerCase();
    if (/\d+x\s*vstup|solárium|ručník|zapůjč/i.test(name)) return null;
    const price = m.prices?.[0]?.price;
    if (!price) return null;
    const multi = name.match(/\((\d+)\s*měsíc/);
    if (multi) return price / parseInt(multi[1]);
    if (/měsíční|měsíc/i.test(name)) return price;
    return null;
  };

  const maxMembershipPrice = useMemo(() => {
    let max = 2000;
    gyms.forEach(gym => {
      ((gym.pricing as any)?.memberships || []).forEach((m: any) => {
        const monthly = getMonthlyPrice(m);
        if (monthly && monthly > max) max = monthly;
      });
    });
    return Math.ceil(max / 50) * 50;
  }, [gyms]);

  // Apply filters
  const filteredGyms = gyms.filter(gym => {
    if (filters.openNow && !isGymCurrentlyOpen(gym.opening_hours as OpeningHours)) return false;
    if (filters.verifiedOnly && !gym.is_verified) return false;
    if (filters.distanceLimit !== null) {
      const dist = getGymDistance(gym);
      if (dist === undefined || dist > filters.distanceLimit) return false;
    }
    if (filters.singlePriceLimit !== null) {
      const prices = ((gym.pricing as any)?.single_entries || []).flatMap((e: any) => (e.prices || []).map((p: any) => p.price as number));
      const minPrice = prices.length ? Math.min(...prices) : null;
      if (!minPrice || minPrice > filters.singlePriceLimit) return false;
    }
    if (filters.privateOnly) {
      const gymServices = (gym.services || []).map(s => s.toLowerCase());
      if (!gymServices.includes('soukromý') && !gymServices.includes('private')) return false;
    }
    if (filters.membershipPriceLimit !== null) {
      const monthlyPrices = ((gym.pricing as any)?.memberships || [])
        .map((m: any) => getMonthlyPrice(m)).filter(Boolean) as number[];
      const minMonthly = monthlyPrices.length ? Math.min(...monthlyPrices) : null;
      if (!minMonthly || minMonthly > filters.membershipPriceLimit) return false;
    }
    if (filters.services.length > 0) {
      const gymServices = (gym.services || []).map(s => s.toLowerCase());
      if (!filters.services.every(s => gymServices.includes(s.toLowerCase()))) return false;
    }
    if (filters.cards.length > 0) {
      const gymServices = (gym.services || []).map(s => s.toLowerCase());
      if (!filters.cards.every(c => gymServices.includes(c.toLowerCase()))) return false;
    }
    if (filters.machines.length > 0) {
      const gymMachines = gymMachinesMap[gym.id] || [];
      if (!filters.machines.every(m => gymMachines.includes(m.toLowerCase()))) return false;
    }
    return true;
  });

  const activeFilterCount = countActiveFilters(filters);

  const detailGymIsOpen = detailGym
    ? isGymCurrentlyOpen(detailGym.opening_hours as OpeningHours)
    : false;

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
      navigate('/');
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
            gyms={filteredGyms}
            userLocation={userLocation}
            onGymSelect={handleGymSelect}
            selectedGymId={quickPreviewGym?.id || detailGym?.id}
            mapHandleRef={mapHandleRef}
          />

          {/* Location prompt banner */}
          {hasGpsAccess === false && (
            <button
              onClick={handleCenterOnUser}
              className="absolute top-4 left-4 right-16 z-50 flex items-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl shadow-lg text-sm font-medium active:scale-[0.98] transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 2v4"/><path d="M12 18v4"/><path d="M2 12h4"/><path d="M18 12h4"/>
              </svg>
              Povolit polohu pro zobrazení vzdálenosti
            </button>
          )}

          {/* Filter button */}
          <div className="absolute top-4 right-[60px] z-50">
            <button
              onClick={() => setFiltersOpen(true)}
              className="relative w-11 h-11 bg-background rounded-full shadow-lg flex items-center justify-center border border-border hover:bg-muted active:scale-95 transition-all"
              aria-label="Filtrovat posilovny"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={activeFilterCount > 0 ? '#4CC9FF' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
              </svg>
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Center on user button */}
          <button
            onClick={handleCenterOnUser}
            className="absolute top-4 right-4 z-50 w-11 h-11 bg-background rounded-full shadow-lg flex items-center justify-center border border-border hover:bg-muted active:scale-95 transition-all"
            aria-label="Vycentrovat na mou polohu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={userLocation ? "#4CC9FF" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 2v4"/>
              <path d="M12 18v4"/>
              <path d="M2 12h4"/>
              <path d="M18 12h4"/>
            </svg>
          </button>
        </div>

        {/* Quick Preview Card - positioned above bottom nav */}
        {quickPreviewGym && (
          <div className="fixed left-4 right-4 z-50" style={{ bottom: BOTTOM_NAV_HEIGHT + 16 }}>
            <GymQuickPreview
              gym={quickPreviewGym}
              distance={getGymDistance(quickPreviewGym)}
              onDetailClick={handleDetailClick}
              onNavigateClick={handleNavigateClick}
              onClose={() => setQuickPreviewGym(null)}
            />
          </div>
        )}

        {/* Filters Drawer */}
        <GymFiltersDrawer
          open={filtersOpen}
          onOpenChange={setFiltersOpen}
          filters={filters}
          onChange={setFilters}
          hasGps={!!userLocation}
          maxSinglePrice={maxSinglePrice}
          maxMembershipPrice={maxMembershipPrice}
          availableMachines={availableMachines}
        />

        {/* Fullscreen Gym Detail Drawer */}
        <Drawer open={!!detailGym} onOpenChange={(open) => !open && setDetailGym(null)}>
          <DrawerContent className="max-h-[90vh] border-0 z-[100]">
            <div className="overflow-y-auto max-h-[85vh] -mt-6">
              {detailGym && (
                <GymProfilePreview
                  gym={detailGym}
                  variant="drawer"
                  showBadge={false}
                  onSelectGym={handleSelectGymForTraining}
                  isSelectingGym={isSelectingGym}
                  isGymOpen={detailGymIsOpen}
                  isFavorite={isFavorite(detailGym.id)}
                  onToggleFavorite={() => toggleFavorite(detailGym.id)}
                  onBack={() => {
                    setDetailGym(null);
                    setQuickPreviewGym(detailGym);
                  }}
                />
              )}
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </PageTransition>
  );
};

export default Map;