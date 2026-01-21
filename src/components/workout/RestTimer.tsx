import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipForward, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RestTimerProps {
  duration: number; // in seconds
  onComplete: () => void;
  onSkip?: () => void;
  label?: string;
}

export const RestTimer = ({ duration, onComplete, onSkip, label = 'Odpočinek' }: RestTimerProps) => {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused || timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused, timeLeft, onComplete]);

  const handleReset = useCallback(() => {
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
      <p className="text-lg text-muted-foreground mb-4">{label}</p>
      
      {/* Circular progress */}
      <div className="relative w-64 h-64 mb-8">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="8"
          />
          {/* Progress circle */}
          <motion.circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 45}`}
            strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
            initial={{ strokeDashoffset: 2 * Math.PI * 45 }}
            animate={{ strokeDashoffset: 2 * Math.PI * 45 * (1 - progress / 100) }}
            transition={{ duration: 0.5 }}
          />
        </svg>
        
        {/* Time display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            key={timeLeft}
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            className="text-5xl font-bold tabular-nums"
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
          onClick={() => setIsPaused(prev => !prev)}
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
