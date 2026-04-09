import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, SkipForward, ChevronRight, ArrowLeft, X, Dumbbell, Pause, Play } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getMuscleLabel } from '@/lib/muscleLabels';
import { WorkoutExitDialog } from './WorkoutExitDialog';

export interface WarmupExercise {
  id: string;
  name: string;
  duration: number;
  videoPath: string | null;
  primaryMuscles?: string[];
}

interface WarmupPlayerProps {
  exercises: WarmupExercise[];
  onComplete: () => void;
  onSkipAll: () => void;
  onPause?: (currentIndex: number) => void;
  onEnd?: () => void;
  initialIndex?: number;
}

export const WarmupPlayer = ({ exercises, onComplete, onSkipAll, onPause, onEnd, initialIndex = 0 }: WarmupPlayerProps) => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [timeRemaining, setTimeRemaining] = useState(exercises[initialIndex]?.duration || 30);
  const [isPaused, setIsPaused] = useState(false);
  const [showSkipWarning, setShowSkipWarning] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const currentExercise = exercises[currentIndex];
  const totalExercises = exercises.length;
  const progressPercent = ((currentIndex) / totalExercises) * 100 + (((currentExercise?.duration || 30) - timeRemaining) / (currentExercise?.duration || 30)) * (100 / totalExercises);

  // Countdown timer
  useEffect(() => {
    if (isPaused || !currentExercise) return;

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          // Auto-advance to next exercise
          if (currentIndex < exercises.length - 1) {
            setCurrentIndex(i => i + 1);
            setVideoError(false);
            return exercises[currentIndex + 1]?.duration || 30;
          } else {
            onComplete();
            return 0;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentIndex, isPaused, currentExercise]);

  // Play/pause video with timer
  useEffect(() => {
    if (videoRef.current && currentExercise?.videoPath) {
      videoRef.current.muted = true;
      if (isPaused) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [isPaused, currentExercise?.videoPath]);

  const handleSkipExercise = useCallback(() => {
    if (currentIndex < exercises.length - 1) {
      setCurrentIndex(i => i + 1);
      setTimeRemaining(exercises[currentIndex + 1]?.duration || 30);
      setVideoError(false);
    } else {
      onComplete();
    }
  }, [currentIndex, exercises, onComplete]);

  const handleGoPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(i => i - 1);
      setTimeRemaining(exercises[currentIndex - 1]?.duration || 30);
      setVideoError(false);
    }
  }, [currentIndex, exercises]);

  const confirmSkipAll = useCallback(() => {
    setShowSkipWarning(false);
    onSkipAll();
  }, [onSkipAll]);

  if (!currentExercise) return null;

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="h-[100dvh] bg-black flex flex-col overflow-hidden" style={{ overscrollBehavior: 'none', touchAction: 'none' }}>
      <motion.div
        key={`warmup-${currentIndex}`}
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -30 }}
        transition={{ duration: 0.2 }}
        className="flex-1 flex flex-col relative"
      >
        {/* Full-screen video */}
        <div className="flex-1 relative">
          {currentExercise.videoPath && !videoError ? (
            <video
              ref={videoRef}
              key={currentExercise.videoPath}
              src={currentExercise.videoPath}
              autoPlay loop muted playsInline
              preload="auto"
              className="w-full h-full object-cover"
              onError={() => setVideoError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-neutral-900">
              <div className="text-center">
                <Dumbbell className="w-12 h-12 mx-auto mb-2 text-white/20" />
                <p className="text-white/30 text-sm">{videoError ? 'Video nedostupné' : 'Bez videa'}</p>
              </div>
            </div>
          )}

          {/* Top overlay: back + progress + counter + skip */}
          <div className="absolute top-0 left-0 right-0 safe-top">
            <div className="flex items-center gap-3 px-4 pt-4 pb-2">
              {currentIndex > 0 && (
                <button onClick={handleGoPrevious} className="p-2 -ml-1 rounded-xl bg-black/30 backdrop-blur-sm text-white">
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <div className="flex-1">
                <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-orange-400 rounded-full"
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
              <span className="text-xs text-white/70 shrink-0 bg-black/30 backdrop-blur-sm px-2 py-1 rounded-lg">
                🔥 {currentIndex + 1}/{totalExercises}
              </span>
              <button onClick={handleSkipExercise} className="p-2 rounded-xl bg-black/30 backdrop-blur-sm text-white">
                <SkipForward className="w-5 h-5" />
              </button>
              <button onClick={() => setShowExitDialog(true)} className="p-2 rounded-xl bg-black/30 backdrop-blur-sm text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Top-left: exercise name */}
          <div className="absolute top-16 left-0 px-4 safe-top">
            <div className="bg-black/40 backdrop-blur-sm rounded-xl px-3 py-2 max-w-[70vw]">
              <p className="text-white font-bold text-base leading-tight truncate">{currentExercise.name}</p>
              <p className="text-white/70 text-sm mt-0.5">Rozcvička</p>
              {currentExercise.primaryMuscles && currentExercise.primaryMuscles.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {currentExercise.primaryMuscles.slice(0, 3).map(m => (
                    <span key={m} className="text-[10px] bg-orange-400/20 text-orange-300 px-1.5 py-0.5 rounded-full">{getMuscleLabel(m)}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bottom overlay: timer + buttons */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-16 pb-16 px-5">
            {/* Timer display */}
            <div className="bg-black/40 backdrop-blur-sm rounded-xl px-3 py-2 mb-3">
              <p className={`text-white text-4xl font-bold leading-tight text-center tabular-nums ${timeRemaining <= 5 ? 'text-red-400' : ''}`}>
                {formatTime(timeRemaining)}
              </p>
              <p className="text-white/50 text-xs text-center mt-1">
                Drž pozici {currentExercise.duration} sekund
              </p>
            </div>

            <div className="flex items-end gap-3">
              <div className="flex-1">
                {/* Skip all button */}
                <button
                  onClick={() => setShowSkipWarning(true)}
                  className="w-full bg-white/10 backdrop-blur-sm text-white/60 text-sm font-medium rounded-xl h-12 active:scale-95 transition-transform"
                >
                  Přeskočit rozcvičku
                </button>
              </div>

              {/* Pause/Play button */}
              <button
                onClick={() => setIsPaused(!isPaused)}
                className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform shrink-0 ${isPaused ? 'bg-orange-400 shadow-orange-400/40' : 'bg-white/20 backdrop-blur-sm'}`}
              >
                {isPaused ? <Play className="w-7 h-7 text-white ml-0.5" /> : <Pause className="w-7 h-7 text-white" />}
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Skip warning dialog */}
      <AlertDialog open={showSkipWarning} onOpenChange={setShowSkipWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Přeskočit rozcvičku?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Rozcvička snižuje riziko zranění a připravuje svaly na trénink.
              <strong className="block mt-2 text-amber-600">Nedoporučujeme ji přeskakovat.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zpět na rozcvičku</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSkipAll} className="bg-destructive hover:bg-destructive/90">
              Přesto přeskočit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Exit Dialog */}
      <WorkoutExitDialog
        open={showExitDialog}
        onOpenChange={setShowExitDialog}
        onEnd={() => { if (onEnd) onEnd(); navigate('/'); }}
        onPause={() => { if (onPause) onPause(currentIndex); navigate('/'); }}
        isWarmup={true}
      />
    </div>
  );
};
