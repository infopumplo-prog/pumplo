import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface LocationPickerProps {
  latitude?: number;
  longitude?: number;
  onLocationChange: (lat: number, lng: number) => void;
}

const LocationPicker = ({ latitude, longitude, onLocationChange }: LocationPickerProps) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  // Default center (Czechia)
  const defaultCenter: [number, number] = [49.8, 15.5];
  const initialCenter = latitude && longitude ? [latitude, longitude] as [number, number] : defaultCenter;
  const initialZoom = latitude && longitude ? 15 : 7;

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // Add initial marker if position exists
    if (latitude && longitude) {
      markerRef.current = L.marker([latitude, longitude]).addTo(map);
    }

    // Handle map clicks
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      
      // Remove existing marker
      if (markerRef.current) {
        markerRef.current.remove();
      }
      
      // Add new marker
      markerRef.current = L.marker([lat, lng]).addTo(map);
      onLocationChange(lat, lng);
    });

    mapRef.current = map;
    setIsMapReady(true);

    // Try to get user's geolocation if no initial position
    if (!latitude && !longitude && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          map.setView([pos.coords.latitude, pos.coords.longitude], 13);
        },
        () => {
          // Keep default center if geolocation fails
        }
      );
    }

    // Cleanup
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update marker when props change
  useEffect(() => {
    if (!mapRef.current || !isMapReady) return;
    
    if (latitude && longitude) {
      if (markerRef.current) {
        markerRef.current.setLatLng([latitude, longitude]);
      } else {
        markerRef.current = L.marker([latitude, longitude]).addTo(mapRef.current);
      }
      mapRef.current.setView([latitude, longitude], 15);
    }
  }, [latitude, longitude, isMapReady]);

  return (
    <div className="w-full">
      <div 
        ref={mapContainerRef} 
        className="w-full h-64 rounded-lg overflow-hidden border border-border"
      />
      <p className="text-xs text-muted-foreground mt-2 px-1">
        Klikněte na mapu pro výběr lokace
      </p>
    </div>
  );
};

export default LocationPicker;
