import { MapPin, Play, ArrowLeft } from 'lucide-react';
import { Gym, OpeningHours, GymMachine } from '@/hooks/useGym';
import { PublicGym } from '@/hooks/usePublishedGyms';
import { useGymMachines } from '@/hooks/useGymMachines';
import { useGymPhotos } from '@/hooks/useGymPhotos';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import GymPhotoGallery from './GymPhotoGallery';
import GymDetailTabs from './GymDetailTabs';

// Accept both Gym (with owner_id) and PublicGym (without owner_id)
type GymData = Gym | PublicGym;

interface GymProfilePreviewProps {
  gym: GymData;
  variant?: 'default' | 'drawer';
  showBadge?: boolean;
  onStartTraining?: () => void;
  onBack?: () => void;
}

const GymProfilePreview = ({ 
  gym, 
  variant = 'default', 
  showBadge = true,
  onStartTraining,
  onBack
}: GymProfilePreviewProps) => {
  const hours = gym.opening_hours as OpeningHours;
  const { machines, isLoading: machinesLoading } = useGymMachines(gym.id);
  const { photos } = useGymPhotos(gym.id ?? undefined);

  const isDrawer = variant === 'drawer';

  return (
    <div className={cn(
      "overflow-hidden bg-background",
      !isDrawer && "rounded-xl border shadow-sm",
      isDrawer && "rounded-t-[10px]"
    )}>
      {/* Cover Photo / Gallery with Gradient */}
      <div className={cn("relative", isDrawer ? "h-56" : "h-40")}>
        {/* Back button for drawer */}
        {isDrawer && onBack && (
          <button 
            onClick={onBack}
            className="absolute top-4 left-4 z-10 p-2 rounded-full bg-background/80 hover:bg-background shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}

        <GymPhotoGallery 
          photos={photos} 
          fallbackCoverUrl={gym.cover_photo_url}
          className="h-full"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent pointer-events-none" />
        
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
      <div className="pt-12 pb-4 px-4 space-y-4">
        {/* Header */}
        <div>
          <h3 className="font-bold text-xl">{gym.name}</h3>
          {gym.address && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
              <MapPin className="w-3.5 h-3.5" />
              {gym.address}
            </div>
          )}
        </div>

        {/* Description */}
        {gym.description && (
          <p className="text-sm text-muted-foreground">{gym.description}</p>
        )}

        {/* Start Training Button */}
        {isDrawer && onStartTraining && (
          <Button 
            size="lg" 
            className="w-full gap-2"
            onClick={onStartTraining}
          >
            <Play className="w-5 h-5" />
            Zahájit trénink
          </Button>
        )}

        {/* Tabs */}
        <GymDetailTabs 
          hours={hours}
          machines={machines}
          machinesLoading={machinesLoading}
        />
      </div>
    </div>
  );
};

export default GymProfilePreview;
