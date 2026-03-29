import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ChevronRight, Info, MessageSquarePlus, SkipForward, RefreshCw, List, X, Dumbbell } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { RestTimer } from './RestTimer';
import { announceExercise } from '@/lib/workoutAudio';
import { FeedbackModal } from '@/components/feedback/FeedbackModal';
import { TRAINING_ROLE_NAMES } from '@/lib/trainingRoles';

const categoryLabels: Record<string, string> = {
  chest: 'Hrudník', back: 'Záda', shoulders: 'Ramena', arms: 'Paže',
  legs: 'Nohy', core: 'Střed těla', cardio: 'Kardio',
  full_body: 'Celé tělo', abdominals: 'Břicho', strength: 'Síla',
};

const equipmentLabels: Record<string, string> = {
  bodyweight: 'Vlastní váha', barbell: 'Činka', dumbbell: 'Jednoručky',
  kettlebell: 'Kettlebell', machine: 'Stroj', cable: 'Kladka',
  free_weight: 'Volné závaží', plate_loaded: 'Kotouče', other: 'Jiné',
};

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
  restBetweenSets = 90,
  lastWeight,
  setupInstructions,
  commonMistakes,
  tips,
  rirMin,
  rirMax,
  initialSetIndex = 0,
  initialSetsData,
  onSetChange
}: ExercisePlayerProps) => {
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
  const [infoVideoError, setInfoVideoError] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const completedSets = setsData.filter(s => s.completed).length;
  const progressPercent = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;

  // Pre-fill weight from last workout when it loads (async)
  useEffect(() => {
    if (lastWeight && !weight) {
      setWeight(`${lastWeight}`);
    }
  }, [lastWeight]); // eslint-disable-line react-hooks/exhaustive-deps

  // Announce exercise AFTER weight input is pre-filled (matches what user sees)
  const announcedRef = useRef<number>(-1);
  useEffect(() => {
    if (announcedRef.current === exerciseIndex) return;
    if (!weight && lastWeight === undefined) return; // Wait for pre-fill

    announcedRef.current = exerciseIndex;
    const w = weight ? parseFloat(weight) : undefined;
    announceExercise(exerciseName, w && w > 0 ? w : undefined, reps || `${repMax}`);
  }, [exerciseIndex, weight]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync weight/reps inputs when navigating between sets (e.g. going back)
  useEffect(() => {
    const setData = setsData[currentSet];
    if (setData?.completed) {
      setWeight(setData.weight != null ? `${setData.weight}` : '');
      setReps(setData.reps != null ? `${setData.reps}` : `${repMax}`);
    }
  }, [currentSet]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (videoRef.current && videoUrl) {
      videoRef.current.muted = true;
      if (!showRestTimer) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [showRestTimer, videoUrl]);

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
        label={`Odpočinek před ${currentSet + 2}. sérií`}
      />
    );
  }

  return (
    <div className="h-[100dvh] bg-black flex flex-col overflow-hidden" style={{ overscrollBehavior: 'none', touchAction: 'none' }}>
      <motion.div
        key={`exercise-${exerciseIndex}-${currentSet}`}
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -30 }}
        transition={{ duration: 0.2 }}
        className="flex-1 flex flex-col relative"
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
              {(exerciseIndex > 0 || currentSet > 0) && (
                <button onClick={handleGoBack} className="p-2 -ml-1 rounded-xl bg-black/30 backdrop-blur-sm text-white">
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
                <button onClick={onSwapExercise} disabled={isSwapping} className="p-2 rounded-xl bg-black/30 backdrop-blur-sm text-white disabled:opacity-50">
                  <RefreshCw className={`w-5 h-5 ${isSwapping ? 'animate-spin' : ''}`} />
                </button>
              )}
              {onSkipExercise && (
                <button onClick={onSkipExercise} className="p-2 rounded-xl bg-black/30 backdrop-blur-sm text-white">
                  <SkipForward className="w-5 h-5" />
                </button>
              )}
              {onSwitchToList && (
                <button onClick={onSwitchToList} className="p-2 rounded-xl bg-black/30 backdrop-blur-sm text-white">
                  <List className="w-5 h-5" />
                </button>
              )}
              {onClose && (
                <button onClick={onClose} className="p-2 rounded-xl bg-black/30 backdrop-blur-sm text-white">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Top-left: exercise name + set info */}
          <div className="absolute top-16 left-0 px-4 safe-top flex items-start gap-2">
            <div className="bg-black/40 backdrop-blur-sm rounded-xl px-3 py-2 max-w-[70vw]">
              <p className="text-white font-bold text-base leading-tight truncate">{exerciseName}</p>
              <p className="text-white/70 text-sm mt-0.5">
                Série {currentSet + 1} / {totalSets}
                {isCompleted && ' · Hotovo'}
              </p>
              {machineName && (
                <p className="text-white/50 text-xs mt-0.5 truncate">{machineName}</p>
              )}
            </div>
            <button
              onClick={() => setShowInfoDrawer(!showInfoDrawer)}
              className="p-2.5 rounded-xl bg-black/40 backdrop-blur-sm text-white/70 hover:text-white transition-colors"
            >
              <Info className="w-5 h-5" />
            </button>
          </div>

          {/* Bottom overlay: inputs + complete button */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-16 pb-16 px-5">
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
                    {repMin === repMax ? repMin : `${repMin}-${repMax}`} <span className="text-sm font-normal text-white/60">opak.</span>
                  </p>
                  {(rirMin != null || rirMax != null) && (() => {
                    const rir = rirMax ?? rirMin ?? 2;
                    const label = rir >= 4 ? 'Lehké' : rir >= 3 ? 'Pohodlné' : rir >= 2 ? 'Náročné' : rir >= 1 ? 'Těžké' : 'Maximum';
                    const desc = rir >= 3 ? `Nechte si ${rir} opak. v zásobě`
                      : rir >= 1 ? `Nechte si ${rir} opak. v zásobě`
                      : 'Dejte do toho vše';
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
                      <label className="text-[10px] text-white/50 mb-0.5 block px-1">Váha (kg)</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        placeholder="např. 60"
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                        className="w-full bg-white/15 backdrop-blur-sm text-white text-center text-lg font-semibold rounded-xl h-12 border-0 outline-none focus:ring-2 focus:ring-[#5BC8F5]/50 placeholder:text-white/30"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-white/50 mb-0.5 block px-1">Opakování</label>
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
            {videoUrl ? (
              <div className="rounded-2xl overflow-hidden bg-black mb-4 aspect-video">
                {infoVideoError ? (
                  <div className="w-full h-full flex items-center justify-center text-white/50 text-sm">Video nedostupné</div>
                ) : (
                  <video
                    key={videoUrl}
                    src={videoUrl}
                    controls playsInline autoPlay loop muted preload="auto"
                    className="w-full h-full object-contain"
                    onError={() => setInfoVideoError(true)}
                  />
                )}
              </div>
            ) : (
              <div className="rounded-2xl bg-muted mb-4 aspect-video flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Bez videa</p>
              </div>
            )}

            <p className="text-sm text-muted-foreground mb-4">
              {categoryLabels[category] || category}
              {equipmentType && ` · ${equipmentLabels[equipmentType] || equipmentType}`}
              {machineName && ` · ${machineName}`}
            </p>

            <button
              onClick={() => {
                setShowInfoDrawer(false);
                setTimeout(() => setFeedbackOpen(true), 300);
              }}
              className="flex items-center gap-2 w-full px-4 py-3 mb-4 rounded-xl border border-border bg-muted/50 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <MessageSquarePlus className="w-4 h-4 text-[#5BC8F5]" />
              Zpětná vazba k tomuto cviku
            </button>

            {primaryMuscles.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Primární svaly</p>
                <div className="flex flex-wrap gap-1.5">
                  {primaryMuscles.map((m) => (
                    <span key={m} className="text-xs bg-[#5BC8F5]/15 text-[#5BC8F5] px-2.5 py-1 rounded-full font-medium">{m}</span>
                  ))}
                </div>
              </div>
            )}
            {secondaryMuscles.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Sekundární svaly</p>
                <div className="flex flex-wrap gap-1.5">
                  {secondaryMuscles.map((m) => (
                    <span key={m} className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full">{m}</span>
                  ))}
                </div>
              </div>
            )}

            {exerciseDescription && (
              <div className="mb-4 p-3 bg-muted/50 rounded-xl">
                <p className="text-xs font-semibold text-foreground mb-1">Popis & technika</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{exerciseDescription}</p>
              </div>
            )}
            {setupInstructions && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-foreground mb-1">Nastavení</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{setupInstructions}</p>
              </div>
            )}
            {commonMistakes && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-amber-600 mb-1">Časté chyby</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{commonMistakes}</p>
              </div>
            )}
            {tips && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-green-600 mb-1">Tipy</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{tips}</p>
              </div>
            )}
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
