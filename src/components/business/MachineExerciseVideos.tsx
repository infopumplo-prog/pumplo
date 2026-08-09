import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Dumbbell, PlayCircle, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getVideoThumbUrl, getSignedVideoUrl, enterVideoFullscreen } from '@/lib/videoUtils';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface ExerciseRow {
  id: string;
  name: string;
  name_en: string | null;
  video_path: string | null;
}

// Videa cviků, které se na stroji dají dělat — pro majitele posilovny v „Moje posilovna".
// Cvik je napojen na stroj přes machine_id NEBO secondary_machine_id (jako accessory).
// V seznamu jen thumbnaily (getVideoThumbUrl), <video> se vykreslí až v dialogu po kliknutí
// (200 <video> naráz zabije iOS — viz videoUtils / repo CLAUDE.md).
const MachineExerciseVideos = ({ machineId }: { machineId: string }) => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';
  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [active, setActive] = useState<ExerciseRow | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    supabase
      .from('exercises')
      .select('id, name, name_en, video_path')
      .or(`machine_id.eq.${machineId},secondary_machine_id.eq.${machineId}`)
      .not('video_path', 'is', null)
      .order('name')
      .then(({ data }) => {
        if (cancelled) return;
        setExercises((data as ExerciseRow[]) || []);
        setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [machineId]);

  const openVideo = async (ex: ExerciseRow) => {
    setActive(ex);
    setVideoError(false);
    setVideoUrl(await getSignedVideoUrl(ex.video_path));
  };

  const closeVideo = () => {
    setActive(null);
    setVideoUrl(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (exercises.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2">
        {t('business.machine_no_videos')}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        {t('business.machine_exercises_count', { n: exercises.length })}
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {exercises.map(ex => (
          <ExerciseVideoThumb
            key={ex.id}
            videoPath={ex.video_path}
            name={isEn && ex.name_en ? ex.name_en : ex.name}
            onTap={() => openVideo(ex)}
          />
        ))}
      </div>

      <Dialog open={!!active} onOpenChange={o => { if (!o) closeVideo(); }}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-black border-0">
          {active && (
            <div className="relative">
              <button
                onClick={closeVideo}
                className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-black/60 text-white"
                aria-label={t('business.machine_close_video')}
              >
                <X className="w-4 h-4" />
              </button>
              {videoUrl && !videoError ? (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="w-full max-h-[70vh] bg-black"
                  autoPlay
                  loop
                  muted
                  playsInline
                  controls
                  onError={() => setVideoError(true)}
                  onClick={() => enterVideoFullscreen(videoRef.current)}
                />
              ) : (
                <div className="flex items-center justify-center h-48 text-white/60 text-sm">
                  {videoError ? t('business.machine_video_error') : <Loader2 className="w-5 h-5 animate-spin" />}
                </div>
              )}
              <p className="px-3 py-2 text-sm text-white bg-black">
                {isEn && active.name_en ? active.name_en : active.name}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Thumbnail cviku (statický JPEG první snímek) s fallback ikonou. Klik → přehrát video v dialogu.
const ExerciseVideoThumb = ({
  videoPath,
  name,
  onTap,
}: {
  videoPath: string | null;
  name: string;
  onTap: () => void;
}) => {
  const [error, setError] = useState(false);
  const url = useRef(getVideoThumbUrl(videoPath)).current;
  return (
    <button
      onClick={onTap}
      className="group relative aspect-square rounded-lg overflow-hidden bg-muted flex items-center justify-center"
      title={name}
    >
      {url && !error ? (
        <img
          src={url}
          alt={name}
          loading="lazy"
          className="w-full h-full object-cover"
          onError={() => setError(true)}
        />
      ) : (
        <Dumbbell className="w-5 h-5 text-muted-foreground/50" />
      )}
      <span className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
        <PlayCircle className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
      </span>
    </button>
  );
};

export default MachineExerciseVideos;
