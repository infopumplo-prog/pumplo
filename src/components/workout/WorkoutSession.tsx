/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { X, Trophy, Clock, Dumbbell, Weight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExercisePlayer } from './ExercisePlayer';
import { RestTimer } from './RestTimer';
import { WorkoutExitDialog } from './WorkoutExitDialog';
import { WorkoutShareCard } from './WorkoutShareCard';
import { WorkoutExercise, TrainingGoalId } from '@/lib/trainingGoals';
import { supabase } from '@/integrations/supabase/client';
import { getSignedVideoUrl } from '@/lib/videoUtils';
import { useWorkoutHistory } from '@/hooks/useWorkoutHistory';
import { ExerciseSkipDialog } from './ExerciseSkipDialog';
import { CARDIO_ROLE_IDS } from '@/lib/bmiUtils';
import { CompactWorkoutView } from './CompactWorkoutView';
import { toast } from 'sonner';
import { CooldownPlayer } from './CooldownPlayer';

interface SetData {
  completed: boolean;
  weight?: number;
  reps?: number;
}

interface ExerciseResult {
  exerciseId: string;
  exerciseName: string;
  sets: SetData[];
}

interface WorkoutSessionProps {
  exercises: WorkoutExercise[];
  dayLetter: string;
  goalId: TrainingGoalId;
  planId: string | null;
  gymId: string;
  isBonus?: boolean;
  onComplete: (results: ExerciseResult[]) => void;
  onCancel: () => void;
  onPause?: (currentExerciseIndex: number, results: ExerciseResult[], currentSetIndex: number, currentExerciseSets: SetData[]) => void;
  initialExerciseIndex?: number;
  initialResults?: ExerciseResult[];
  initialSetIndex?: number;
  initialCurrentExerciseSets?: SetData[];
  skipNavigateOnComplete?: boolean;
  cooldownExercises?: import('./WarmupPlayer').WarmupExercise[];
}

// Per-category rest times (seconds) per goal
// Trainer rules v3: main gets full rest, secondary reduced, isolation/core short
const getRestSecondsForCategory = (goalId: string, slotCategory?: string | null): number => {
  const cat = slotCategory || 'secondary';
  switch (goalId) {
    case 'strength':
      if (cat === 'main') return 300;              // 5 min
      if (cat === 'secondary') return 180;          // 3 min
      return 120;                                   // isolation/core/conditioning: 2 min
    case 'muscle_gain':
      if (cat === 'main') return 180;              // 3 min
      if (cat === 'secondary') return 120;          // 2 min
      return 90;                                    // isolation/core/conditioning: 1.5 min
    case 'fat_loss':
    case 'general_fitness':
    default:
      return 60;                                    // 1 min for all categories
  }
};


