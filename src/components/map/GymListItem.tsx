import { Gym } from '@/hooks/useGym';
import { MapPin, Navigation } from 'lucide-react';

interface GymListItemProps {
  gym: Gym;
  distance?: number; // in km
  onClick: () => void;
}

const GymListItem = ({ gym, distance, onClick }: GymListItemProps) => {
  return (
    <button
      onClick={onClick}
      className="w-full bg-card border border-border rounded-xl p-4 flex items-center gap-4 shadow-card hover:bg-accent/50 transition-colors text-left"
    >
      {/* Logo */}
      {gym.logo_url ? (
        <img 
          src={gym.logo_url}
          alt={gym.name}
          className="w-12 h-12 rounded-full object-cover border-2 border-border flex-shrink-0"
        />
      ) : (
        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
          <MapPin className="w-6 h-6 text-primary" />
        </div>
      )}
      
      {/* Info */}
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-foreground truncate">{gym.name}</h4>
        {gym.address && (
          <p className="text-sm text-muted-foreground truncate">{gym.address}</p>
        )}
      </div>
      
      {/* Distance */}
      {distance !== undefined && (
        <div className="flex items-center gap-1 text-sm text-muted-foreground flex-shrink-0">
          <Navigation className="w-4 h-4" />
          <span>{distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`}</span>
        </div>
      )}
    </button>
  );
};

export default GymListItem;
