import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'exercise-videos';
const SIGNED_URL_EXPIRY = 3600; // 1 hour

const extractFilePath = (videoPath: string): string => {
  const marker = `/${BUCKET}/`;
  const idx = videoPath.indexOf(marker);
  return idx !== -1 ? videoPath.substring(idx + marker.length) : videoPath;
};

export const getSignedVideoUrl = async (videoPath: string | null): Promise<string | null> => {
  if (!videoPath) return null;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(extractFilePath(videoPath), SIGNED_URL_EXPIRY);
  if (error) {
    console.error('signed video url error:', error);
    return null;
  }
  return data?.signedUrl ?? null;
};
