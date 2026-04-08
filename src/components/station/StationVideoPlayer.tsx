import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Info, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Exercise {
  id: string;
  name: string;
  video_path: string | null;
  description: string | null;
  setup_instructions: string | null;
  common_mistakes: string | null;
  tips: string | null;
  primary_muscles: string[];
  secondary_muscles: string[];
  difficulty: number | null;
}

interface StationVideoPlayerProps {
  exercises: Exercise[];
  machineName: string;
}

const extractVideoFilePath = (videoPath: string): string => {
  const bucketMarker = '/exercise-videos/';
  const idx = videoPath.indexOf(bucketMarker);
  if (idx !== -1) return videoPath.substring(idx + bucketMarker.length);
  return videoPath;
};

const DifficultyDots = ({ level }: { level: number | null }) => {
  const max = 4;
  const filled = Math.min(Math.max(level ?? 0, 0), max);
  return (
    <div className="flex gap-1 items-center">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className="w-2.5 h-2.5 rounded-full"
          style={{
            background: i < filled ? '#4CC9FF' : 'rgba(255,255,255,0.2)',
          }}
        />
      ))}
    </div>
  );
};

export const StationVideoPlayer = ({ exercises, machineName }: StationVideoPlayerProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const currentExercise = exercises[currentIndex] ?? null;

  const fetchSignedUrl = useCallback(async (videoPath: string) => {
    setLoadingUrl(true);
    setSignedUrl(null);
    try {
      const filePath = extractVideoFilePath(videoPath);
      const { data, error } = await supabase.storage
        .from('exercise-videos')
        .createSignedUrl(filePath, 3600);
      if (!error && data?.signedUrl) {
        setSignedUrl(data.signedUrl);
      }
    } finally {
      setLoadingUrl(false);
    }
  }, []);

  useEffect(() => {
    if (currentExercise?.video_path) {
      fetchSignedUrl(currentExercise.video_path);
    } else {
      setSignedUrl(null);
    }
    setInfoOpen(false);
  }, [currentExercise, fetchSignedUrl]);

  useEffect(() => {
    if (signedUrl && videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {/* autoplay blocked, ok */});
    }
  }, [signedUrl]);

  const goTo = (index: number) => {
    setCurrentIndex(Math.max(0, Math.min(index, exercises.length - 1)));
  };

  if (!currentExercise) {
    return (
      <div
        className="flex items-center justify-center w-full"
        style={{ height: '60vh', background: '#0B1222', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}
      >
        Žádné cviky
      </div>
    );
  }

  return (
    <div className="relative w-full flex flex-col" style={{ background: '#0B1222' }}>
      {/* Video area */}
      <div className="relative w-full" style={{ aspectRatio: '9/16', maxHeight: '75vh', overflow: 'hidden', background: '#000' }}>
        {signedUrl && !loadingUrl ? (
          <video
            ref={videoRef}
            src={signedUrl}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: '#0B1222' }}>
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#4CC9FF', borderTopColor: 'transparent' }} />
          </div>
        )}

        {/* Left arrow */}
        {currentIndex > 0 && (
          <button
            type="button"
            onClick={() => goTo(currentIndex - 1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-10 h-10 rounded-full"
            style={{ background: 'rgba(11,18,34,0.7)', color: '#fff' }}
            aria-label="Předchozí cvik"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Right arrow */}
        {currentIndex < exercises.length - 1 && (
          <button
            type="button"
            onClick={() => goTo(currentIndex + 1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-10 h-10 rounded-full"
            style={{ background: 'rgba(11,18,34,0.7)', color: '#fff' }}
            aria-label="Další cvik"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        {/* Info button */}
        <button
          type="button"
          onClick={() => setInfoOpen(true)}
          className="absolute top-3 right-3 flex items-center justify-center w-9 h-9 rounded-full"
          style={{ background: 'rgba(11,18,34,0.7)', color: '#4CC9FF' }}
          aria-label="Informace o cviku"
        >
          <Info className="w-5 h-5" />
        </button>

        {/* Dot indicators */}
        {exercises.length > 1 && (
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
            {exercises.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                className="w-2 h-2 rounded-full transition-all"
                style={{
                  background: i === currentIndex ? '#4CC9FF' : 'rgba(255,255,255,0.3)',
                  transform: i === currentIndex ? 'scale(1.3)' : 'scale(1)',
                }}
                aria-label={`Cvik ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Exercise name + machine */}
      <div className="px-4 pt-3 pb-4">
        <p className="font-bold text-lg leading-tight" style={{ color: '#fff' }}>
          {currentExercise.name}
        </p>
        <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
          {machineName}
        </p>
      </div>

      {/* Info overlay */}
      {infoOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col overflow-y-auto"
          style={{ background: 'rgba(11,18,34,0.97)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 sticky top-0" style={{ background: 'rgba(11,18,34,0.97)', borderBottom: '1px solid rgba(76,201,255,0.15)' }}>
            <div>
              <p className="font-bold text-base" style={{ color: '#fff' }}>{currentExercise.name}</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{machineName}</p>
            </div>
            <button
              type="button"
              onClick={() => setInfoOpen(false)}
              className="flex items-center justify-center w-9 h-9 rounded-full"
              style={{ background: 'rgba(255,255,255,0.08)', color: '#fff' }}
              aria-label="Zavřít"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-4 py-5 flex flex-col gap-5">
            {/* Difficulty */}
            {currentExercise.difficulty !== null && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Náročnost
                </p>
                <DifficultyDots level={currentExercise.difficulty} />
              </div>
            )}

            {/* Primary muscles */}
            {currentExercise.primary_muscles.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Primární svaly
                </p>
                <div className="flex flex-wrap gap-2">
                  {currentExercise.primary_muscles.map((m) => (
                    <span
                      key={m}
                      className="px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{ background: 'rgba(76,201,255,0.15)', color: '#4CC9FF', border: '1px solid rgba(76,201,255,0.3)' }}
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Secondary muscles */}
            {currentExercise.secondary_muscles.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Sekundární svaly
                </p>
                <div className="flex flex-wrap gap-2">
                  {currentExercise.secondary_muscles.map((m) => (
                    <span
                      key={m}
                      className="px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.12)' }}
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            {currentExercise.description && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Popis
                </p>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  {currentExercise.description}
                </p>
              </div>
            )}

            {/* Setup instructions */}
            {currentExercise.setup_instructions && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Nastavení
                </p>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  {currentExercise.setup_instructions}
                </p>
              </div>
            )}

            {/* Common mistakes */}
            {currentExercise.common_mistakes && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Časté chyby
                </p>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  {currentExercise.common_mistakes}
                </p>
              </div>
            )}

            {/* Tips */}
            {currentExercise.tips && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Tipy
                </p>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  {currentExercise.tips}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
