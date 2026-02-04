import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const MAX_PHOTOS = 7;

export interface GymPhoto {
  id: string;
  gym_id: string;
  photo_url: string;
  sort_order: number;
  created_at: string;
}

interface UseGymPhotosReturn {
  photos: GymPhoto[];
  isLoading: boolean;
  addPhoto: (file: File) => Promise<{ success: boolean; url?: string }>;
  removePhoto: (photoId: string) => Promise<{ success: boolean }>;
  reorderPhotos: (orderedIds: string[]) => Promise<void>;
  canAddMore: boolean;
  refetch: () => Promise<void>;
}

export const useGymPhotos = (gymId: string | undefined): UseGymPhotosReturn => {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<GymPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPhotos = useCallback(async () => {
    if (!gymId) {
      setPhotos([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase
      .from('gym_photos')
      .select('*')
      .eq('gym_id', gymId)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching gym photos:', error);
      toast.error('Nepodařilo se načíst fotky');
    } else {
      setPhotos(data || []);
    }
    setIsLoading(false);
  }, [gymId]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  const addPhoto = async (file: File): Promise<{ success: boolean; url?: string }> => {
    if (!gymId || !user) return { success: false };
    
    if (photos.length >= MAX_PHOTOS) {
      toast.error(`Maximální počet fotek je ${MAX_PHOTOS}`);
      return { success: false };
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Vyberte prosím obrázek');
      return { success: false };
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Obrázek je příliš velký (max 5MB)');
      return { success: false };
    }

    try {
      // Upload to storage - use user.id as folder to match RLS policy
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/gallery-${gymId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('gym-images')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error('Nepodařilo se nahrát obrázek');
        return { success: false };
      }

      const { data: { publicUrl } } = supabase.storage
        .from('gym-images')
        .getPublicUrl(fileName);

      // Insert into DB with next sort_order
      const nextSortOrder = photos.length > 0 
        ? Math.max(...photos.map(p => p.sort_order)) + 1 
        : 0;

      const { error: insertError } = await supabase
        .from('gym_photos')
        .insert({
          gym_id: gymId,
          photo_url: publicUrl,
          sort_order: nextSortOrder,
        });

      if (insertError) {
        console.error('Insert error:', insertError);
        toast.error('Nepodařilo se uložit fotku');
        return { success: false };
      }

      await fetchPhotos();
      toast.success('Fotka byla nahrána');
      return { success: true, url: publicUrl };
    } catch (error) {
      console.error('Error adding photo:', error);
      toast.error('Nepodařilo se přidat fotku');
      return { success: false };
    }
  };

  const removePhoto = async (photoId: string): Promise<{ success: boolean }> => {
    if (!gymId) return { success: false };

    try {
      // Get photo URL to delete from storage
      const photo = photos.find(p => p.id === photoId);
      
      const { error } = await supabase
        .from('gym_photos')
        .delete()
        .eq('id', photoId);

      if (error) {
        console.error('Delete error:', error);
        toast.error('Nepodařilo se smazat fotku');
        return { success: false };
      }

      // Try to delete from storage (optional, might fail if no permissions)
      if (photo) {
        const pathMatch = photo.photo_url.match(/gym-images\/(.+)$/);
        if (pathMatch) {
          await supabase.storage.from('gym-images').remove([pathMatch[1]]);
        }
      }

      await fetchPhotos();
      toast.success('Fotka byla smazána');
      return { success: true };
    } catch (error) {
      console.error('Error removing photo:', error);
      toast.error('Nepodařilo se smazat fotku');
      return { success: false };
    }
  };

  const reorderPhotos = async (orderedIds: string[]): Promise<void> => {
    if (!gymId) return;

    try {
      // Update sort_order for each photo
      const updates = orderedIds.map((id, index) => 
        supabase
          .from('gym_photos')
          .update({ sort_order: index })
          .eq('id', id)
      );

      await Promise.all(updates);
      await fetchPhotos();
    } catch (error) {
      console.error('Error reordering photos:', error);
      toast.error('Nepodařilo se změnit pořadí');
    }
  };

  return {
    photos,
    isLoading,
    addPhoto,
    removePhoto,
    reorderPhotos,
    canAddMore: photos.length < MAX_PHOTOS,
    refetch: fetchPhotos,
  };
};
