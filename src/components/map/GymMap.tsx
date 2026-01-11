import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { OpeningHours } from '@/hooks/useGym';
import { PublicGym } from '@/hooks/usePublishedGyms';
import { isGymCurrentlyOpen, isClosingSoon } from '@/lib/gymUtils';

// Fix for default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface GymMapProps {
  gyms: PublicGym[];
  userLocation: { lat: number; lng: number } | null;
  onGymSelect: (gym: PublicGym) => void;
  selectedGymId?: string;
  onCenterUser?: () => void;
}

const createGymIcon = (logoUrl: string | null, closingSoon: boolean = false) => {
  const borderColor = closingSoon ? '#f59e0b' : 'hsl(var(--primary))';
  const warningBadge = closingSoon ? `
    <div style="
      position: absolute;
      top: -4px;
      left: -4px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #f59e0b;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: pulse 2s infinite;
    ">
      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/>
        <path d="M12 9v4"/>
        <path d="M12 17h.01"/>
      </svg>
    </div>
  ` : '';

  if (logoUrl) {
    return L.divIcon({
      className: 'gym-marker',
      html: `
        <div style="
          position: relative;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 3px solid ${borderColor};
          background: white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <img src="${logoUrl}" style="width: 100%; height: 100%; object-fit: cover;" />
          ${warningBadge}
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 44],
    });
  }
  
  return L.divIcon({
    className: 'gym-marker',
    html: `
      <div style="
        position: relative;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        border: 3px solid ${borderColor};
        background: hsl(var(--primary) / 0.1);
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary))" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        ${warningBadge}
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 44],
  });
};

const createUserIcon = () => {
  // Use fixed color for user marker (primary color #4CC9FF)
  return L.divIcon({
    className: 'user-marker',
    html: `
      <div style="position: relative; width: 40px; height: 40px;">
        <div class="user-pulse-ring" style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(76, 201, 255, 0.3);
        "></div>
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #4CC9FF;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        "></div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
};

const GymMap = ({ gyms, userLocation, onGymSelect, selectedGymId }: Omit<GymMapProps, 'onCenterUser'>) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const userMarkerRef = useRef<L.Marker | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  // Function to center on user location
  const centerOnUser = () => {
    if (mapRef.current && userLocation) {
      mapRef.current.setView([userLocation.lat, userLocation.lng], 15, { animate: true });
    }
  };

  // Default center (Czechia)
  const defaultCenter: [number, number] = [49.8, 15.5];
  
  // Czechia bounds
  const czechiaBounds = L.latLngBounds(
    [48.5, 12.0], // Southwest corner
    [51.1, 18.9]  // Northeast corner
  );

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: 7,
      scrollWheelZoom: true,
      maxBounds: czechiaBounds.pad(0.1),
      maxBoundsViscosity: 1.0,
      minZoom: 7,
      maxZoom: 18,
      attributionControl: false,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    // Set view to show all of Czechia centered
    map.setView(defaultCenter, 7);

    mapRef.current = map;
    setIsMapReady(true);

    // Handle resize to fix gray tiles
    const handleResize = () => {
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    
    // Initial invalidate after mount
    setTimeout(() => map.invalidateSize(), 200);
    setTimeout(() => map.invalidateSize(), 500);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Add/update gym markers - only show open gyms
  useEffect(() => {
    if (!mapRef.current || !isMapReady) return;

    // Clear old markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current.clear();

    // Filter to only open gyms
    const openGyms = gyms.filter(gym => {
      const hours = gym.opening_hours as OpeningHours;
      return isGymCurrentlyOpen(hours);
    });

    // Add new markers
    openGyms.forEach(gym => {
      const hours = gym.opening_hours as OpeningHours;
      const closingSoon = isClosingSoon(hours);
      
      const marker = L.marker([gym.latitude, gym.longitude], {
        icon: createGymIcon(gym.logo_url, closingSoon),
      }).addTo(mapRef.current!);

      marker.on('click', () => onGymSelect(gym));
      markersRef.current.set(gym.id, marker);
    });

    // Fit bounds if we have gyms
    if (openGyms.length > 0) {
      const bounds = L.latLngBounds(openGyms.map(g => [g.latitude, g.longitude]));
      if (userLocation) {
        bounds.extend([userLocation.lat, userLocation.lng]);
      }
      mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
    }
  }, [gyms, isMapReady, onGymSelect]);

  // Add/update user location marker
  useEffect(() => {
    if (!mapRef.current || !isMapReady) return;

    if (userLocation) {
      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
      } else {
        userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], {
          icon: createUserIcon(),
        }).addTo(mapRef.current);
        userMarkerRef.current.bindTooltip('Vaše poloha', { direction: 'top' });
      }
    }
  }, [userLocation, isMapReady]);

  // Center on selected gym
  useEffect(() => {
    if (!mapRef.current || !isMapReady || !selectedGymId) return;

    const gym = gyms.find(g => g.id === selectedGymId);
    if (gym) {
      mapRef.current.setView([gym.latitude, gym.longitude], 15, { animate: true });
    }
  }, [selectedGymId, gyms, isMapReady]);

  // Invalidate map size when component updates
  useEffect(() => {
    if (mapRef.current && isMapReady) {
      mapRef.current.invalidateSize();
    }
  }, [isMapReady]);

  return (
    <div className="relative w-full h-full">
      <div 
        ref={mapContainerRef} 
        className="w-full h-full overflow-hidden relative z-0"
        style={{ background: '#f0f0f0' }}
      />
      {/* Center on user button - top right - always show */}
      <button
        onClick={centerOnUser}
        disabled={!userLocation}
        className="absolute top-4 right-4 z-10 w-11 h-11 bg-background rounded-full shadow-lg flex items-center justify-center border border-border hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
  );
};

export default GymMap;
