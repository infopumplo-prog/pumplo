import { useState, useRef, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ChevronRight, Info, MessageSquarePlus, SkipForward, RefreshCw, List, X, Dumbbell, Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { playBeep, playCountdown3, playCountdown2, playCountdown1, playAlarmFinish, isAudioMuted, setAudioMuted } from '@/lib/workoutAudio';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { RestTimer } from './RestTimer';
import { FeedbackModal } from '@/components/feedback/FeedbackModal';
import { ExerciseInfoContent } from './ExerciseInfoContent';
import { TRAINING_ROLE_NAMES } from '@/lib/trainingRoles';


interface SetData {
  completed: boolean;
  weight?: number;
  reps?: number;
}

interface ExercisePlayerProps {
  exerciseId?: string;
  exerciseName: string;
  exerciseDescription?: string;
  videoUrl: string | null;
  roleId: string;
  equipment: string[];
  machineName?: string | null;
  difficulty?: number;
  totalSets: number;
  repMin: number;
  repMax: number;
  exerciseIndex: number;
  totalExercises: number;
  onCompleteExercise: (setsData: SetData[]) => void;
  onSkipExercise?: () => void;
  onSwapExercise?: () => void;
  isSwapping?: boolean;
  onSwitchToList?: () => void;
  onClose?: () => void;
  onGoPrevious?: () => void;
  onGoNext?: () => void;
  isCompleted?: boolean;
  showWeightInput?: boolean;
  category?: string;
  equipmentType?: string | null;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  primaryMusclesEn?: string[] | null;
  secondaryMusclesEn?: string[] | null;
  restBetweenSets?: number;
  lastWeight?: number;
  setupInstructions?: string | null;
  commonMistakes?: string | null;
  tips?: string | null;
  rirMin?: number | null;
  rirMax?: number | null;
  initialSetIndex?: number;
  initialSetsData?: SetData[];
  onSetChange?: (currentSetIndex: number, setsData: SetData[]) => void;
  nextExerciseName?: string;
  nextVideoUrl?: string | null;
}

export const ExercisePlayer = ({
  exerciseId,
  exerciseName,
  exerciseDescription,
  videoUrl,
  roleId,
  machineName,
  totalSets,
  repMin,
  repMax,
  exerciseIndex,
  totalExercises,
  onCompleteExercise,
  onSkipExercise,
  onSwapExercise,
  isSwapping = false,
  onSwitchToList,
  onClose,
  onGoPrevious,
  onGoNext,
  isCompleted = false,
  showWeightInput = true,
  category = '',
  equipmentType,
  primaryMuscles = [],
  secondaryMuscles = [],
  primaryMusclesEn,
  secondaryMusclesEn,
  restBetweenSets = 90,
  lastWeight,
  setupInstructions,
  commonMistakes,
  tips,
  rirMin,
  rirMax,
  initialSetIndex = 0,
  initialSetsData,
  onSetChange,
  nextExerciseName,
  nextVideoUrl
}: ExercisePlayerProps) => {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentSet, setCurrentSet] = useState(initialSetIndex);
  const [setsData, setSetsData] = useState<SetData[]>(
    initialSetsData || Array.from({ length: totalSets }, () => ({ completed: false }))
  );
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [weight, setWeight] = useState<string>(lastWeight ? `${lastWeight}` : '');
  const [reps, setReps] = useState<string>(`${repMax}`);
  const [showInfoDrawer, setShowInfoDrawer] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(() => isAudioMuted());

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    setAudioMuted(next);
  };

  const completedSets = setsData.filter(s => s.completed).length;
  const progressPercent = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;

  const isCardio = category === 'cardio';
  const cardioTotalSeconds = repMax * 60;
  const [cardioTimeLeft, setCardioTimeLeft] = useState(cardioTotalSeconds);
  const [cardioPaused, setCardioPaused] = useState(false);
  const cardioEndTimeRef = useRef(Date.now() + cardioTotalSeconds * 1000);
  const cardioPausedAtRef = useRef<number | null>(null);
  const cardioDoneRef = useRef(false);
  const cardioB3 = useRef(false), cardioB2 = useRef(false), cardioB1 = useRef(false);

  const handleCardioComplete = useCallback(() => {
    if (cardioDoneRef.current) return;
    cardioDoneRef.current = true;
    playAlarmFinish();
    onCompleteExercise([{ completed: true, reps: repMax }]);
  }, [onCompleteExercise, repMax]);

  useEffect(() => {
    if (!isCardio) return;
    if (cardioPaused) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((cardioEndTimeRef.current - Date.now()) / 1000));
      setCardioTimeLeft(remaining);
      if (remaining === 3 && !cardioB3.current) { cardioB3.current = true; playCountdown3(); }
      if (remaining === 2 && !cardioB2.current) { cardioB2.current = true; playCountdown2(); }
      if (remaining === 1 && !cardioB1.current) { cardioB1.current = true; playCountdown1(); }
      if (remaining <= 0) handleCardioComplete();
    };
    tick();
    const interval = setInterval(tick, 250);
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
  }, [isCardio, cardioPaused, handleCardioComplete]);

  const handleCardioPause = useCallback(() => {
    if (cardioPaused) {
      const paused = Date.now() - (cardioPausedAtRef.current || Date.now());
      cardioEndTimeRef.current += paused;
      cardioPausedAtRef.current = null;
      const remaining = Math.max(0, Math.ceil((cardioEndTimeRef.current - Date.now()) / 1000));
      cardioB3.current = remaining < 3;
      cardioB2.current = remaining < 2;
      cardioB1.current = remaining < 1;
    } else {
      cardioPausedAtRef.current = Date.now();
    }
    setCardioPaused(p => !p);
  }, [cardioPaused]);

  const formatCardioTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  // Pre-fill weight from last workout when it loads (async)
  useEffect(() => {
    if (lastWeight && !weight) {
      setWeight(`${lastWeight}`);
    }
  }, [lastWeight, exerciseIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync weight/reps inputs when navigating between sets (e.g. going back)
  useEffect(() => {
    const setData = setsData[currentSet];
    if (setData?.completed) {
      setWeight(setData.weight != null ? `${setData.weight}` : '');
      setReps(setData.reps != null ? `${setData.reps}` : `${repMax}`);
    }
  }, [currentSet]); // eslint-disable-line react-hooks/exhaustive-deps

  // Robust autoplay: the <video> can mount before its data is buffered, so a
  // bare play() right after mount rejects on the first set (it only worked on
  // set 2 once the file was cached). playVideo() retries; onCanPlay/onLoadedData
  // on the element call it once the video is actually ready.
  const playVideo = useCallback(() => {
    const v = videoRef.current;
    if (!v || !videoUrl || showRestTimer) return;
    v.muted = true;
    const p = v.play();
    if (p) p.catch(() => {});
  }, [videoUrl, showRestTimer]);

  useEffect(() => {
    if (showRestTimer) {
      videoRef.current?.pause();
      return;
    }
    playVideo();

    // Resume playback when the user returns to the app. visibilitychange covers
    // web/PWA; Capacitor 'resume' is the reliable signal in the native WKWebView.
    const onVisible = () => { if (document.visibilityState === 'visible') playVideo(); };
    document.addEventListener('visibilitychange', onVisible);
    let removeResume: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      App.addListener('resume', playVideo).then((h) => { removeResume = () => h.remove(); });
    }
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      removeResume?.();
    };
  }, [showRestTimer, videoUrl, playVideo]);

  const handleCompleteSet = () => {
    const weightNum = weight ? parseFloat(weight) : undefined;
    const repsNum = reps ? parseInt(reps) : repMax;

    const newSetsData = [...setsData];
    newSetsData[currentSet] = { completed: true, weight: weightNum, reps: repsNum };
    setSetsData(newSetsData);

    if (onSetChange) {
      onSetChange(currentSet + 1, newSetsData);
    }

    setReps(`${repMax}`);

    if (currentSet + 1 >= totalSets) {
      onCompleteExercise(newSetsData);
    } else {
      setShowRestTimer(true);
    }
  };

  const handleRestComplete = () => {
    setShowRestTimer(false);
    const newSetIndex = currentSet + 1;
    setCurrentSet(newSetIndex);
    // Pre-fill weight from previous set for convenience (keep current reps default)
    const prevSet = setsData[currentSet];
    if (prevSet?.weight != null) {
      setWeight(`${prevSet.weight}`);
    }
    setReps(`${repMax}`);
    if (onSetChange) {
      onSetChange(newSetIndex, setsData);
    }
  };

  const handleGoBack = () => {
    if (currentSet > 0) {
      setCurrentSet(prev => prev - 1);
    } else if (onGoPrevious) {
      onGoPrevious();
    }
  };

  if (showRestTimer) {
    return (
      <RestTimer
        duration={restBetweenSets}
        onComplete={handleRestComplete}
        label={t('workout.rest_before_set', { n: currentSet + 2 })}
      />
    );
  }

  return (
    <div className="h-[100dvh] bg-black flex flex-col overflow-hidden" style={{ overscrollBehavior: 'none' }}>
      <motion.div
        key={`exercise-${exerciseIndex}-${currentSet}`}
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -30 }}
        transition={{ duration: 0.2 }}
        className="flex-1 flex flex-col relative"
        style={{ pointerEvents: 'auto' }}
      >
        {/* Full-screen video */}
        <div className="flex-1 relative">
          {videoUrl && !videoError ? (
            <video
              ref={videoRef}
              key={videoUrl}
              src={videoUrl}
              autoPlay loop muted playsInline
              preload="auto"
              className="w-full h-full object-cover"
              style={{ pointerEvents: 'none' }}
              onLoadedData={playVideo}
              onCanPlay={playVideo}
              onError={() => setVideoError(true)}
            />
          ) : (
            <div className="w-full h-full bg-neutral-900" />
          )}

          {/* Top overlay: back + progress + counter + swap + skip + list + mute + close */}
          <div className="absolute top-0 left-0 right-0 safe-top z-10" style={{ touchAction: 'manipulation', pointerEvents: 'auto' }}>
            <div className="flex items-center gap-1 px-4 pt-4 pb-2">
              {(exerciseIndex > 0 || currentSet > 0) && (
                <button onClick={handleGoBack} className="p-2 -ml-1 rounded-xl bg-black/30 backdrop-blur-sm text-white" style={{ pointerEvents: 'auto' }}>
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <div className="flex-1">
                <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-[#5BC8F5] rounded-full"
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
              <span className="text-xs text-white/70 shrink-0 bg-black/30 backdrop-blur-sm px-2 py-1 rounded-lg">
                {exerciseIndex + 1}/{totalExercises}
              </span>
              {onSwapExercise && (
                <button onClick={onSwapExercise} className={`p-2 rounded-xl bg-black/30 backdrop-blur-sm text-white ${isSwapping ? 'opacity-50' : ''}`} style={{ pointerEvents: 'auto' }}>
                  <RefreshCw className={`w-5 h-5 ${isSwapping ? 'animate-spin' : ''}`} />
                </button>
              )}
              {onSkipExercise && (
                <button onClick={onSkipExercise} className="p-2 rounded-xl bg-black/30 backdrop-blur-sm text-white" style={{ pointerEvents: 'auto' }}>
                  <SkipForward className="w-5 h-5" />
                </button>
              )}
              {onSwitchToList && (
                <button onClick={onSwitchToList} className="p-2 rounded-xl bg-black/30 backdrop-blur-sm text-white" style={{ pointerEvents: 'auto' }}>
                  <List className="w-5 h-5" />
                </button>
              )}
              <button onClick={handleToggleMute} className="p-2 rounded-xl bg-black/30 backdrop-blur-sm text-white" style={{ pointerEvents: 'auto' }}>
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              {onClose && (
                <button onClick={onClose} className="p-2 rounded-xl bg-black/30 backdrop-blur-sm text-white" style={{ pointerEvents: 'auto' }}>
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Top-left: exercise name + set info */}
          <div
            className="absolute left-0 px-4 flex items-start gap-2"
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 60px)', pointerEvents: 'none' }}
          >
            <div className="bg-black/40 backdrop-blur-sm rounded-xl px-3 py-2 max-w-[70vw]">
              <p className="text-white font-bold text-base leading-tight truncate">{exerciseName}</p>
              <p className="text-white/70 text-sm mt-0.5">
                {t('workout.set_label', { current: currentSet + 1, total: totalSets })}
                {isCompleted && t('workout.done_label')}
              </p>
              {machineName && (
                <p className="text-white/50 text-xs mt-0.5 truncate">{machineName}</p>
              )}
            </div>
            <button
              onClick={() => setShowInfoDrawer(!showInfoDrawer)}
              className="p-2.5 rounded-xl bg-black/40 backdrop-blur-sm text-white/70 hover:text-white transition-colors"
              style={{ pointerEvents: 'auto' }}
            >
              <Info className="w-5 h-5" />
            </button>
          </div>

          {/* Bottom overlay: cardio timer OR strength inputs */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-16 pb-16 px-5">
            {/* On the last set, preview the next exercise so the user can plan
                ahead / walk to the next machine. Hidden on the final exercise. */}
            {currentSet + 1 === totalSets && nextExerciseName && (
              <div className="flex items-center gap-2 mb-3 w-fit max-w-[80vw] bg-black/40 backdrop-blur-sm rounded-xl p-1.5 pr-3">
                {nextVideoUrl ? (
                  <video
                    src={nextVideoUrl}
                    autoPlay loop muted playsInline preload="auto"
                    className="w-11 h-11 rounded-lg object-cover shrink-0"
                    style={{ pointerEvents: 'none' }}
                  />
                ) : (
                  <div className="w-11 h-11 rounded-lg bg-white/10 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-[#5BC8F5] text-[10px] font-semibold uppercase tracking-wide leading-none mb-0.5">{t('workout.next_label')}</p>
                  <p className="text-white text-sm font-semibold truncate leading-tight">{nextExerciseName}</p>
                </div>
              </div>
            )}
            {isCardio ? (
              <div className="flex flex-col items-center gap-4">
                <div className="bg-black/40 backdrop-blur-sm rounded-xl px-6 py-3 text-center">
                  <p className="text-white/60 text-xs mb-1">{t('workout.cardio_minutes', { n: repMax })}</p>
                  <p className={`text-5xl font-bold tabular-nums ${cardioTimeLeft <= 10 ? 'text-red-400' : 'text-white'}`}>
                    {formatCardioTime(cardioTimeLeft)}
                  </p>
                  {cardioPaused && <p className="text-white/50 text-xs mt-1">{t('workout.paused')}</p>}
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleCardioPause}
                    className="w-16 h-16 rounded-full bg-[#5BC8F5] flex items-center justify-center shadow-lg shadow-[#5BC8F5]/40 active:scale-95 transition-transform"
                  >
                    {cardioPaused ? <Play className="w-7 h-7 text-white ml-1" /> : <Pause className="w-7 h-7 text-white" />}
                  </button>
                  <button
                    onClick={handleCardioComplete}
                    className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform"
                  >
                    <SkipForward className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Previous sets summary */}
                {setsData.some(s => s.completed && s.weight) && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {setsData.map((set, i) =>
                      set.completed && set.weight ? (
                        <span key={i} className="text-xs bg-white/15 backdrop-blur-sm text-white/80 px-2 py-1 rounded-lg">
                          S{i + 1}: {set.weight}kg × {set.reps || repMax}
                        </span>
                      ) : null
                    )}
                  </div>
                )}

                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    {/* Reps + RIR display */}
                    <div className="bg-black/40 backdrop-blur-sm rounded-xl px-3 py-2 mb-2">
                      <p className="text-white text-2xl font-bold leading-tight">
                        {repMin === repMax ? repMin : `${repMin}-${repMax}`} <span className="text-sm font-normal text-white/60">{t('workout.reps_abbr')}</span>
                      </p>
                      {(rirMin != null || rirMax != null) && (() => {
                        const rir = rirMax ?? rirMin ?? 2;
                        const label = rir >= 4 ? t('workout.rir_easy') : rir >= 3 ? t('workout.rir_comfortable') : rir >= 2 ? t('workout.rir_challenging') : rir >= 1 ? t('workout.rir_hard') : t('workout.rir_max');
                        const desc = rir >= 1 ? t('workout.rir_reserve', { n: rir }) : t('workout.rir_all_out');
                        const color = rir >= 3 ? 'text-green-400' : rir >= 2 ? 'text-amber-400' : 'text-red-400';
                        return (
                          <div className={`mt-1 flex items-center gap-2 ${color}`}>
                            <span className="text-xs font-bold">{label}</span>
                            <span className="text-[10px] text-white/40">{desc}</span>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Weight and reps inputs */}
                    {showWeightInput && currentSet < totalSets && (
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] text-white/50 mb-0.5 block px-1">{t('workout.weight_kg')}</label>
                          <input
                            type="number"
                            inputMode="decimal"
                            placeholder={t('workout.weight_placeholder')}
                            value={weight}
                            onChange={(e) => setWeight(e.target.value)}
                            className="w-full bg-white/15 backdrop-blur-sm text-white text-center text-lg font-semibold rounded-xl h-12 border-0 outline-none focus:ring-2 focus:ring-[#5BC8F5]/50 placeholder:text-white/30"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] text-white/50 mb-0.5 block px-1">{t('workout.reps')}</label>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={reps}
                            onChange={(e) => setReps(e.target.value)}
                            className="w-full bg-white/15 backdrop-blur-sm text-white text-center text-lg font-semibold rounded-xl h-12 border-0 outline-none focus:ring-2 focus:ring-[#5BC8F5]/50"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Complete set button */}
                  {currentSet < totalSets && (
                    <button
                      onClick={handleCompleteSet}
                      className="w-16 h-16 rounded-full bg-[#5BC8F5] flex items-center justify-center shadow-lg shadow-[#5BC8F5]/40 active:scale-95 transition-transform shrink-0"
                    >
                      <ChevronRight className="w-8 h-8 text-white" />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* Info drawer */}
      <Drawer open={showInfoDrawer} onOpenChange={setShowInfoDrawer}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>{exerciseName}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 overflow-y-auto">
            <ExerciseInfoContent
              category={category}
              equipmentType={equipmentType}
              machineName={machineName}
              primaryMuscles={primaryMuscles}
              secondaryMuscles={secondaryMuscles}
              primaryMusclesEn={primaryMusclesEn}
              secondaryMusclesEn={secondaryMusclesEn}
              description={exerciseDescription}
              setupInstructions={setupInstructions}
              commonMistakes={commonMistakes}
              tips={tips}
            >
              <button
                onClick={() => {
                  setShowInfoDrawer(false);
                  setTimeout(() => setFeedbackOpen(true), 300);
                }}
                className="flex items-center gap-2 w-full px-4 py-3 mb-4 rounded-xl border border-border bg-muted/50 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <MessageSquarePlus className="w-4 h-4 text-[#5BC8F5]" />
                {t('workout.feedback_btn')}
              </button>
            </ExerciseInfoContent>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Feedback modal */}
      <FeedbackModal
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        exercises={exerciseId ? [{ id: exerciseId, name: exerciseName }] : []}
        workoutContext={{ exercise_id: exerciseId }}
      />
    </div>
  );
};
