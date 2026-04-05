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
          {(gym as any).website && (
            <a
              href={(gym as any).website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 text-xs text-muted-foreground hover:bg-muted transition-colors"
            >
              <Globe className="w-3.5 h-3.5" />
              {(gym as any).website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
            </a>
          )}
          {(gym as any).contact_email && (
            <a
              href={`mailto:${(gym as any).contact_email}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 text-xs text-muted-foreground hover:bg-muted transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              {(gym as any).contact_email}
            </a>
          )}
          {(gym as any).contact_phone && (
            <a
              href={`tel:${(gym as any).contact_phone.replace(/\s/g, '')}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 text-xs text-muted-foreground hover:bg-muted transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              {(gym as any).contact_phone}
            </a>
          )}
          {gym.instagram_handle && (
            <a
              href={`https://instagram.com/${gym.instagram_handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 text-xs text-muted-foreground hover:bg-muted transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              @{gym.instagram_handle}
            </a>
          )}
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
