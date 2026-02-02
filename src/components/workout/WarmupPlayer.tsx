import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, SkipForward, ChevronRight, Flame, Pause, Play, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
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
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [timeRemaining, setTimeRemaining] = useState(exercises[0]?.duration || 30);
  const [isPaused, setIsPaused] = useState(false);
  const [isWaitingForTap, setIsWaitingForTap] = useState(false);
  const [showSkipWarning, setShowSkipWarning] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const currentExercise = exercises[currentIndex];
  const totalExercises = exercises.length;
  const progressPercentage = ((currentIndex + 1) / totalExercises) * 100;

  // Fetch signed video URL
  useEffect(() => {
    const fetchVideoUrl = async () => {
      if (!currentExercise?.videoPath) {
        setVideoUrl(null);
        return;
      }

      const { data, error } = await supabase.storage
        .from('exercise-videos')
        .createSignedUrl(currentExercise.videoPath, 3600);

      if (!error && data) {
        setVideoUrl(data.signedUrl);
      } else {
        setVideoUrl(null);
      }
    };

    fetchVideoUrl();
  }, [currentExercise?.videoPath]);

  // Countdown timer - stops when reaches 0 and waits for tap
  useEffect(() => {
    if (isPaused || !currentExercise || isWaitingForTap) return;

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsWaitingForTap(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentIndex, isPaused, currentExercise, isWaitingForTap]);

  // Handle advancing to next exercise (called on tap)
  const handleAdvance = useCallback(() => {
    if (currentIndex < exercises.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setTimeRemaining(exercises[currentIndex + 1]?.duration || 30);
      setIsWaitingForTap(false);
    } else {
      onComplete();
    }
  }, [currentIndex, exercises, onComplete]);

  const handleSkipExercise = useCallback(() => {
    if (currentIndex < exercises.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setTimeRemaining(exercises[currentIndex + 1]?.duration || 30);
      setIsWaitingForTap(false);
    } else {
      onComplete();
    }
  }, [currentIndex, exercises, onComplete]);

  const handleSkipAll = useCallback(() => {
    setShowSkipWarning(true);
  }, []);

  const confirmSkipAll = useCallback(() => {
    setShowSkipWarning(false);
    onSkipAll();
  }, [onSkipAll]);

  const handleExitClick = useCallback(() => {
    setShowExitDialog(true);
  }, []);

  const handleEnd = useCallback(() => {
    if (onEnd) {
      onEnd();
    }
    navigate('/');
  }, [onEnd, navigate]);

  const handlePauseWorkout = useCallback(() => {
    if (onPause) {
      onPause(currentIndex);
    }
    navigate('/');
  }, [onPause, currentIndex, navigate]);

  if (!currentExercise) return null;

  const timerProgressValue = (timeRemaining / currentExercise.duration) * 100;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background flex flex-col w-screen max-w-full overflow-hidden"
    >
      {/* Header */}
      <div className="flex-none p-4 border-b border-border flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={handleExitClick}>
          <X className="w-5 h-5" />
        </Button>
        <Badge variant="secondary" className="gap-1">
          <Flame className="w-3 h-3 text-orange-500" />
          Rozcvička {currentIndex + 1}/{totalExercises}
        </Badge>
        <Button variant="ghost" size="sm" onClick={handleSkipAll} className="text-muted-foreground">
          Přeskočit vše
        </Button>
      </div>

      {/* Exercise progress bar */}
      <div className="flex-none px-4 pt-2">
        <Progress value={progressPercentage} className="h-1" />
      </div>

      {/* Video / Visual area - relative for tap overlay */}
      <div className="flex-1 relative bg-muted/30 flex items-center justify-center min-h-[200px]">
        {videoUrl ? (
          <video
            src={videoUrl}
            loop
            muted
            autoPlay={!isPaused && !isWaitingForTap}
            playsInline
            className="w-full h-full object-contain max-h-[280px]"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-muted-foreground">
            <Flame className="w-16 h-16 mb-4 text-orange-500/50" />
            <p className="text-sm">Vizualizace cviku</p>
          </div>
        )}

        {/* Tap overlay when timer finished */}
        {isWaitingForTap && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 cursor-pointer"
            onClick={handleAdvance}
          >
            <div className="text-center">
              <motion.div 
                className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <ChevronRight className="w-8 h-8 text-primary" />
              </motion.div>
              <p className="text-lg font-semibold">Klepni pro další cvik</p>
              <p className="text-sm text-muted-foreground mt-1">
                {currentIndex < exercises.length - 1 
                  ? exercises[currentIndex + 1].name 
                  : 'Spustit trénink'}
              </p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Timer progress bar */}
      <div className="flex-none px-4 py-3 border-t border-border">
        <div className="flex items-center gap-3">
          <Progress 
            value={timerProgressValue} 
            className={cn(
              "flex-1 h-2 transition-colors",
              timeRemaining <= 5 && "[&>div]:bg-destructive"
            )}
          />
          <span className={cn(
            "text-lg font-bold tabular-nums w-12 text-right transition-colors",
            timeRemaining <= 5 && "text-destructive"
          )}>
            {timeRemaining}s
          </span>
        </div>
      </div>

      {/* Exercise info */}
      <div className="flex-none p-6 text-center border-t border-border">
        <motion.h2
          key={currentExercise.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xl font-bold mb-2"
        >
          {currentExercise.name}
        </motion.h2>
        <p className="text-muted-foreground text-sm">
          Drž pozici / Provádej {currentExercise.duration} sekund
        </p>

        {/* Muscle tags */}
        {currentExercise.primaryMuscles && currentExercise.primaryMuscles.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-center mt-3">
            {currentExercise.primaryMuscles.slice(0, 3).map(muscle => (
              <Badge key={muscle} variant="outline" className="text-xs">
                {getMuscleLabel(muscle)}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex-none p-4 pb-28 border-t border-border flex gap-2">
        <Button
          variant={isPaused ? "default" : "outline"}
          size="lg"
          className="flex-1 gap-2"
          onClick={() => setIsPaused(!isPaused)}
          disabled={isWaitingForTap}
        >
          {isPaused ? (
            <>
              <Play className="w-5 h-5" />
              Pokračovat
            </>
          ) : (
            <>
              <Pause className="w-5 h-5" />
              Pauza
            </>
          )}
        </Button>

        {currentIndex < exercises.length - 1 ? (
          <Button
            variant="outline"
            size="lg"
            className="flex-1 gap-2"
            onClick={handleSkipExercise}
          >
            <SkipForward className="w-5 h-5" />
            Další cvik
          </Button>
        ) : (
          <Button
            size="lg"
            className="flex-1 gap-2"
            onClick={onComplete}
          >
            <ChevronRight className="w-5 h-5" />
            Spustit trénink
          </Button>
        )}
      </div>

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
        onEnd={handleEnd}
        onPause={handlePauseWorkout}
        isWarmup={true}
      />
    </motion.div>
  );
};