export const WorkoutSession = ({
  exercises,
  dayLetter,
  goalId,
  planId,
  gymId,
  isBonus = false,
  onComplete,
  onCancel,
  onPause,
  initialExerciseIndex = 0,
  initialResults = [],
  initialSetIndex = 0,
  initialCurrentExerciseSets,
  skipNavigateOnComplete = false,
  cooldownExercises = [],
}: WorkoutSessionProps) => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';
  const navigate = useNavigate();
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(initialExerciseIndex);
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [restDuration, setRestDuration] = useState(0);
  const [restLabel, setRestLabel] = useState('');
  // Results stored by exercise index for back-navigation support
  const [resultsByIndex, setResultsByIndex] = useState<Map<number, ExerciseResult>>(() => {
    const map = new Map<number, ExerciseResult>();
    initialResults.forEach((r, i) => map.set(i, r));
    return map;
  });
  const [showSummary, setShowSummary] = useState(false);
  const [showCooldown, setShowCooldown] = useState(false);
  const [cooldownDone, setCooldownDone] = useState(false);

  // Show cooldown first (if available), then summary
  const triggerPostWorkout = useCallback(() => {
    if (cooldownExercises.length > 0 && !cooldownDone) {
      setShowCooldown(true);
    } else {
      setShowSummary(true);
    }
  }, [cooldownExercises.length, cooldownDone]);
  const [workoutStartTime] = useState(new Date());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [gymName, setGymName] = useState<string>('');
  const [gymInstagram, setGymInstagram] = useState<string | null>(null);
  const [isSwapping, setIsSwapping] = useState(false);
  const [viewMode, setViewMode] = useState<'video' | 'list'>('video');
  // Mutable exercises array for live swap
  const [liveExercises, setLiveExercises] = useState<WorkoutExercise[]>(exercises);
  // currentExercise declared here so it's available in the useEffect dep arrays below
  const currentExercise = liveExercises[currentExerciseIndex];

  // Prefetch the NEXT exercise's video URL while the current one plays, so on
  // slow connections it's already buffering and we can show it during the rest
  // (lets the user walk to the next machine). video_path is a full public URL.
  const [nextVideoUrl, setNextVideoUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const nextId = liveExercises[currentExerciseIndex + 1]?.exerciseId;
    if (!nextId) { setNextVideoUrl(null); return; }
    supabase.from('exercises').select('video_path').eq('id', nextId).single()
      .then(({ data }) => {
        if (cancelled) return;
        const url = data?.video_path || null;
        setNextVideoUrl(url);
        // Warm the cache NOW (during the current exercise) via a detached video
        // element so the rest screen shows it instantly/smoothly.
        if (url) {
          try {
            const v = document.createElement('video');
            v.preload = 'auto'; v.muted = true; v.src = url; v.load();
          } catch { /* noop */ }
        }
      });
    return () => { cancelled = true; };
  }, [currentExerciseIndex, liveExercises]);

  // Lock screen widget — elapsed count-up timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - workoutStartTime.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [workoutStartTime]);

  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentExercise) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentExercise.exerciseName,
      artist: gymName || t('workout.media_artist'),
      artwork: [
        { src: '/pumplo-artwork-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pumplo-artwork-512.png', sizes: '512x512', type: 'image/png' },
      ],
    });
    navigator.mediaSession.playbackState = 'playing';
    try {
      navigator.mediaSession.setPositionState({
        duration: 5400,
        position: Math.min(elapsedSeconds, 5400),
        playbackRate: 1,
      });
    } catch {
      // MediaSession API not available in all environments
    }
  }, [currentExercise, gymName, elapsedSeconds]);

  const [showSkipDialog, setShowSkipDialog] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  // Track sets data per exercise for compact mode
  const [setsDataByExercise, setSetsDataByExercise] = useState<Map<number, SetData[]>>(new Map());
  const { saveWorkoutSession, isSaving } = useWorkoutHistory();
  // Track the highest exercise index reached (for forward progress)
  const [highestIndexReached, setHighestIndexReached] = useState(initialExerciseIndex);

  // Fetch gym name for share card
  useEffect(() => {
    if (!gymId) return;
    supabase
      .from('gyms')
      .select('name, instagram_handle')
      .eq('id', gymId)
      .single()
      .then(({ data }) => {
        if (data?.name) setGymName(data.name);
        if (data?.instagram_handle) setGymInstagram(data.instagram_handle);
      });
  }, [gymId]);
  
  /**
   * Swap current exercise for the closest alternative with same role.
   * Queries DB for exercises matching role_id, available at gym, excluding used exercises.
   */
  const handleSwapExercise = useCallback(async () => {
    if (isSwapping) return;
    setIsSwapping(true);

    try {
      const exercise = liveExercises[currentExerciseIndex];
      if (!exercise) return;

      const roleId = exercise.roleId;
      const isCardio = CARDIO_ROLE_IDS.includes(roleId);

      // IDs to exclude: all exercises currently in workout
      const excludeIds = liveExercises
        .map(e => e.exerciseId)
        .filter((id): id is string => !!id);

      // Fetch gym machine IDs for equipment filtering
      const { data: gymMachines } = await supabase
        .from('gym_machines')
        .select('machine_id')
        .eq('gym_id', gymId);
      const machineIds = new Set((gymMachines || []).map(m => m.machine_id));

      // Query candidates with same role
      let query = supabase
        .from('exercises')
        .select('id, name, name_en, primary_role, machine_id, equipment_type, primary_muscles, secondary_muscles, category')
        .eq('allowed_phase', 'main');

      if (isCardio) {
        query = query.eq('category', 'cardio');
      } else {
        query = query.eq('primary_role', roleId);
      }

      const { data: candidates, error } = await query;
      if (error || !candidates || candidates.length === 0) {
        toast.error(t('workout.no_replacement'));
        return;
      }

      // Filter: exclude current exercises, must be available at gym (machine check)
      const valid = candidates.filter(c => {
        if (excludeIds.includes(c.id)) return false;
        if (c.machine_id && !machineIds.has(c.machine_id)) return false;
        return true;
      });

      console.log(`[Swap] Role: ${roleId}, DB candidates: ${candidates?.length}, after gym/exclude filter: ${valid.length}`);
      console.log(`[Swap] Valid exercises:`, valid.map(v => v.name));

      if (valid.length === 0) {
        toast.error(t('workout.no_replacement'));
        return;
      }

      // Pick random from all valid candidates
      const pick = valid[Math.floor(Math.random() * valid.length)];

      // Fetch machine name if applicable
      let newMachineName: string | null = null;
      let newMachineNameEn: string | null = null;
      if (pick.machine_id) {
        const { data: machine } = await supabase
          .from('machines')
          .select('name, name_en')
          .eq('id', pick.machine_id)
          .single();
        newMachineName = machine?.name || null;
        newMachineNameEn = (machine as Record<string, unknown> | null)?.name_en as string | null || null;
      }

      // Update DB
      if (planId && exercise.exerciseId) {
        await supabase
          .from('user_workout_exercises')
          .update({
            exercise_id: pick.id,
            is_fallback: true,
            fallback_reason: 'user_swap',
          })
          .eq('plan_id', planId)
          .eq('day_letter', dayLetter)
          .eq('slot_order', exercise.slotOrder);
      }

      // Update in-memory
      setLiveExercises(prev => {
        const updated = [...prev];
        updated[currentExerciseIndex] = {
          ...exercise,
          exerciseId: pick.id,
          exerciseName: pick.name,
          exerciseNameEn: (pick as Record<string, unknown>).name_en as string | null || null,
          machineName: newMachineName,
          machineNameEn: newMachineNameEn,
          isFallback: true,
          fallbackReason: 'user_swap',
        };
        return updated;
      });

      toast.success(t('workout.swap_success', { name: pick.name }));
    } catch (err) {
      console.error('[Swap] Error:', err);
      toast.error(t('workout.swap_error'));
    } finally {
      setIsSwapping(false);
    }
  }, [currentExerciseIndex, liveExercises, gymId, planId, dayLetter, isSwapping]);

  // Track current set state for pause functionality
  const [currentSetIndex, setCurrentSetIndex] = useState(initialSetIndex);
  const [currentExerciseSets, setCurrentExerciseSets] = useState<SetData[]>(
    initialCurrentExerciseSets || []
  );

  // Note: weight tracking is now determined by exercise_with_weights field from DB

  const handleCompleteExercise = useCallback((setsData: SetData[]) => {
    const newResult: ExerciseResult = {
      exerciseId: currentExercise.exerciseId || '',
      exerciseName: currentExercise.exerciseName || '',
      sets: setsData
    };

    setResultsByIndex(prev => new Map(prev).set(currentExerciseIndex, newResult));
    setSetsDataByExercise(prev => new Map(prev).set(currentExerciseIndex, setsData));

    if (currentExerciseIndex < liveExercises.length - 1) {
      // Show rest timer before next exercise — use the NEXT exercise's category for rest
      const nextExercise = liveExercises[currentExerciseIndex + 1];
      const nextRest = getRestSecondsForCategory(goalId, nextExercise?.slotCategory);
      setRestDuration(nextRest);
      setRestLabel(t('workout.next_exercise_prep'));
      setShowRestTimer(true);
      setHighestIndexReached(prev => Math.max(prev, currentExerciseIndex + 1));
    } else {
      // Workout complete
      triggerPostWorkout();
    }
  }, [currentExercise, currentExerciseIndex, liveExercises.length, goalId, liveExercises]);

  const handleRestComplete = useCallback(() => {
    setShowRestTimer(false);
    setCurrentExerciseIndex(prev => prev + 1);
  }, []);

  const handleSkipClick = useCallback(() => {
    setShowSkipDialog(true);
  }, []);

  const handleConfirmSkip = useCallback(() => {
    const newResult: ExerciseResult = {
      exerciseId: currentExercise.exerciseId || '',
      exerciseName: currentExercise.exerciseName || '',
      sets: []
    };
    setResultsByIndex(prev => new Map(prev).set(currentExerciseIndex, newResult));

    if (currentExerciseIndex < liveExercises.length - 1) {
      setCurrentExerciseIndex(prev => prev + 1);
      setHighestIndexReached(prev => Math.max(prev, currentExerciseIndex + 1));
    } else {
      triggerPostWorkout();
    }
  }, [currentExercise, currentExerciseIndex, liveExercises.length]);

  // Navigate to previous exercise
  const handleGoPrevious = useCallback(() => {
    if (currentExerciseIndex > 0) {
      setShowRestTimer(false);
      setCurrentExerciseIndex(prev => prev - 1);
    }
  }, [currentExerciseIndex]);

  // Navigate to next exercise (only if already visited)
  const handleGoNext = useCallback(() => {
    if (currentExerciseIndex < highestIndexReached) {
      setShowRestTimer(false);
      setCurrentExerciseIndex(prev => prev + 1);
    }
  }, [currentExerciseIndex, highestIndexReached]);

  // Convert indexed results to ordered array
  const results = Array.from({ length: liveExercises.length }, (_, i) => resultsByIndex.get(i))
    .filter((r): r is ExerciseResult => r !== undefined);

  // Auto-save workout as soon as all exercises are completed
  const [workoutSaved, setWorkoutSaved] = useState(false);

  useEffect(() => {
    if (showSummary && !workoutSaved) {
      const autoSave = async () => {
        const orderedResults = Array.from({ length: liveExercises.length }, (_, i) => resultsByIndex.get(i))
          .filter((r): r is ExerciseResult => r !== undefined);

        await saveWorkoutSession({
          planId,
          gymId,
          dayLetter,
          goalId,
          startedAt: workoutStartTime,
          results: orderedResults,
          isBonus
        });

        setWorkoutSaved(true);
      };
      autoSave();
    }
  }, [showSummary, workoutSaved]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFinishWorkout = useCallback(() => {
    const orderedResults = Array.from({ length: liveExercises.length }, (_, i) => resultsByIndex.get(i))
      .filter((r): r is ExerciseResult => r !== undefined);
    onComplete(orderedResults);
    navigate('/');
  }, [navigate, liveExercises, resultsByIndex, onComplete]);

  // Calculate workout stats
  const totalDuration = Math.floor((Date.now() - workoutStartTime.getTime()) / 1000 / 60);
  const totalSets = results.reduce((sum, r) => sum + r.sets.filter(s => s.completed).length, 0);
  const totalWeight = results.reduce((sum, r) =>
    sum + r.sets.reduce((setSum, s) => setSum + ((s.weight || 0) * (s.reps || 0)), 0), 0
  );

  // Calculate total reps for share card
  const totalReps = results.reduce((sum, r) =>
    sum + r.sets.reduce((setSum, s) => setSum + (s.completed ? (s.reps || 0) : 0), 0), 0
  );

  // Compact mode: complete a single set for any exercise
  const handleCompactCompleteSet = useCallback((exerciseIndex: number, setIndex: number, weight?: number, reps?: number) => {
    const exercise = liveExercises[exerciseIndex];
    if (!exercise) return;

    setSetsDataByExercise(prev => {
      const updated = new Map(prev);
      const existing = updated.get(exerciseIndex) ||
        Array.from({ length: exercise.sets }, () => ({ completed: false }));
      const newSets = [...existing];
      newSets[setIndex] = { completed: true, weight, reps };
      updated.set(exerciseIndex, newSets);

      // Check if all sets for this exercise are done
      const allDone = newSets.every(s => s.completed);
      if (allDone) {
        // Save result
        const result: ExerciseResult = {
          exerciseId: exercise.exerciseId || '',
          exerciseName: exercise.exerciseName || '',
          sets: newSets
        };
        setResultsByIndex(prev2 => new Map(prev2).set(exerciseIndex, result));

        // Auto-advance to next incomplete exercise
        const nextIdx = liveExercises.findIndex((_, i) => {
          if (i <= exerciseIndex) return false;
          const sets = updated.get(i);
          if (!sets) return true;
          return sets.some(s => !s.completed);
        });
        if (nextIdx !== -1) {
          setCurrentExerciseIndex(nextIdx);
          setHighestIndexReached(prev2 => Math.max(prev2, nextIdx));
        } else {
          // Check if ALL exercises done
          const allExercisesDone = liveExercises.every((_, i) => {
            const sets = updated.get(i);
            return sets && sets.every(s => s.completed);
          });
          if (allExercisesDone) {
            triggerPostWorkout();
          }
        }
      }

      return updated;
    });
  }, [liveExercises]);

  const handleCompactSelectExercise = useCallback((index: number) => {
    setCurrentExerciseIndex(index);
    setHighestIndexReached(prev => Math.max(prev, index));
  }, []);

  // Cooldown phase (between last exercise and summary)
  if (showCooldown) {
    return (
      <CooldownPlayer
        exercises={cooldownExercises}
        onComplete={() => {
          setShowCooldown(false);
          setCooldownDone(true);
          setShowSummary(true);
        }}
        onSkipAll={() => {
          setShowCooldown(false);
          setCooldownDone(true);
          setShowSummary(true);
          toast.info(t('workout.cooldown_skipped'));
        }}
      />
    );
  }

  // Summary / Share screen
  if (showSummary) {
    return (
      <WorkoutShareCard
        dayLetter={dayLetter}
        goalId={goalId}
        gymName={gymName}
        gymInstagram={gymInstagram}
        totalDuration={totalDuration}
        totalSets={totalSets}
        totalWeight={totalWeight}
        totalReps={totalReps}
        exerciseCount={results.length}
        exerciseDetails={results.map(r => ({ name: r.exerciseName, nameEn: r.exerciseNameEn ?? null, sets: r.sets.filter(s => s.completed).map(s => ({ weight: s.weight || 0, reps: s.reps || 0 })) }))}
        isBonus={isBonus}
        onClose={() => setShowSummary(false)}
        onFinish={handleFinishWorkout}
        isSaving={isSaving}
        onAbandon={handleFinishWorkout}
        abandonDescription={t('workout.abandon_desc')}
      />
    );
  }

  // Rest timer overlay
  if (showRestTimer) {
    return (
      <RestTimer
        duration={restDuration}
        onComplete={handleRestComplete}
        label={restLabel}
        nextExerciseName={(isEn && liveExercises[currentExerciseIndex + 1]?.exerciseNameEn) ? liveExercises[currentExerciseIndex + 1]!.exerciseNameEn! : (liveExercises[currentExerciseIndex + 1]?.exerciseName || undefined)}
        nextVideoUrl={nextVideoUrl}
      />
    );
  }

  // Main exercise player
  if (!currentExercise) return null;

  // Compact list mode
  if (viewMode === 'list') {
    return (
      <div className="fixed inset-0 z-[60]">
        <CompactWorkoutView
          exercises={liveExercises}
          currentExerciseIndex={currentExerciseIndex}
          setsDataByExercise={setsDataByExercise}
          onCompleteSet={handleCompactCompleteSet}
          onSelectExercise={handleCompactSelectExercise}
          onSwitchToVideo={() => setViewMode('video')}
          onClose={() => setShowExitDialog(true)}
          onSkipExercise={handleSkipClick}
          onSwapExercise={handleSwapExercise}
          isSwapping={isSwapping}
          totalExercises={liveExercises.length}
        />

        {/* Skip Dialog */}
        <ExerciseSkipDialog
          open={showSkipDialog}
          onOpenChange={setShowSkipDialog}
          exerciseId={currentExercise.exerciseId}
          exerciseName={(isEn && currentExercise.exerciseNameEn) ? currentExercise.exerciseNameEn : (currentExercise.exerciseName || t('workout.exercise_label'))}
          gymId={gymId}
          planId={planId || undefined}
          dayLetter={dayLetter}
          onConfirmSkip={handleConfirmSkip}
        />

        {/* Exit Dialog */}
        <WorkoutExitDialog
          open={showExitDialog}
          onOpenChange={setShowExitDialog}
          onEnd={() => {
            onCancel();
            navigate('/');
          }}
          onPause={() => {
            if (onPause) {
              onPause(currentExerciseIndex, results, currentSetIndex, currentExerciseSets);
            }
            navigate('/');
          }}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60]">
      <ExercisePlayerWithVideo
        key={currentExerciseIndex}
        exercise={currentExercise}
        exerciseIndex={currentExerciseIndex}
        totalExercises={liveExercises.length}
        onCompleteExercise={handleCompleteExercise}
        onSkipExercise={handleSkipClick}
        onSwapExercise={handleSwapExercise}
        isSwapping={isSwapping}
        onSwitchToList={() => setViewMode('list')}
        onClose={() => setShowExitDialog(true)}
        onGoPrevious={currentExerciseIndex > 0 ? handleGoPrevious : undefined}
        onGoNext={currentExerciseIndex < highestIndexReached ? handleGoNext : undefined}
        isCompleted={resultsByIndex.has(currentExerciseIndex)}
        showWeightInput={true}
        restBetweenSets={getRestSecondsForCategory(goalId, currentExercise?.slotCategory)}
        gymId={gymId}
        planId={planId || undefined}
        dayLetter={dayLetter}
        initialSetIndex={currentExerciseIndex === initialExerciseIndex ? initialSetIndex : 0}
        initialSetsData={currentExerciseIndex === initialExerciseIndex ? initialCurrentExerciseSets : undefined}
        onSetChange={(setIdx, sets) => {
          setCurrentSetIndex(setIdx);
          setCurrentExerciseSets(sets);
        }}
        nextExerciseName={(isEn && liveExercises[currentExerciseIndex + 1]?.exerciseNameEn) ? liveExercises[currentExerciseIndex + 1]!.exerciseNameEn! : (liveExercises[currentExerciseIndex + 1]?.exerciseName || undefined)}
        nextVideoUrl={nextVideoUrl}
      />

      {/* Skip Dialog */}
      <ExerciseSkipDialog
        open={showSkipDialog}
        onOpenChange={setShowSkipDialog}
        exerciseId={currentExercise.exerciseId}
        exerciseName={currentExercise.exerciseName || t('workout.exercise_label')}
        gymId={gymId}
        planId={planId || undefined}
        dayLetter={dayLetter}
        onConfirmSkip={handleConfirmSkip}
      />

      {/* Exit Dialog */}
      <WorkoutExitDialog
        open={showExitDialog}
        onOpenChange={setShowExitDialog}
        onEnd={() => {
          onCancel();
          navigate('/');
        }}
        onPause={() => {
          if (onPause) {
            onPause(currentExerciseIndex, results, currentSetIndex, currentExerciseSets);
          }
          navigate('/');
        }}
      />
    </div>
  );
};

