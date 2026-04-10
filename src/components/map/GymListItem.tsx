import { OpeningHours } from '@/hooks/useGym';
import { PublicGym } from '@/hooks/usePublishedGyms';
import { MapPin, Navigation, Heart, AlertTriangle, Star } from 'lucide-react';
import { isGymCurrentlyOpen, getTodayOpeningStatus } from '@/lib/gymUtils';
import { cn } from '@/lib/utils';

interface GymListItemProps {
  gym: PublicGym;
  distance?: number; // in km
  onClick: () => void;
  isFavorite?: boolean;
}

const GymListItem = ({ gym, distance, onClick, isFavorite }: GymListItemProps) => {
  const hours = gym.opening_hours as OpeningHours;
  const isOpen = isGymCurrentlyOpen(hours);
  const status = getTodayOpeningStatus(hours);

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-xl p-4 flex items-center gap-4 shadow-card transition-colors text-left relative",
        gym.is_featured
          ? "bg-amber-500/[0.04] border-2 border-amber-500/40 hover:bg-amber-500/[0.08]"
          : "bg-card border border-border",
        !gym.is_featured && (isOpen ? "hover:bg-accent/50" : "opacity-60 hover:opacity-70"),
        gym.is_featured && !isOpen && "opacity-60"
      )}
    >
      {gym.is_featured && (
        <div className="absolute -top-2 left-4 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold shadow-sm">
          <Star className="w-2.5 h-2.5 fill-white" />
          PREMIUM
        </div>
      )}
      {/* Logo */}
      <div className="relative flex-shrink-0">
        {gym.logo_url ? (
          <div className={cn(
            "w-12 h-12 rounded-full border-2 border-border bg-white flex items-center justify-center overflow-hidden",
            !isOpen && "grayscale"
          )}>
            <img
              src={gym.logo_url}
              alt={gym.name}
              className="w-9 h-9 object-contain"
            />
          </div>
        ) : (
          <div className={cn(
            "w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center",
            !isOpen && "bg-muted"
          )}>
            <MapPin className={cn("w-6 h-6", isOpen ? "text-primary" : "text-muted-foreground")} />
          </div>
        )}
        {/* Closing Soon Badge */}
        {status.closingSoon && (
          <div className="absolute -top-1 -left-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center animate-pulse">
            <AlertTriangle className="w-3 h-3 text-white" />
          </div>
        )}
        {isFavorite && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-destructive rounded-full flex items-center justify-center">
            <Heart className="w-3 h-3 text-white fill-white" />
          </div>
        )}
      </div>
      
      {/* Info */}
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-foreground truncate">{gym.name}</h4>
        {gym.address && (
          <p className="text-sm text-muted-foreground truncate">{gym.address}</p>
        )}
        <p className={cn(
          "text-xs mt-0.5 font-medium",
          status.closingSoon ? "text-amber-600" : isOpen ? "text-green-600" : "text-destructive"
        )}>
          {status.text}
        </p>
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
