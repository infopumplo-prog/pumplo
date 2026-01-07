import { Gym, OpeningHours } from '@/hooks/useGym';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock } from 'lucide-react';
import { isGymCurrentlyOpen, getTodayOpeningStatus } from '@/lib/gymUtils';
import { cn } from '@/lib/utils';

const DAYS = [
  { key: 'monday', label: 'Po' },
  { key: 'tuesday', label: 'Út' },
  { key: 'wednesday', label: 'St' },
  { key: 'thursday', label: 'Čt' },
  { key: 'friday', label: 'Pá' },
  { key: 'saturday', label: 'So' },
  { key: 'sunday', label: 'Ne' },
];

interface GymProfilePreviewProps {
  gym: Gym;
  variant?: 'default' | 'drawer';
  showBadge?: boolean;
}

const GymProfilePreview = ({ gym, variant = 'default', showBadge = true }: GymProfilePreviewProps) => {
  const hours = gym.opening_hours as OpeningHours;
  const isOpen = isGymCurrentlyOpen(hours);
  const status = getTodayOpeningStatus(hours);

  const isDrawer = variant === 'drawer';

  return (
    <div className={cn(
      "overflow-hidden bg-background",
      !isDrawer && "rounded-xl border shadow-sm",
      isDrawer && "rounded-t-[10px]"
    )}>
      {/* Cover Photo with Gradient */}
      <div className={cn("relative", isDrawer ? "h-48" : "h-40")}>
        {gym.cover_photo_url ? (
          <img 
            src={gym.cover_photo_url} 
            alt={gym.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5" />
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        
        {/* Logo */}
        <div className="absolute bottom-0 left-4 translate-y-1/2">
          {gym.logo_url ? (
            <img 
              src={gym.logo_url}
              alt={`${gym.name} logo`}
              className="w-20 h-20 rounded-full border-4 border-background object-cover shadow-lg"
            />
          ) : (
            <div className="w-20 h-20 rounded-full border-4 border-background bg-primary/10 flex items-center justify-center shadow-lg">
              <MapPin className="w-8 h-8 text-primary" />
            </div>
          )}
        </div>
        
        {/* Status Badge */}
        {showBadge && (
          <div className="absolute top-3 right-3">
            <Badge variant={gym.is_published ? 'default' : 'secondary'}>
              {gym.is_published ? 'Veřejná' : 'Soukromá'}
            </Badge>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="pt-12 pb-4 px-4 space-y-3">
        <div>
          <h3 className="font-bold text-lg">{gym.name}</h3>
          {gym.address && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
              <MapPin className="w-3.5 h-3.5" />
              {gym.address}
            </div>
          )}
        </div>

        {/* Today's Status */}
        <div className={cn(
          "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-sm font-medium",
          isOpen ? "bg-green-100 text-green-700" : "bg-destructive/10 text-destructive"
        )}>
          <div className={cn(
            "w-2 h-2 rounded-full",
            isOpen ? "bg-green-500" : "bg-destructive"
          )} />
          {status.text}
        </div>

        {gym.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{gym.description}</p>
        )}

        {/* Opening Hours Summary */}
        <div className="flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <div className="flex gap-1 flex-wrap">
            {DAYS.map(day => {
              const dayHours = hours[day.key];
              const isClosed = dayHours?.closed;
              return (
                <span 
                  key={day.key}
                  className={`px-1.5 py-0.5 text-xs rounded ${
                    isClosed 
                      ? 'bg-destructive/10 text-destructive' 
                      : 'bg-primary/10 text-primary'
                  }`}
                >
                  {day.label}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GymProfilePreview;