// Wrapper component to fetch video URL
const ExercisePlayerWithVideo = ({
  exercise,
  exerciseIndex,
  totalExercises,
  onCompleteExercise,
  onSkipExercise,
  onSwapExercise,
  isSwapping,
  onSwitchToList,
  onClose,
  onGoPrevious,
  onGoNext,
  isCompleted,
  showWeightInput,
  restBetweenSets,
  gymId,
  planId,
  dayLetter,
  initialSetIndex = 0,
  initialSetsData,
  onSetChange,
  nextExerciseName,
  nextVideoUrl,
}: {
  exercise: WorkoutExercise;
  exerciseIndex: number;
  totalExercises: number;
  onCompleteExercise: (setsData: SetData[]) => void;
  onSkipExercise: () => void;
  onSwapExercise?: () => void;
  isSwapping?: boolean;
  onSwitchToList?: () => void;
  onClose?: () => void;
  onGoPrevious?: () => void;
  onGoNext?: () => void;
  isCompleted?: boolean;
  showWeightInput: boolean;
  restBetweenSets: number;
  gymId?: string;
  planId?: string;
  dayLetter?: string;
  initialSetIndex?: number;
  initialSetsData?: SetData[];
  onSetChange?: (setIndex: number, setsData: SetData[]) => void;
  nextExerciseName?: string;
  nextVideoUrl?: string | null;
}) => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';
  const [videoData, setVideoData] = useState<{
    url: string | null;
    description: string | null;
    descriptionEn: string | null;
    setupInstructions: string | null;
    setupInstructionsEn: string | null;
    commonMistakes: string | null;
    commonMistakesEn: string | null;
    tips: string | null;
    tipsEn: string | null;
    difficulty: number | null;
    exerciseWithWeights: boolean;
    category: string;
    equipmentType: string | null;
    primaryMuscles: string[];
    secondaryMuscles: string[];
    primaryMusclesEn: string[];
    secondaryMusclesEn: string[];
  }>({ url: null, description: null, descriptionEn: null, setupInstructions: null, setupInstructionsEn: null, commonMistakes: null, commonMistakesEn: null, tips: null, tipsEn: null, difficulty: null, exerciseWithWeights: true, category: '', equipmentType: null, primaryMuscles: [], secondaryMuscles: [], primaryMusclesEn: [], secondaryMusclesEn: [] });
  const [lastWeight, setLastWeight] = useState<number | undefined>(undefined);

  // Fetch video path + detail from exercise on mount
  useEffect(() => {
    const fetchVideoData = async () => {
      if (!exercise.exerciseId) return;

      const { data } = await supabase
        .from('exercises')
        .select('video_path, difficulty, exercise_with_weights, category, equipment_type, primary_muscles, secondary_muscles, primary_muscles_en, secondary_muscles_en, description, description_en, setup_instructions, setup_instructions_en, common_mistakes, common_mistakes_en, tips, tips_en')
        .eq('id', exercise.exerciseId)
        .single();

      if (data) {
        setVideoData({
          url: data.video_path || null,
          description: data.description || null,
          descriptionEn: data.description_en || null,
          setupInstructions: data.setup_instructions || null,
          setupInstructionsEn: data.setup_instructions_en || null,
          commonMistakes: data.common_mistakes || null,
          commonMistakesEn: data.common_mistakes_en || null,
          tips: data.tips || null,
          tipsEn: data.tips_en || null,
          difficulty: data.difficulty,
          exerciseWithWeights: data.exercise_with_weights ?? true,
          category: data.category || '',
          equipmentType: data.equipment_type || null,
          primaryMuscles: data.primary_muscles || [],
          secondaryMuscles: data.secondary_muscles || [],
          primaryMusclesEn: data.primary_muscles_en || [],
          secondaryMusclesEn: data.secondary_muscles_en || [],
        });
      }
    };
    fetchVideoData();
  }, [exercise.exerciseId]);

  // Fetch last weight used for this exercise
  useEffect(() => {
    const fetchLastWeight = async () => {
      if (!exercise.exerciseId) return;

      const { data } = await supabase
        .from('workout_session_sets')
        .select('weight_kg')
        .eq('exercise_id', exercise.exerciseId)
        .not('weight_kg', 'is', null)
        .gt('weight_kg', 0)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data?.weight_kg) {
        setLastWeight(data.weight_kg);
      }
    };
    fetchLastWeight();
  }, [exercise.exerciseId]);

  return (
    <ExercisePlayer
      exerciseId={exercise.exerciseId || undefined}
      exerciseName={(isEn && exercise.exerciseNameEn) ? exercise.exerciseNameEn : (exercise.exerciseName || t('workout.exercise_label'))}
      exerciseDescription={(isEn && videoData.descriptionEn) ? videoData.descriptionEn : (videoData.description || undefined)}
      setupInstructions={(isEn && videoData.setupInstructionsEn) ? videoData.setupInstructionsEn : (videoData.setupInstructions || undefined)}
      commonMistakes={((isEn && videoData.commonMistakesEn) ? videoData.commonMistakesEn : videoData.commonMistakes) || undefined}
      tips={((isEn && videoData.tipsEn) ? videoData.tipsEn : videoData.tips) || undefined}
      rirMin={exercise.rirMin}
      rirMax={exercise.rirMax}
      videoUrl={videoData.url}
      roleId={exercise.roleId}
      equipment={exercise.equipment || []}
      machineName={(isEn && exercise.machineNameEn) ? exercise.machineNameEn : exercise.machineName}
      difficulty={videoData.difficulty || exercise.difficulty}
      totalSets={exercise.sets}
      repMin={exercise.repMin}
      repMax={exercise.repMax}
      exerciseIndex={exerciseIndex}
      totalExercises={totalExercises}
      onCompleteExercise={onCompleteExercise}
      onSkipExercise={onSkipExercise}
      onSwapExercise={onSwapExercise}
      isSwapping={isSwapping}
      onSwitchToList={onSwitchToList}
      onClose={onClose}
      onGoPrevious={onGoPrevious}
      onGoNext={onGoNext}
      isCompleted={isCompleted}
      showWeightInput={videoData.exerciseWithWeights}
      category={videoData.category}
      equipmentType={videoData.equipmentType}
      primaryMuscles={videoData.primaryMuscles}
      secondaryMuscles={videoData.secondaryMuscles}
      primaryMusclesEn={videoData.primaryMusclesEn}
      secondaryMusclesEn={videoData.secondaryMusclesEn}
      restBetweenSets={restBetweenSets}
      lastWeight={lastWeight}
      initialSetIndex={initialSetIndex}
      initialSetsData={initialSetsData}
      onSetChange={onSetChange}
      nextExerciseName={nextExerciseName}
      nextVideoUrl={nextVideoUrl}
    />
  );
};
