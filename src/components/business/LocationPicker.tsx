import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
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

const MapClickHandler = ({ onLocationChange }: { onLocationChange: (lat: number, lng: number) => void }) => {
  useMapEvents({
    click: (e) => {
      onLocationChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

const GeolocationHandler = () => {
  const map = useMap();
  const [initialized, setInitialized] = useState(false);
  
  useEffect(() => {
    if (initialized) return;
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          map.setView([pos.coords.latitude, pos.coords.longitude], 13);
          setInitialized(true);
        },
        () => {
          setInitialized(true);
        }
      );
    } else {
      setInitialized(true);
    }
  }, [map, initialized]);
  
  return null;
};

const LocationPicker = ({ latitude, longitude, onLocationChange }: LocationPickerProps) => {
  const [position, setPosition] = useState<[number, number] | null>(
    latitude && longitude ? [latitude, longitude] : null
  );

  const handleLocationChange = (lat: number, lng: number) => {
    setPosition([lat, lng]);
    onLocationChange(lat, lng);
  };

  // Default center (Slovakia)
  const defaultCenter: [number, number] = [48.669, 19.699];
  const center = position || defaultCenter;

  return (
    <div className="w-full h-64 rounded-lg overflow-hidden border border-border">
      <MapContainer
        center={center}
        zoom={position ? 15 : 7}
        className="w-full h-full"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onLocationChange={handleLocationChange} />
        {!position && <GeolocationHandler />}
        {position && <Marker position={position} />}
      </MapContainer>
      <p className="text-xs text-muted-foreground mt-2 px-1">
        Kliknite na mapu pre výber lokácie
      </p>
    </div>
  );
};

export default LocationPicker;
