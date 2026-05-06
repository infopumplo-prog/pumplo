import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, SkipForward, ArrowLeft, Dumbbell, Pause, Play, Info, Volume2, VolumeX } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
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
import { WarmupExercise } from './WarmupPlayer';
import { playCountdown3, playCountdown2, playCountdown1, playAlarmFinish, isAudioMuted, setAudioMuted } from '@/lib/workoutAudio';

interface CooldownPlayerProps {
  exercises: WarmupExercise[];
  onComplete: () => void;
  onSkipAll: () => void;
  initialIndex?: number;
}

export const CooldownPlayer = ({ exercises, onComplete, onSkipAll, initialIndex = 0 }: CooldownPlayerProps) => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [timeRemaining, setTimeRemaining] = useState(exercises[initialIndex]?.duration || 30);
  const [isPaused, setIsPaused] = useState(false);
  const [showSkipWarning, setShowSkipWarning] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [showInfoDrawer, setShowInfoDrawer] = useState(false);
  const [isMuted, setIsMuted] = useState(() => isAudioMuted());

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    setAudioMuted(next);
  };
  const endTimeRef = useRef(Date.now() + (exercises[initialIndex]?.duration || 30) * 1000);
  const beeped3Ref = useRef(false);
  const beeped2Ref = useRef(false);
  const beeped1Ref = useRef(false);

  const currentExercise = exercises[currentIndex];
  const hasInfo = !!(currentExercise?.primaryMuscles?.length || currentExercise?.description || currentExercise?.setupInstructions || currentExercise?.commonMistakes || currentExercise?.tips);
  const totalExercises = exercises.length;
  const progressPercent = ((currentIndex) / totalExercises) * 100 + (((currentExercise?.duration || 30) - timeRemaining) / (currentExercise?.duration || 30)) * (100 / totalExercises);

  // Lock screen widget — metadata + countdown timer
  useEffect(() => {
    if (!currentExercise || !('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentExercise.name,
      artist: 'Cooldown · Pumplo',
      artwork: [
        { src: '/pumplo-artwork-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pumplo-artwork-512.png', sizes: '512x512', type: 'image/png' },
      ],
    });
    navigator.mediaSession.playbackState = isPaused ? 'paused' : 'playing';
  }, [currentExercise, isPaused]);

  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentExercise) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: currentExercise.duration,
        position: Math.max(0, currentExercise.duration - timeRemaining),
        playbackRate: isPaused ? 0 : 1,
      });
    } catch {
      // MediaSession API not available in all environments
    }
  }, [timeRemaining, currentExercise, isPaused]);

  // Reset beep refs and clock on each new exercise
  useEffect(() => {
    endTimeRef.current = Date.now() + (currentExercise?.duration || 30) * 1000;
    beeped3Ref.current = false;
    beeped2Ref.current = false;
    beeped1Ref.current = false;
  }, [currentIndex]);

  // Countdown timer — wall-clock based, auto-advance
  useEffect(() => {
    if (isPaused || !currentExercise) return;

    const interval = setInterval(() => {
      const remaining = Math.ceil((endTimeRef.current - Date.now()) / 1000);
      if (remaining === 3 && !beeped3Ref.current) { beeped3Ref.current = true; playCountdown3(); }
      if (remaining === 2 && !beeped2Ref.current) { beeped2Ref.current = true; playCountdown2(); }
      if (remaining === 1 && !beeped1Ref.current) { beeped1Ref.current = true; playCountdown1(); }
      if (remaining <= 0) {
        clearInterval(interval);
        playAlarmFinish();
        if (currentIndex < exercises.length - 1) {
          setCurrentIndex(i => i + 1);
          setVideoError(false);
        } else {
          onComplete();
        }
        return;
      }
      setTimeRemaining(remaining);
    }, 500);

    return () => clearInterval(interval);
  }, [currentIndex, isPaused, currentExercise]);

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
    <div className="h-[100dvh] bg-black flex flex-col overflow-hidden" style={{ overscrollBehavior: 'none' }}>
      <motion.div
        key={`cooldown-${currentIndex}`}
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -30 }}
        transition={{ duration: 0.2 }}
        className="flex-1 flex flex-col relative"
        style={{ pointerEvents: 'auto' }}
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
              style={{ pointerEvents: 'none' }}
              onError={() => setVideoError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-neutral-900">
              <div className="text-center">
                <Dumbbell className="w-12 h-12 mx-auto mb-2 text-white/20" />
                <p className="text-white/30 text-sm">{videoError ? t('workout.video_unavailable') : t('workout.no_video')}</p>
              </div>
            </div>
          )}

          {/* Top overlay: back + progress + counter + skip */}
          <div className="absolute top-0 left-0 right-0 safe-top z-10" style={{ touchAction: 'manipulation', pointerEvents: 'auto' }}>
            <div className="flex items-center gap-3 px-4 pt-4 pb-2">
              {currentIndex > 0 && (
                <button onClick={handleGoPrevious} className="p-2 -ml-1 rounded-xl bg-black/30 backdrop-blur-sm text-white" style={{ pointerEvents: 'auto' }}>
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <div className="flex-1">
                <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-blue-400 rounded-full"
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
              <span className="text-xs text-white/70 shrink-0 bg-black/30 backdrop-blur-sm px-2 py-1 rounded-lg">
                💙 {currentIndex + 1}/{totalExercises}
              </span>
              <button onClick={handleSkipExercise} className="p-2 rounded-xl bg-black/30 backdrop-blur-sm text-white" style={{ pointerEvents: 'auto' }}>
                <SkipForward className="w-5 h-5" />
              </button>
              <button onClick={handleToggleMute} className="p-2 rounded-xl bg-black/30 backdrop-blur-sm text-white" style={{ pointerEvents: 'auto' }}>
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Top-left: exercise name + info */}
          <div
            className="absolute left-0 px-4 flex items-start gap-2"
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 60px)', pointerEvents: 'none' }}
          >
            <div className="bg-black/40 backdrop-blur-sm rounded-xl px-3 py-2 max-w-[65vw]">
              <p className="text-white font-bold text-base leading-tight truncate">{(isEn && currentExercise.nameEn) ? currentExercise.nameEn : currentExercise.name}</p>
              <p className="text-white/70 text-sm mt-0.5">{t('workout.cooldown_label')}</p>
              {currentExercise.primaryMuscles && currentExercise.primaryMuscles.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {currentExercise.primaryMuscles.slice(0, 3).map(m => (
                    <span key={m} className="text-[10px] bg-blue-400/20 text-blue-300 px-1.5 py-0.5 rounded-full">{getMuscleLabel(m)}</span>
                  ))}
                </div>
              )}
            </div>
            {hasInfo && (
              <button
                onClick={() => setShowInfoDrawer(true)}
                className="p-2.5 rounded-xl bg-black/40 backdrop-blur-sm text-white/70 hover:text-white transition-colors"
                style={{ pointerEvents: 'auto' }}
              >
                <Info className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Bottom overlay: timer + buttons */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-16 pb-16 px-5">
            {/* Timer display */}
            <div className="bg-black/40 backdrop-blur-sm rounded-xl px-3 py-2 mb-3">
              <p className={`text-white text-4xl font-bold leading-tight text-center tabular-nums ${timeRemaining <= 5 ? 'text-red-400' : ''}`}>
                {formatTime(timeRemaining)}
              </p>
              <p className="text-white/50 text-xs text-center mt-1">
                {t('workout.hold_position', { duration: currentExercise.duration })}
              </p>
            </div>

            <div className="flex items-end gap-3">
              <div className="flex-1">
                <button
                  onClick={() => setShowSkipWarning(true)}
                  className="w-full bg-white/10 backdrop-blur-sm text-white/60 text-sm font-medium rounded-xl h-12 active:scale-95 transition-transform"
                >
                  {t('workout.skip_cooldown')}
                </button>
              </div>

              {/* Pause/Play button */}
              <button
                onClick={() => setIsPaused(!isPaused)}
                className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform shrink-0 ${isPaused ? 'bg-blue-400 shadow-blue-400/40' : 'bg-white/20 backdrop-blur-sm'}`}
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
              {t('workout.skip_cooldown_title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('workout.skip_cooldown_desc')}
              <strong className="block mt-2 text-amber-600">{t('workout.skip_cooldown_warning')}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('workout.back_to_cooldown')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSkipAll} className="bg-destructive hover:bg-destructive/90">
              {t('workout.skip_anyway')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Info Drawer */}
      <Drawer open={showInfoDrawer} onOpenChange={setShowInfoDrawer}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>{(isEn && currentExercise.nameEn) ? currentExercise.nameEn : currentExercise.name}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 overflow-y-auto space-y-4">
            {currentExercise.primaryMuscles && currentExercise.primaryMuscles.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">{t('workout.muscles')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {currentExercise.primaryMuscles.map(m => (
                    <span key={m} className="text-xs bg-blue-400/15 text-blue-500 px-2.5 py-1 rounded-full font-medium">{getMuscleLabel(m)}</span>
                  ))}
                </div>
              </div>
            )}
            {(currentExercise.description || currentExercise.descriptionEn) && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">{t('workout.description')}</p>
                <p className="text-sm leading-relaxed">{(isEn && currentExercise.descriptionEn) ? currentExercise.descriptionEn : currentExercise.description}</p>
              </div>
            )}
            {(currentExercise.setupInstructions || currentExercise.setupInstructionsEn) && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">{t('workout.setup')}</p>
                <p className="text-sm leading-relaxed whitespace-pre-line">{(isEn && currentExercise.setupInstructionsEn) ? currentExercise.setupInstructionsEn : currentExercise.setupInstructions}</p>
              </div>
            )}
            {currentExercise.commonMistakes && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">{t('workout.common_mistakes')}</p>
                <p className="text-sm leading-relaxed">{currentExercise.commonMistakes}</p>
              </div>
            )}
            {currentExercise.tips && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">{t('workout.tips')}</p>
                <p className="text-sm leading-relaxed">{currentExercise.tips}</p>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};
