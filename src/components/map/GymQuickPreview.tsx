import { MapPin, Clock, Navigation, Info, X, Star } from 'lucide-react';
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
    <div className={cn(
      "rounded-xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300 relative",
      gym.is_featured
        ? "bg-card border-2 border-amber-500/50 shadow-[0_0_0_3px_rgba(245,158,11,0.12)]"
        : "bg-card border border-border"
    )}>
      {gym.is_featured && (
        <div className="absolute -top-2 left-4 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold shadow-sm z-10">
          <Star className="w-2.5 h-2.5 fill-white" />
          PREMIUM
        </div>
      )}
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-muted/80 hover:bg-muted transition-colors"
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>

      {/* Content */}
      <div className="p-4">
        <div className="flex gap-3">
          {/* Logo */}
          <div className="shrink-0">
            {gym.logo_url ? (
              <div className={cn(
                "w-16 h-16 rounded-lg bg-white flex items-center justify-center overflow-hidden",
                gym.is_featured ? "border-2 border-amber-500/40" : "border border-border"
              )}>
                <img
                  src={gym.logo_url}
                  alt={`${gym.name} logo`}
                  className="w-12 h-12 object-contain"
                />
              </div>
            ) : (
              <div className={cn(
                "w-16 h-16 rounded-lg flex items-center justify-center",
                gym.is_featured
                  ? "bg-amber-500/10 border-2 border-amber-500/40"
                  : "bg-primary/10 border border-border"
              )}>
                <MapPin className={cn("w-6 h-6", gym.is_featured ? "text-amber-500" : "text-primary")} />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base truncate">{gym.name}</h3>

            {/* Address + Distance on same line */}
            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{gym.address || 'Adresa neuvedena'}</span>
              {distance !== undefined && (
                <span className="shrink-0 text-primary font-medium ml-1">
                  • {formatDistance(distance)}
                </span>
              )}
            </div>

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
