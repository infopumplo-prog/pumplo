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

// Fullscreen for exercise videos. iOS WKWebView doesn't implement the standard
// Fullscreen API on elements, but exposes webkitEnterFullscreen() directly on
// <video>, which opens the native player (with its own controls).
export const enterVideoFullscreen = (video: HTMLVideoElement | null): void => {
  if (!video) return;
  const v = video as HTMLVideoElement & { webkitEnterFullscreen?: () => void };
  try {
    if (typeof v.webkitEnterFullscreen === 'function') v.webkitEnterFullscreen();
    else if (v.requestFullscreen) v.requestFullscreen();
  } catch { /* fullscreen unavailable → noop */ }
};

// Static first-frame JPEG generated next to each video (<folder>/thumb.jpg).
// Lists must use this instead of <video> thumbnails: 200 concurrent <video>
// elements each pull megabytes on iOS, the ~20 kB JPEGs load instantly.
// (Thumb generation: ffmpeg first frame, see repo CLAUDE.md video pipeline.)
export const getVideoThumbUrl = (videoPath: string | null): string | null => {
  if (!videoPath) return null;
  const file = extractFilePath(videoPath);
  const slash = file.lastIndexOf('/');
  // Videos in per-exercise folders → <folder>/thumb.jpg; legacy root-level
  // videos → <file>/thumb.jpg (the generator uploads them there).
  const folder = slash === -1 ? file : file.substring(0, slash);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(`${folder}/thumb.jpg`);
  return data?.publicUrl ?? null;
};
