import { useRef, useState } from 'react';
import { Plus, X, Loader2, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GymPhoto, useGymPhotos } from '@/hooks/useGymPhotos';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

const MAX_PHOTOS = 7;

interface GymPhotosManagerProps {
  gymId: string;
  className?: string;
}

const GymPhotosManager = ({ gymId, className }: GymPhotosManagerProps) => {
  const { t } = useTranslation();
  const { photos, isLoading, addPhoto, removePhoto, canAddMore } = useGymPhotos(gymId);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    await addPhoto(file);
    setIsUploading(false);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = async (photoId: string) => {
    setDeletingId(photoId);
    await removePhoto(photoId);
    setDeletingId(null);
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{t('business.photo_gallery')}</span>
        <span className="text-xs text-muted-foreground">
          {photos.length}/{MAX_PHOTOS}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {photos.map((photo) => (
          <div 
            key={photo.id} 
            className="relative aspect-square rounded-lg overflow-hidden bg-muted group"
          >
            <img 
              src={photo.photo_url} 
              alt="Gallery photo"
              className="w-full h-full object-cover"
            />
            <button
              onClick={() => handleRemovePhoto(photo.id)}
              disabled={deletingId === photo.id}
              className="absolute top-1 right-1 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/90"
              aria-label={t('business.delete_photo')}
            >
              {deletingId === photo.id ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <X className="w-3 h-3" />
              )}
            </button>
          </div>
        ))}

        {/* Add button */}
        {canAddMore && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary transition-colors flex flex-col items-center justify-center bg-muted/50"
            >
              {isUploading ? (
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <Plus className="w-5 h-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground mt-1">{t('business.add_photo')}</span>
                </>
              )}
            </button>
          </>
        )}
      </div>

      {photos.length === 0 && (
        <div className="text-center py-4 text-sm text-muted-foreground">
          <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>{t('business.upload_photos', { n: MAX_PHOTOS })}</p>
        </div>
      )}
    </div>
  );
};

export default GymPhotosManager;
