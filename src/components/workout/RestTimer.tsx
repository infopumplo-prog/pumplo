import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { App as CapApp } from '@capacitor/app';
import { useTranslation } from 'react-i18next';
import { Play, Pause, SkipForward, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { playCountdown3, playCountdown2, playCountdown1, playAlarmFinish, isAudioMuted, setAudioMuted } from '@/lib/workoutAudio';
import { startRestBeeps, stopRestBeeps } from '@/lib/restAudioNative';

interface RestTimerProps {
  duration: number; // in seconds
  onComplete: () => void;
  onSkip?: () => void;
  label?: string;
  nextExerciseName?: string;
  nextVideoUrl?: string | null;
}

export const RestTimer = ({ duration, onComplete, onSkip, label, nextExerciseName, nextVideoUrl }: RestTimerProps) => {
  const { t } = useTranslation();
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(() => isAudioMuted());

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    setAudioMuted(next);
  };
  const [timeLeft, setTimeLeft] = useState(duration);
  const endTimeRef = useRef(Date.now() + duration * 1000);
  const pausedAtRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const beeped3Ref = useRef(false);
  const beeped2Ref = useRef(false);
  const beeped1Ref = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const nativeBeepsRef = useRef(false); // true once native audio owns the beeps

  // The background video pauses when iOS suspends the webview (e.g. user switches
  // to Spotify). Resume it whenever the app/tab comes back to the foreground.
  useEffect(() => {
    const resumeVideo = () => { videoRef.current?.play().catch(() => {}); };
    const onVisible = () => { if (document.visibilityState === 'visible') resumeVideo(); };
    document.addEventListener('visibilitychange', onVisible);
    const sub = CapApp.addListener('resume', resumeVideo);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      sub.then(s => s.remove()).catch(() => {});
    };
  }, []);

  // No speech during rest — exercise announcement happens when next exercise loads

  // Native audio: play the whole countdown (incl. final beep) as one background-
  // capable clip so it's heard even when the phone is locked / app backgrounded /
  // headphones in, while music keeps playing. No banner notification. On web (or
  // if the native plugin is unavailable) this no-ops and the JS beeps below run.
  useEffect(() => {
    if (isPaused || completedRef.current) {
      stopRestBeeps();
      nativeBeepsRef.current = false;
      return;
    }
    const remaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
    let cancelled = false;
    startRestBeeps(remaining).then(handled => { if (!cancelled) nativeBeepsRef.current = handled; });
    return () => { cancelled = true; stopRestBeeps(); nativeBeepsRef.current = false; };
  }, [isPaused]);

  // Main tick — uses real clock, works even after phone sleep
  useEffect(() => {
    if (isPaused) return;

    const tick = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((endTimeRef.current - now) / 1000));
      setTimeLeft(remaining);

      // JS beeps are a fallback for web / when native audio isn't handling them.
      if (!nativeBeepsRef.current) {
        if (remaining === 3 && !beeped3Ref.current) { beeped3Ref.current = true; playCountdown3(); }
        if (remaining === 2 && !beeped2Ref.current) { beeped2Ref.current = true; playCountdown2(); }
        if (remaining === 1 && !beeped1Ref.current) { beeped1Ref.current = true; playCountdown1(); }
      }

      if (remaining <= 0 && !completedRef.current) {
        completedRef.current = true;
        if (!nativeBeepsRef.current) playAlarmFinish();
        stopRestBeeps();
        onComplete();
      }
    };

    tick();
    const interval = setInterval(tick, 250);
    const handleVisibility = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isPaused, onComplete]);

  const handlePause = useCallback(() => {
    if (isPaused) {
      const pausedDuration = Date.now() - (pausedAtRef.current || Date.now());
      endTimeRef.current += pausedDuration;
      pausedAtRef.current = null;
      const remaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
      beeped3Ref.current = remaining < 3;
      beeped2Ref.current = remaining < 2;
      beeped1Ref.current = remaining < 1;
    } else {
      pausedAtRef.current = Date.now();
    }
    setIsPaused(prev => !prev);
  }, [isPaused]);

  const handleReset = useCallback(() => {
    endTimeRef.current = Date.now() + duration * 1000;
    pausedAtRef.current = null;
    completedRef.current = false;
    beeped3Ref.current = false;
    beeped2Ref.current = false;
    beeped1Ref.current = false;
    setTimeLeft(duration);
    setIsPaused(false);
  }, [duration]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = ((duration - timeLeft) / duration) * 100;
  const onVideo = !!nextVideoUrl;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-0 z-50 overflow-hidden flex flex-col items-center justify-center p-6"
    >
      {/* Background: the next-exercise video fills the screen (user sees the next
          movement while resting). Falls back to a solid backdrop if no video. */}
      {onVideo ? (
        <>
          <video
            ref={videoRef}
            src={nextVideoUrl!}
            autoPlay loop muted playsInline preload="auto"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />
        </>
      ) : (
        <div className="absolute inset-0 bg-background/95 backdrop-blur-sm" />
      )}

      <button
        onClick={handleToggleMute}
        className={cn(
          'absolute right-4 z-20 p-2.5 rounded-xl',
          onVideo ? 'bg-black/40 text-white' : 'bg-muted/80 text-foreground'
        )}
        style={{ top: 'max(16px, calc(env(safe-area-inset-top, 0px) + 8px))' }}
      >
        {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
      </button>

      <div className="relative z-10 flex flex-col items-center w-full">
        <p className={cn('text-lg mb-2', onVideo ? 'text-white/80' : 'text-muted-foreground')}>{label ?? t('workout.rest')}</p>

        {nextExerciseName && (
          <p className={cn('text-sm font-medium mb-6', onVideo ? 'text-cyan-300' : 'text-primary')}>
            {t('workout.next_exercise', { name: nextExerciseName })}
          </p>
        )}

        <div className="relative w-64 h-64 mb-8">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke={onVideo ? 'rgba(255,255,255,0.2)' : 'hsl(var(--muted))'} strokeWidth="8" />
            <motion.circle
              cx="50" cy="50" r="45" fill="none"
              stroke={timeLeft <= 3 ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'}
              strokeWidth="8" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 45}`}
              strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
              transition={{ duration: 0.3 }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {timeLeft <= 3 && timeLeft > 0 ? (
              <motion.span
                key={timeLeft}
                initial={{ scale: 1.5, opacity: 0.5 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-7xl font-black text-destructive"
              >
                {timeLeft}
              </motion.span>
            ) : (
              <motion.span
                key={timeLeft}
                initial={{ scale: 1.05 }}
                animate={{ scale: 1 }}
                className={cn('text-5xl font-bold tabular-nums', onVideo && 'text-white')}
              >
                {formatTime(timeLeft)}
              </motion.span>
            )}
            {isPaused && <span className={cn('text-sm mt-2', onVideo ? 'text-white/70' : 'text-muted-foreground')}>{t('workout.paused')}</span>}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="w-14 h-14 rounded-full" onClick={handleReset}>
            <RotateCcw className="w-6 h-6" />
          </Button>
          <Button size="icon" className="w-20 h-20 rounded-full" onClick={handlePause}>
            {isPaused ? <Play className="w-10 h-10 ml-1" /> : <Pause className="w-10 h-10" />}
          </Button>
          <Button variant="outline" size="icon" className="w-14 h-14 rounded-full" onClick={onSkip || onComplete}>
            <SkipForward className="w-6 h-6" />
          </Button>
        </div>

        <p className={cn('text-sm mt-6', onVideo ? 'text-white/60' : 'text-muted-foreground')}>{t('workout.skip_tap')}</p>
      </div>
    </motion.div>
  );
};
