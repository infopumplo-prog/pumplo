import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'exercise-videos';

const extractFilePath = (videoPath: string): string => {
  const marker = `/${BUCKET}/`;
  const idx = videoPath.indexOf(marker);
  return idx !== -1 ? videoPath.substring(idx + marker.length) : videoPath;
};

// exercise-videos is a public bucket, so we serve videos via the public CDN URL
// (no RLS / no signing). This works for anon sticker visitors and authenticated
// members alike, and lets storage RLS lock down listing without breaking reads.
export const getSignedVideoUrl = async (videoPath: string | null): Promise<string | null> => {
  if (!videoPath) return null;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(extractFilePath(videoPath));
  return data?.publicUrl ?? null;
};
