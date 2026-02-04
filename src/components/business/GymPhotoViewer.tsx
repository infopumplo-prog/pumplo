import { useState, useCallback, useEffect } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GymPhoto } from '@/hooks/useGymPhotos';

interface GymPhotoViewerProps {
  photos: GymPhoto[];
  fallbackCoverUrl?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialIndex?: number;
}

const GymPhotoViewer = ({ 
  photos, 
  fallbackCoverUrl, 
  open, 
  onOpenChange, 
  initialIndex = 0 
}: GymPhotoViewerProps) => {
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: true,
    startIndex: initialIndex
  });

  // Build the list of images to show
  const allImages = photos.length > 0 
    ? photos.map(p => p.photo_url)
    : fallbackCoverUrl 
      ? [fallbackCoverUrl]
      : [];

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

  // Reset to initial index when opened
  useEffect(() => {
    if (open && emblaApi) {
      emblaApi.scrollTo(initialIndex, true);
    }
  }, [open, initialIndex, emblaApi]);

  const scrollPrev = useCallback(() => {
    emblaApi?.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    emblaApi?.scrollNext();
  }, [emblaApi]);

  if (allImages.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="fixed inset-0 max-w-full h-full w-full p-0 border-0 bg-black/95 [&>button]:hidden z-[200] translate-x-0 translate-y-0 left-0 top-0"
        overlayClassName="z-[150]"
      >
        {/* Close button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 z-[60] p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors pointer-events-auto"
        >
          <X className="w-6 h-6 text-white" />
        </button>

        {/* Photo counter */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[60] text-white text-sm bg-black/50 px-3 py-1 rounded-full">
          {selectedIndex + 1} / {allImages.length}
        </div>

        {/* Carousel */}
        <div ref={emblaRef} className="overflow-hidden h-full flex items-center relative z-[10]">
          <div className="flex h-full">
            {allImages.map((url, index) => (
              <div 
                key={index} 
                className="flex-none w-full h-full flex items-center justify-center p-4"
              >
                <img 
                  src={url} 
                  alt={`Photo ${index + 1}`}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Navigation arrows */}
        {allImages.length > 1 && (
          <>
            <button
              onClick={scrollPrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-[60] p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors pointer-events-auto"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
            <button
              onClick={scrollNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-[60] p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors pointer-events-auto"
            >
              <ChevronRight className="w-6 h-6 text-white" />
            </button>
          </>
        )}

        {/* Dot indicators */}
        {allImages.length > 1 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[60] flex gap-2">
            {allImages.map((_, index) => (
              <button
                key={index}
                onClick={() => emblaApi?.scrollTo(index)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  index === selectedIndex 
                    ? "bg-white scale-125" 
                    : "bg-white/40 hover:bg-white/60"
                )}
                aria-label={`Go to photo ${index + 1}`}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default GymPhotoViewer;
