import { useState, useEffect, useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { cn } from '@/lib/utils';
import { GymPhoto } from '@/hooks/useGymPhotos';

interface GymPhotoGalleryProps {
  photos: GymPhoto[];
  fallbackCoverUrl?: string | null;
  className?: string;
}

const GymPhotoGallery = ({ photos, fallbackCoverUrl, className }: GymPhotoGalleryProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, onSelect]);

  // If no photos, show fallback cover or gradient
  if (photos.length === 0) {
    if (fallbackCoverUrl) {
      return (
        <div className={cn("relative w-full h-48", className)}>
          <img 
            src={fallbackCoverUrl} 
            alt="Cover"
            className="w-full h-full object-cover"
          />
        </div>
      );
    }
    return (
      <div className={cn("relative w-full h-48 bg-gradient-to-br from-primary/20 to-primary/5", className)} />
    );
  }

  // Single photo - no carousel needed
  if (photos.length === 1) {
    return (
      <div className={cn("relative w-full h-48", className)}>
        <img 
          src={photos[0].photo_url} 
          alt="Gym photo"
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  // Multiple photos - show carousel
  return (
    <div className={cn("relative w-full h-48", className)}>
      <div ref={emblaRef} className="overflow-hidden h-full">
        <div className="flex h-full">
          {photos.map((photo) => (
            <div 
              key={photo.id} 
              className="flex-none w-full h-full"
            >
              <img 
                src={photo.photo_url} 
                alt="Gym photo"
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>
      </div>
      
      {/* Dot indicators */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
        {photos.map((_, index) => (
          <button
            key={index}
            onClick={() => emblaApi?.scrollTo(index)}
            className={cn(
              "w-2 h-2 rounded-full transition-all",
              index === selectedIndex 
                ? "bg-white scale-110" 
                : "bg-white/50 hover:bg-white/70"
            )}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>

      {/* Photo counter */}
      <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
        {selectedIndex + 1}/{photos.length}
      </div>
    </div>
  );
};

export default GymPhotoGallery;
