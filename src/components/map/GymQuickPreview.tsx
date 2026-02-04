import { MapPin, Clock, Navigation, Info, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PublicGym } from '@/hooks/usePublishedGyms';
import { OpeningHours } from '@/hooks/useGym';
import { isGymCurrentlyOpen, getTodayOpeningStatus, isClosingSoon } from '@/lib/gymUtils';
import { cn } from '@/lib/utils';

interface GymQuickPreviewProps {
  gym: PublicGym;
  distance?: number;
  onDetailClick: () => void;
  onNavigateClick: () => void;
  onClose: () => void;
}

const GymQuickPreview = ({ 
  gym, 
  distance, 
  onDetailClick, 
  onNavigateClick,
  onClose 
}: GymQuickPreviewProps) => {
  const hours = gym.opening_hours as OpeningHours;
  const isOpen = isGymCurrentlyOpen(hours);
  const status = getTodayOpeningStatus(hours);
  const closingSoon = isClosingSoon(hours);

  const formatDistance = (km: number) => {
    if (km < 1) return `${Math.round(km * 1000)} m`;
    return `${km.toFixed(1)} km`;
  };

  return (
    <div className="bg-card rounded-xl shadow-lg border border-border overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Close button */}
      <button 
        onClick={onClose}
        className="absolute top-3 right-3 p-1.5 rounded-full bg-background/80 hover:bg-background z-10"
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>

      {/* Content */}
      <div className="p-4">
        <div className="flex gap-3">
          {/* Logo */}
          <div className="shrink-0">
            {gym.logo_url ? (
              <img 
                src={gym.logo_url}
                alt={`${gym.name} logo`}
                className="w-16 h-16 rounded-lg object-cover border border-border"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center border border-border">
                <MapPin className="w-6 h-6 text-primary" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold text-base truncate">{gym.name}</h3>
              {distance !== undefined && (
                <span className="text-xs text-muted-foreground shrink-0 font-medium">
                  {formatDistance(distance)}
                </span>
              )}
            </div>

            {gym.address && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate">{gym.address}</span>
              </div>
            )}

            {/* Opening Hours */}
            <div className="flex items-center gap-1.5 mt-2">
              <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className={cn(
                "text-sm font-medium",
                closingSoon ? "text-amber-600" : isOpen ? "text-green-600" : "text-destructive"
              )}>
                {status.text}
              </span>
              <div className={cn(
                "w-2 h-2 rounded-full shrink-0",
                closingSoon ? "bg-amber-500 animate-pulse" : isOpen ? "bg-green-500" : "bg-destructive"
              )} />
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 px-4 pb-4">
        <Button 
          size="lg" 
          className="flex-1 gap-2"
          onClick={onDetailClick}
        >
          <Info className="w-4 h-4" />
          Detail
        </Button>
        <Button 
          size="lg" 
          className="flex-1 gap-2"
          onClick={onNavigateClick}
        >
          <Navigation className="w-4 h-4" />
          Navigace
        </Button>
      </div>
    </div>
  );
};

export default GymQuickPreview;
