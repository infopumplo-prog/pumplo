import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, SkipForward, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RestTimerProps {
  duration: number; // in seconds
  onComplete: () => void;
  onSkip?: () => void;
  label?: string;
  nextExerciseName?: string;
}

// Audio context singleton for beep sounds
let audioCtx: AudioContext | null = null;
const getAudioContext = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
};

const playBeep = (frequency: number = 880, durationMs: number = 150) => {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = frequency;
    gain.gain.value = 0.3;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
    osc.stop(ctx.currentTime + durationMs / 1000);
  } catch {
    // Audio not available — silently ignore
  }
};

const playFinishSound = () => {
  playBeep(1047, 200); // High C
  setTimeout(() => playBeep(1319, 300), 200); // E
};

const speakText = (text: string) => {
  try {
    if (!('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'cs-CZ';
    utterance.rate = 0.9;
    utterance.volume = 0.8;
    speechSynthesis.speak(utterance);
  } catch {
    // Speech not available
  }
};

export const RestTimer = ({ duration, onComplete, onSkip, label = 'Odpočinek', nextExerciseName }: RestTimerProps) => {
  const [isPaused, setIsPaused] = useState(false);
  const [timeLeft, setTimeLeft] = useState(duration);
  const endTimeRef = useRef(Date.now() + duration * 1000);
  const pausedAtRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const spokenRef = useRef(false);
  const beeped3Ref = useRef(false);
  const beeped2Ref = useRef(false);
  const beeped1Ref = useRef(false);

  // Announce next exercise at start
  useEffect(() => {
    if (nextExerciseName && !spokenRef.current) {
      spokenRef.current = true;
      setTimeout(() => {
        speakText(`Další cvik: ${nextExerciseName}`);
      }, 500);
    }
  }, [nextExerciseName]);

  // Main tick — uses real clock, works even after phone sleep
  useEffect(() => {
    if (isPaused) return;

    const tick = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((endTimeRef.current - now) / 1000));
      setTimeLeft(remaining);

      // Countdown beeps
      if (remaining === 3 && !beeped3Ref.current) { beeped3Ref.current = true; playBeep(660, 120); }
      if (remaining === 2 && !beeped2Ref.current) { beeped2Ref.current = true; playBeep(660, 120); }
      if (remaining === 1 && !beeped1Ref.current) { beeped1Ref.current = true; playBeep(660, 120); }

      if (remaining <= 0 && !completedRef.current) {
        completedRef.current = true;
        playFinishSound();
        onComplete();
      }
    };

    // Tick immediately + every 250ms (more responsive than 1s)
    tick();
    const interval = setInterval(tick, 250);

    // Also tick on visibility change (phone wakes up)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isPaused, onComplete]);

  const handlePause = useCallback(() => {
    if (isPaused) {
      // Resume: shift endTime forward by the paused duration
      const pausedDuration = Date.now() - (pausedAtRef.current || Date.now());
      endTimeRef.current += pausedDuration;
      pausedAtRef.current = null;
      // Reset beep refs based on new timeLeft
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
    spokenRef.current = false;
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

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center p-6"
    >
      <p className="text-lg text-muted-foreground mb-2">{label}</p>

      {nextExerciseName && (
        <p className="text-sm font-medium text-primary mb-4">
          Další: {nextExerciseName}
        </p>
      )}

      {/* Circular progress */}
      <div className="relative w-64 h-64 mb-8">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50" cy="50" r="45"
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="8"
          />
          <motion.circle
            cx="50" cy="50" r="45"
            fill="none"
            stroke={timeLeft <= 3 ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 45}`}
            strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
            transition={{ duration: 0.3 }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            key={timeLeft}
            initial={{ scale: 1.05 }}
            animate={{ scale: 1 }}
            className={`text-5xl font-bold tabular-nums ${timeLeft <= 3 ? 'text-destructive' : ''}`}
          >
            {formatTime(timeLeft)}
          </motion.span>
          {isPaused && (
            <span className="text-sm text-muted-foreground mt-2">Pozastaveno</span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          className="w-14 h-14 rounded-full"
          onClick={handleReset}
        >
          <RotateCcw className="w-6 h-6" />
        </Button>

        <Button
          size="icon"
          className="w-20 h-20 rounded-full"
          onClick={handlePause}
        >
          {isPaused ? (
            <Play className="w-10 h-10 ml-1" />
          ) : (
            <Pause className="w-10 h-10" />
          )}
        </Button>

        <Button
          variant="outline"
          size="icon"
          className="w-14 h-14 rounded-full"
          onClick={onSkip || onComplete}
        >
          <SkipForward className="w-6 h-6" />
        </Button>
      </div>

      <p className="text-sm text-muted-foreground mt-6">
        Klikni pro přeskočení
      </p>
    </motion.div>
  );
};
