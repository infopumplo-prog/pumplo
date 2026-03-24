import { useState, useRef, useEffect } from 'react';
import { MapPin, Play, ArrowLeft, ChevronDown, Globe, Mail, Phone, Heart, Check } from 'lucide-react';
import { Gym, OpeningHours, GymMachine } from '@/hooks/useGym';
 import { GymPricing } from '@/contexts/GymContext';
import { PublicGym } from '@/hooks/usePublishedGyms';
import { useGymMachines } from '@/hooks/useGymMachines';
import { useGymPhotos } from '@/hooks/useGymPhotos';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import GymPhotoGallery from './GymPhotoGallery';
import GymPhotoViewer from './GymPhotoViewer';
import GymDetailTabs from './GymDetailTabs';

// Accept both Gym (with owner_id) and PublicGym (without owner_id)
type GymData = Gym | PublicGym;

interface GymProfilePreviewProps {
  gym: GymData;
  variant?: 'default' | 'drawer';
  showBadge?: boolean;
  onStartTraining?: () => void;
  onSelectGym?: () => void;
  isSelectingGym?: boolean;
  isGymOpen?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onBack?: () => void;
}

const GymProfilePreview = ({
  gym,
  variant = 'default',
  showBadge = true,
  onStartTraining,
  onSelectGym,
  isSelectingGym,
  isGymOpen,
  isFavorite: isFav,
  onToggleFavorite,
  onBack
}: GymProfilePreviewProps) => {
  const hours = gym.opening_hours as OpeningHours;
  const { machines, isLoading: machinesLoading } = useGymMachines(gym.id);
  const { photos } = useGymPhotos(gym.id ?? undefined);
  
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);
  const [descOverflows, setDescOverflows] = useState(false);
  const descRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (descRef.current) {
      setDescOverflows(descRef.current.scrollHeight > descRef.current.clientHeight);
    }
  }, [gym.description]);

  const isDrawer = variant === 'drawer';

  const handlePhotoClick = (index: number) => {
    setSelectedPhotoIndex(index);
    setGalleryOpen(true);
  };

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
          clickable={true}
          onPhotoClick={handlePhotoClick}
        />
        {/* Gradient overlay - only bottom part for logo readability */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background/80 to-transparent pointer-events-none" />
        
        {/* Logo */}
        <div className="absolute bottom-0 left-4 translate-y-1/2">
          {gym.logo_url ? (
            <div className="w-20 h-20 rounded-full border-4 border-background bg-white shadow-lg flex items-center justify-center overflow-hidden">
              <img
                src={gym.logo_url}
                alt={`${gym.name} logo`}
                className="w-14 h-14 object-contain"
              />
            </div>
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

        {/* Description - collapsible */}
        {gym.description && (
          <div>
            <p
              ref={descRef}
              className={cn(
                "text-sm text-muted-foreground transition-all",
                !descExpanded && "line-clamp-3"
              )}
            >
              {gym.description}
            </p>
            {descOverflows && (
              <button
                onClick={() => setDescExpanded(!descExpanded)}
                className="flex items-center gap-1 text-xs text-primary mt-1 hover:underline"
              >
                {descExpanded ? 'Méně' : 'Více'}
                <ChevronDown className={cn("w-3 h-3 transition-transform", descExpanded && "rotate-180")} />
              </button>
            )}
          </div>
        )}

        {/* Contact info */}
        <div className="flex flex-wrap gap-2">
          <a
            href="https://www.eurogym.cz"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 text-xs text-muted-foreground hover:bg-muted transition-colors"
          >
            <Globe className="w-3.5 h-3.5" />
            eurogym.cz
          </a>
          <a
            href="mailto:office@eurogym.cz"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 text-xs text-muted-foreground hover:bg-muted transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
            office@eurogym.cz
          </a>
          <a
            href="tel:+420733238238"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 text-xs text-muted-foreground hover:bg-muted transition-colors"
          >
            <Phone className="w-3.5 h-3.5" />
            +420 733 238 238
          </a>
        </div>

        {/* Action Buttons */}
        {isDrawer && (onStartTraining || onSelectGym) && (
          <div className="flex gap-3">
            {onToggleFavorite && (
              <Button
                variant="outline"
                size="lg"
                className="flex-shrink-0"
                onClick={onToggleFavorite}
              >
                <Heart
                  className={cn(
                    "w-5 h-5",
                    isFav && "fill-destructive text-destructive"
                  )}
                />
              </Button>
            )}
            {onSelectGym ? (
              <Button
                size="lg"
                className="flex-1 gap-2"
                disabled={!isGymOpen || isSelectingGym}
                onClick={onSelectGym}
              >
                {isSelectingGym ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Vybírám...
                  </>
                ) : isGymOpen ? (
                  <>
                    <Check className="w-5 h-5" />
                    Vybrat posilovnu
                  </>
                ) : (
                  'Posilovna je zavřená'
                )}
              </Button>
            ) : onStartTraining ? (
              <Button
                size="lg"
                className="flex-1 gap-2"
                disabled={!isGymOpen}
                onClick={onStartTraining}
              >
                {isGymOpen ? (
                  <>
                    <Play className="w-5 h-5" />
                    Zahájit trénink
                  </>
                ) : (
                  'Posilovna je zavřená'
                )}
              </Button>
            ) : null}
          </div>
        )}

        {/* Tabs */}
        <GymDetailTabs
          hours={hours}
          machines={machines}
          machinesLoading={machinesLoading}
          pricing={'pricing' in gym ? (gym.pricing as GymPricing | null) : null}
          gymId={gym.id}
        />
      </div>

      {/* Fullscreen Photo Viewer */}
      <GymPhotoViewer
        photos={photos}
        fallbackCoverUrl={gym.cover_photo_url}
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        initialIndex={selectedPhotoIndex}
      />
    </div>
  );
};

export default GymProfilePreview;
