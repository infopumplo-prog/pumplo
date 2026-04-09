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
      videoRef.current.play().catch(() => {});
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

  // Tap anywhere on video to play (iOS autoplay workaround)
  const handleVideoTap = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, []);

  return (
    <div className="relative w-full h-full flex flex-col" style={{ background: '#000' }}>
      {/* Video area — fills all available space */}
      <div className="relative flex-1 overflow-hidden" onClick={handleVideoTap}>
        {/* Video — always rendered, hidden when no URL */}
        <video
          ref={videoRef}
          src={signedUrl || undefined}
          autoPlay
          loop
          muted
          playsInline
          // @ts-ignore — webkit prefix for iOS
          webkit-playsinline="true"
          className="w-full h-full object-cover"
          style={{ opacity: signedUrl && !loadingUrl ? 1 : 0, transition: 'opacity 0.3s' }}
        />
        {/* Loading spinner */}
        {(!signedUrl || loadingUrl) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#4CC9FF', borderTopColor: 'transparent' }} />
          </div>
        )}

        {/* Bottom gradient overlay for text readability — z-10 to stay above video */}
        <div className="absolute bottom-0 left-0 right-0 pointer-events-none z-10" style={{ height: '60%', background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 40%, transparent 100%)' }} />

        {/* Top gradient for info button */}
        <div className="absolute top-0 left-0 right-0 h-24 pointer-events-none z-10"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 100%)' }} />

        {/* Left arrow */}
        {currentIndex > 0 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goTo(currentIndex - 1); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-11 h-11 rounded-full backdrop-blur-sm"
            style={{ background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }}
            aria-label="Předchozí cvik"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Right arrow */}
        {currentIndex < exercises.length - 1 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goTo(currentIndex + 1); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-11 h-11 rounded-full backdrop-blur-sm"
            style={{ background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }}
            aria-label="Další cvik"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        {/* Info button */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setInfoOpen(true); }}
          className="absolute top-3 right-3 flex items-center justify-center w-10 h-10 rounded-full backdrop-blur-sm z-20"
          style={{ background: 'rgba(0,0,0,0.4)', color: '#4CC9FF', border: '1px solid rgba(76,201,255,0.3)' }}
          aria-label="Informace o cviku"
        >
          <Info className="w-5 h-5" />
        </button>

        {/* Exercise counter badge */}
        <div className="absolute top-3 left-3 px-3 py-1 rounded-full backdrop-blur-sm z-20"
          style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)' }}>
          <span style={{ color: '#4CC9FF', fontSize: '13px', fontWeight: 700 }}>{currentIndex + 1}</span>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}> / {exercises.length}</span>
        </div>

        {/* Exercise name overlay — z-20 above gradient+video, well above CTA */}
        <div className="absolute left-0 right-0 px-4 z-20" style={{ bottom: '160px' }}>
          <p className="font-bold text-xl leading-tight" style={{ color: '#fff', textShadow: '0 1px 8px rgba(0,0,0,0.6)' }}>
            {currentExercise.name}
          </p>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {machineName}
          </p>
          {/* Dot indicators */}
          {exercises.length > 1 && exercises.length <= 20 && (
            <div className="flex gap-1.5 mt-3">
              {exercises.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); goTo(i); }}
                  className="rounded-full transition-all"
                  style={{
                    width: i === currentIndex ? '20px' : '6px',
                    height: '6px',
                    background: i === currentIndex ? '#4CC9FF' : 'rgba(255,255,255,0.35)',
                    borderRadius: '3px',
                  }}
                  aria-label={`Cvik ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
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
