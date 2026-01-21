import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, SkipForward, ChevronRight, Flame, Timer } from 'lucide-react';
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

export interface WarmupExercise {
  id: string;
  name: string;
  duration: number; // in seconds
  videoPath: string | null;
  primaryMuscles?: string[];
}

interface WarmupPlayerProps {
  exercises: WarmupExercise[];
  onComplete: () => void;
  onSkipAll: () => void;
}

export const WarmupPlayer = ({ exercises, onComplete, onSkipAll }: WarmupPlayerProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(exercises[0]?.duration || 30);
  const [isPaused, setIsPaused] = useState(false);
  const [showSkipWarning, setShowSkipWarning] = useState(false);
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

  // Countdown timer
  useEffect(() => {
    if (isPaused || !currentExercise) return;

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          // Move to next exercise
          if (currentIndex < exercises.length - 1) {
            setCurrentIndex(curr => curr + 1);
            return exercises[currentIndex + 1]?.duration || 30;
          } else {
            clearInterval(interval);
            onComplete();
            return 0;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentIndex, exercises, onComplete, isPaused, currentExercise]);

  const handleSkipExercise = useCallback(() => {
    if (currentIndex < exercises.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setTimeRemaining(exercises[currentIndex + 1]?.duration || 30);
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

  if (!currentExercise) return null;

  // Calculate progress for SVG circle
  const circumference = 2 * Math.PI * 48;
  const progressOffset = circumference * (1 - timeRemaining / currentExercise.duration);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background flex flex-col"
    >
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Flame className="w-3 h-3 text-orange-500" />
            Rozcvička {currentIndex + 1}/{totalExercises}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSkipAll} className="text-muted-foreground">
          Přeskočit vše
        </Button>
      </div>

      {/* Progress bar */}
      <div className="px-4 pt-2">
        <Progress value={progressPercentage} className="h-1" />
      </div>

      {/* Video / Visual area */}
      <div className="flex-1 relative bg-muted/30 flex items-center justify-center min-h-[240px]">
        {videoUrl ? (
          <video
            src={videoUrl}
            loop
            muted
            autoPlay
            playsInline
            className="w-full h-full object-contain max-h-[300px]"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-muted-foreground">
            <Flame className="w-16 h-16 mb-4 text-orange-500/50" />
            <p className="text-sm">Vizualizace cviku</p>
          </div>
        )}

        {/* Circular timer with progress ring */}
        <motion.div
          className="absolute bottom-4 left-1/2 -translate-x-1/2"
          initial={{ scale: 0.8 }}
          animate={{ 
            scale: timeRemaining <= 5 ? [1, 1.05, 1] : 1 
          }}
          transition={{ 
            duration: 0.5, 
            repeat: timeRemaining <= 5 ? Infinity : 0 
          }}
        >
          <div className="relative w-28 h-28">
            {/* SVG progress ring */}
            <svg className="w-full h-full -rotate-90">
              {/* Background circle */}
              <circle
                cx="56"
                cy="56"
                r="48"
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                className="text-muted/30"
              />
              {/* Progress circle */}
              <circle
                cx="56"
                cy="56"
                r="48"
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                strokeLinecap="round"
                className={cn(
                  "transition-colors duration-300",
                  timeRemaining <= 5 ? "text-destructive" : "text-primary"
                )}
                strokeDasharray={circumference}
                strokeDashoffset={progressOffset}
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>
            
            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Timer className="w-4 h-4 mb-1 text-muted-foreground" />
              <span className={cn(
                "text-3xl font-bold transition-colors duration-300",
                timeRemaining <= 5 && "text-destructive"
              )}>
                {timeRemaining}
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Exercise info */}
      <div className="p-6 text-center border-t border-border">
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

        {/* Muscle tags - formatted */}
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
      <div className="p-4 pb-28 border-t border-border flex gap-2">
        <Button
          variant="outline"
          size="lg"
          className="flex-1 gap-2"
          onClick={handleSkipExercise}
        >
          <SkipForward className="w-5 h-5" />
          Další cvik
        </Button>

        {currentIndex === exercises.length - 1 && (
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
    </motion.div>
  );
};
