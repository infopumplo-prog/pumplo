/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Clock, Dumbbell, Weight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExercisePlayer } from './ExercisePlayer';
import { RestTimer } from './RestTimer';
import { WorkoutExitDialog } from './WorkoutExitDialog';
import { WorkoutShareCard } from './WorkoutShareCard';
import { WorkoutExercise, TrainingGoalId } from '@/lib/trainingGoals';
import { supabase } from '@/integrations/supabase/client';
import { getSignedVideoUrl, getVideoThumbUrl } from '@/lib/videoUtils';
import { showSetActivity, endRestActivity, startRestActivity, consumePendingEvents, addLockScreenListener, type NextSetPayload } from '@/lib/restLiveActivity';
import { startRestBeeps, stopRestBeeps } from '@/lib/restAudioNative';
import { scheduleRestEndNotification, cancelRestEndNotification } from '@/lib/restNotification';
import { playCountdown3, playCountdown2, playCountdown1, playAlarmFinish } from '@/lib/workoutAudio';
import { useWorkoutHistory } from '@/hooks/useWorkoutHistory';
import { writePausedWorkoutSnapshot, clearPausedWorkoutStorage } from '@/hooks/usePausedWorkout';
import { ExerciseSkipDialog } from './ExerciseSkipDialog';
import { CARDIO_ROLE_IDS } from '@/lib/bmiUtils';
import { CompactWorkoutView } from './CompactWorkoutView';
import { toast } from 'sonner';
import { CooldownPlayer } from './CooldownPlayer';
import { ExerciseSwapSheet } from './ExerciseSwapSheet';
import { ExerciseInfoSheet } from './ExerciseInfoSheet';
import { fetchGymBoundAlternatives, type SwapCandidate } from '@/lib/exerciseSwap';
import { resolveWatchRestEndsAt, resolveLoggedWeight, resolveSetStep, type BuildInput, type WatchAction } from '@/lib/watchWorkout';
import { useWatchBridge } from '@/hooks/useWatchBridge';

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
  // True while ExercisePlayer runs its OWN between-set rest (video view). The
  // idle-card effect uses it so it never overwrites the rest countdown; when it
  // flips back to false the effect re-runs and repaints the upcoming-set card.
  const [playerResting, setPlayerResting] = useState(false);
  // Ref mirror so the idle-card effect can read the rest flag SYNCHRONOUSLY in
  // the same commit the set completes — ExercisePlayer sets this (true) in its
  // completion handler, one render before the state-driven re-run would land.
  const playerRestingRef = useRef(false);
  // Konec pauzy, kterou si řídí ExercisePlayer (video režim). WorkoutSession
  // ji sám nespouští, ale hodinky potřebují stejný čas jako telefon.
  const [playerRestEndsAt, setPlayerRestEndsAt] = useState(0);
  const handlePlayerRestActiveChange = useCallback((active: boolean, endsAt?: number) => {
    playerRestingRef.current = active;
    setPlayerResting(active);
    // Rest start i ±15 s posílají endsAt; průběžné „pořád běží" volání ho
    // nemá a nesmí přepsat už známé hodiny.
    if (active) { if (endsAt) setPlayerRestEndsAt(endsAt); }
    else setPlayerRestEndsAt(0);
  }, []);
  // ExercisePlayer registers its rest-skip here (video-view between-set rests
  // are its own showRestTimer, invisible to this component's restShowingRef) —
  // the lock-screen Skip intent would otherwise be consumed and dropped.
  const playerSkipRestRef = useRef<(() => void) | null>(null);
  // ExercisePlayer sem zaregistruje úpravu své pauzy (+15 s z hodinek).
  const playerAdjustRestRef = useRef<((delta: number) => void) | null>(null);
  const [restAdvance, setRestAdvance] = useState(true);
  // Ref mirror + navigation helper assigned later (they need refs declared
  // further down); handlers only run after the first render, so this is safe.
  const restAdvanceRef = useRef(true);
  const goToExerciseRef = useRef<(idx: number) => void>(() => {});
  const [restDuration, setRestDuration] = useState(0);
  // Shared rest clock: both presentations (full-screen video / list bottom bar)
  // read the SAME end timestamp, so switching views mid-rest keeps counting.
  const [restEndsAt, setRestEndsAt] = useState(0);
  const [restRemaining, setRestRemaining] = useState(0);
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
  // ONE reused detached <video> for cache-warming. Creating a fresh element per
  // exercise leaked a WebKit media player each time (never released), eventually
  // exhausting the ~16-element ceiling so mid-workout videos silently stopped
  // loading. We release the previous element before warming the next, and on
  // unmount, following the StationVideoPlayer cleanup pattern.
  const warmupVideoRef = useRef<HTMLVideoElement | null>(null);
  const releaseWarmupVideo = useCallback(() => {
    const v = warmupVideoRef.current;
    if (!v) return;
    try { v.pause(); v.removeAttribute('src'); v.load(); } catch { /* noop */ }
  }, []);
  useEffect(() => () => releaseWarmupVideo(), [releaseWarmupVideo]);
  useEffect(() => {
    let cancelled = false;
    const nextId = liveExercises[currentExerciseIndex + 1]?.exerciseId;
    if (!nextId) { setNextVideoUrl(null); return; }
    supabase.from('exercises').select('video_path').eq('id', nextId).single()
      .then(({ data }) => {
        if (cancelled) return;
        const url = data?.video_path || null;
        setNextVideoUrl(url);
        // Warm the cache NOW (during the current exercise) via a single reused
        // detached video so the rest screen shows it instantly/smoothly.
        if (url) {
          try {
            releaseWarmupVideo(); // free the previous exercise's warm-up first
            const v = warmupVideoRef.current ?? document.createElement('video');
            warmupVideoRef.current = v;
            v.preload = 'auto'; v.muted = true; v.src = url; v.load();
          } catch { /* noop */ }
        }
      });
    return () => { cancelled = true; };
  }, [currentExerciseIndex, liveExercises, releaseWarmupVideo]);

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
  
  // All valid alternatives for the current slot (same role, available at gym,
  // not already in the workout). Feeds both the quick swap and the hold-to-pick
  // sheet.
  const fetchSwapCandidates = useCallback(async (): Promise<SwapCandidate[]> => {
    const exercise = liveExercises[currentExerciseIndex];
    if (!exercise) return [];

    const roleId = exercise.roleId;
    // IDs to exclude: all exercises currently in workout
    const excludeIds = liveExercises
      .map(e => e.exerciseId)
      .filter((id): id is string => !!id);

    return fetchGymBoundAlternatives({
      primaryRole: roleId,
      isCardio: CARDIO_ROLE_IDS.includes(roleId),
      excludeIds,
      gymId,
    });
  }, [currentExerciseIndex, liveExercises, gymId]);

  // Apply a chosen alternative to the current slot (DB + in-memory).
  const applySwap = useCallback(async (pick: SwapCandidate) => {
    const exercise = liveExercises[currentExerciseIndex];
    if (!exercise) return;

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
        exerciseNameEn: pick.name_en || null,
        machineName: newMachineName,
        machineNameEn: newMachineNameEn,
        isFallback: true,
        fallbackReason: 'user_swap',
      };
      return updated;
    });

    toast.success(t('workout.swap_success', { name: pick.name }));
  }, [currentExerciseIndex, liveExercises, planId, dayLetter, t]);

  /**
   * Quick swap: random alternative with the same role.
   */
  const handleSwapExercise = useCallback(async () => {
    if (isSwapping) return;
    setIsSwapping(true);
    try {
      const valid = await fetchSwapCandidates();
      if (valid.length === 0) {
        toast.error(t('workout.no_replacement'));
        return;
      }
      await applySwap(valid[Math.floor(Math.random() * valid.length)]);
    } catch (err) {
      console.error('[Swap] Error:', err);
      toast.error(t('workout.swap_error'));
    } finally {
      setIsSwapping(false);
    }
  }, [fetchSwapCandidates, applySwap, isSwapping, t]);

  // Hold on the swap button: show ALL slot alternatives to pick from.
  const [swapOptions, setSwapOptions] = useState<SwapCandidate[] | null>(null);
  const handleSwapLongPress = useCallback(async () => {
    if (isSwapping) return;
    setIsSwapping(true);
    try {
      const valid = await fetchSwapCandidates();
      if (valid.length === 0) {
        toast.error(t('workout.no_replacement'));
        return;
      }
      setSwapOptions(valid.sort((a, b) => a.name.localeCompare(b.name, 'cs')));
    } finally {
      setIsSwapping(false);
    }
  }, [fetchSwapCandidates, isSwapping, t]);

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
    const updatedMap = new Map(setsDataRef.current);
    updatedMap.set(currentExerciseIndex, setsData);
    setsDataRef.current = updatedMap;
    setSetsDataByExercise(updatedMap);

    if (currentExerciseIndex < liveExercises.length - 1) {
      // Show rest timer before next exercise — use the NEXT exercise's category for rest
      const nextExercise = liveExercises[currentExerciseIndex + 1];
      const nextRest = getRestSecondsForCategory(goalId, nextExercise?.slotCategory);
      setRestAdvance(true);
      restAdvanceRef.current = true;
      setRestDuration(nextRest);
      setRestEndsAt(Date.now() + nextRest * 1000);
      setRestLabel(t('workout.next_exercise_prep'));
      setShowRestTimer(true);
      setHighestIndexReached(prev => Math.max(prev, currentExerciseIndex + 1));
    } else {
      // Workout complete
      triggerPostWorkout();
    }
  }, [currentExercise, currentExerciseIndex, liveExercises.length, goalId, liveExercises]);

  // Between-SET rests (list mode) must not advance the exercise; only the
  // between-EXERCISE rest does.
  const handleRestComplete = useCallback(() => {
    setShowRestTimer(false);
    restShowingRef.current = false;
    // Advance index AND seed the set position in the same batch — doing the
    // seed in an effect let the player mount with the previous exercise's
    // stale set index (clamped to the LAST set of the next exercise).
    if (restAdvanceRef.current) goToExerciseRef.current(currentExerciseIndexRef.current + 1);
    setRestAdvance(true);
    restAdvanceRef.current = true;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      goToExerciseRef.current(currentExerciseIndex + 1);
      setHighestIndexReached(prev => Math.max(prev, currentExerciseIndex + 1));
    } else {
      triggerPostWorkout();
    }
  }, [currentExercise, currentExerciseIndex, liveExercises.length]);

  // Navigate to previous exercise
  const handleGoPrevious = useCallback(() => {
    if (currentExerciseIndex > 0) {
      setShowRestTimer(false);
      restShowingRef.current = false;
      goToExerciseRef.current(currentExerciseIndex - 1);
    }
  }, [currentExerciseIndex]);

  // Navigate to next exercise (only if already visited)
  const handleGoNext = useCallback(() => {
    if (currentExerciseIndex < highestIndexReached) {
      setShowRestTimer(false);
      restShowingRef.current = false;
      goToExerciseRef.current(currentExerciseIndex + 1);
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

        const sessionId = await saveWorkoutSession({
          planId,
          gymId,
          dayLetter,
          goalId,
          startedAt: workoutStartTime,
          results: orderedResults,
          isBonus
        });

        if (!sessionId) {
          // Save failed → it's queued for retry (workoutSaveQueue); tell the user
          toast.info(t('workout.save_queued'), { duration: 6000 });
        }

        setWorkoutSaved(true);
        // Workout is finished (saved or queued) — drop the in-progress snapshot
        clearPausedWorkoutStorage();
      };
      autoSave();
    }
  }, [showSummary, workoutSaved]); // eslint-disable-line react-hooks/exhaustive-deps

  // F2: continuously snapshot the in-progress workout. If the OS kills the app
  // (or the user swipes it away), Home offers resume from the last completed set.
  useEffect(() => {
    if (showSummary || showCooldown || workoutSaved || !planId) return;
    const completedSets: Record<string, SetData[]> = {};
    resultsByIndex.forEach(r => {
      if (r.exerciseId) completedSets[r.exerciseId] = r.sets;
    });
    // Killed during the between-exercise rest: the current exercise is fully
    // done but the index only advances when the rest ends — snapshot the NEXT
    // exercise so resume doesn't land past the last set ("Série 4/3").
    let snapIndex = currentExerciseIndex;
    let snapSetIndex = currentSetIndex;
    let snapSets = currentExerciseSets;
    const totalSets = liveExercises[currentExerciseIndex]?.sets || 0;
    if (totalSets > 0 && currentSetIndex >= totalSets) {
      if (currentExerciseIndex < liveExercises.length - 1) {
        snapIndex = currentExerciseIndex + 1;
        snapSetIndex = 0;
        snapSets = [];
      } else {
        snapSetIndex = totalSets - 1;
      }
    }
    writePausedWorkoutSnapshot({
      planId,
      gymId,
      dayLetter,
      goalId,
      exercises: liveExercises,
      currentExerciseIndex: snapIndex,
      currentSetIndex: snapSetIndex,
      currentExerciseSets: snapSets,
      completedSets,
      startedAt: workoutStartTime.toISOString(),
      pausedAt: new Date().toISOString(),
      isInWarmup: false,
    });
  }, [currentExerciseIndex, currentSetIndex, currentExerciseSets, resultsByIndex, liveExercises,
      showSummary, showCooldown, workoutSaved, planId, gymId, dayLetter, goalId, workoutStartTime]);

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

  // Canonical set progress lives in two mirrors: setsDataByExercise (list view)
  // and currentSetIndex/currentExerciseSets (video player seed). EVERY write
  // path updates both, so the two presentations can never tell a different
  // story (they used to after lock-screen ✓s — list said set 3, video set 2).
  const setsDataRef = useRef(setsDataByExercise);
  setsDataRef.current = setsDataByExercise;
  // Ref mirrors for handlers that may run several times between renders (the
  // lock-screen replay while the webview is throttled) — state closures there
  // can be stale, refs never are.
  const currentExerciseIndexRef = useRef(currentExerciseIndex);
  currentExerciseIndexRef.current = currentExerciseIndex;
  const currentSetIndexRef = useRef(currentSetIndex);
  currentSetIndexRef.current = currentSetIndex;
  const resultsRef = useRef(resultsByIndex);
  resultsRef.current = resultsByIndex;
  const restShowingRef = useRef(false);
  restShowingRef.current = showRestTimer;
  const [playerSync, setPlayerSync] = useState(0);
  // The ONLY way to change the viewed exercise: index + set position are
  // seeded together in one batch, so the player never mounts with a stale
  // set index from the previous exercise. Seeds from logged sets, so going
  // BACK to a finished exercise shows its real green sets.
  goToExerciseRef.current = (idx: number) => {
    setCurrentExerciseIndex(idx);
    currentExerciseIndexRef.current = idx;
    const known = setsDataRef.current.get(idx) || [];
    const pend = known.findIndex(st => !st.completed);
    setCurrentExerciseSets(known);
    setCurrentSetIndex(known.length === 0 ? 0 : (pend === -1 ? Math.max(known.length - 1, 0) : pend));
    setPlayerSync(n => n + 1);
  };

  // Compact mode: complete a single set for any exercise. Completing a set of
  // the exercise the user is ON trains (rest + advance); ticking a set of an
  // earlier exercise is a data fix — no rest, no jumping around.
  const handleCompactCompleteSet = useCallback((exerciseIndex: number, setIndex: number, weight?: number, reps?: number) => {
    const exercise = liveExercises[exerciseIndex];
    if (!exercise) return;
    const isViewed = exerciseIndex === currentExerciseIndexRef.current;

    const existing = setsDataRef.current.get(exerciseIndex) ||
      Array.from({ length: exercise.sets }, () => ({ completed: false }));
    const newSets = [...existing];
    newSets[setIndex] = { completed: true, weight, reps };
    const updated = new Map(setsDataRef.current);
    updated.set(exerciseIndex, newSets);
    setsDataRef.current = updated;
    setSetsDataByExercise(updated);

    // Mirror into the video-player seed (lock-screen ✓ and list ✓ alike).
    if (isViewed) {
      setCurrentExerciseSets(newSets);
      setCurrentSetIndex(Math.min(setIndex + 1, exercise.sets - 1));
      setPlayerSync(n => n + 1);
    }

    const allDone = newSets.every(s => s.completed);
    if (!allDone) {
      if (isViewed) {
        // Rest between sets (Pumplo-guided, same as the video flow)
        const sec = getRestSecondsForCategory(goalId, exercise.slotCategory);
        setRestAdvance(false);
        restAdvanceRef.current = false;
        setRestDuration(sec);
        setRestEndsAt(Date.now() + sec * 1000);
        setRestLabel(t('log_workout.rest'));
        setShowRestTimer(true);
        restShowingRef.current = true;
      }
      return;
    }

    // Save result
    const result: ExerciseResult = {
      exerciseId: exercise.exerciseId || '',
      exerciseName: exercise.exerciseName || '',
      sets: newSets
    };
    setResultsByIndex(prev2 => new Map(prev2).set(exerciseIndex, result));

    if (!isViewed) return; // fixing an old exercise never navigates

    // Auto-advance to next incomplete exercise
    const nextIdx = liveExercises.findIndex((_, i) => {
      if (i <= exerciseIndex) return false;
      const sets = updated.get(i);
      if (!sets) return true;
      return sets.some(s => !s.completed);
    });
    if (nextIdx !== -1) {
      goToExerciseRef.current(nextIdx);
      setHighestIndexReached(prev2 => Math.max(prev2, nextIdx));
      setRestAdvance(false); // index already moved
      restAdvanceRef.current = false;
      const nextSec = getRestSecondsForCategory(goalId, liveExercises[nextIdx]?.slotCategory);
      setRestDuration(nextSec);
      setRestEndsAt(Date.now() + nextSec * 1000);
      setRestLabel(t('workout.next_exercise_prep'));
      setShowRestTimer(true);
      restShowingRef.current = true;
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
  }, [liveExercises, goalId, t]);

  // Un-check a completed set (list view): it becomes pending again with its
  // values kept for editing; the exercise's saved result is dropped until the
  // set is re-completed.
  const handleUncheckSet = useCallback((exerciseIndex: number, setIndex: number) => {
    const existing = setsDataRef.current.get(exerciseIndex);
    if (!existing?.[setIndex]?.completed) return;
    const newSets = [...existing];
    newSets[setIndex] = { ...newSets[setIndex], completed: false };
    const updated = new Map(setsDataRef.current);
    updated.set(exerciseIndex, newSets);
    setsDataRef.current = updated;
    setSetsDataByExercise(updated);
    if (exerciseIndex === currentExerciseIndexRef.current) {
      setCurrentExerciseSets(newSets);
      const pend = newSets.findIndex(s => !s.completed);
      setCurrentSetIndex(pend === -1 ? Math.max(newSets.length - 1, 0) : pend);
      setPlayerSync(n => n + 1);
    }
    setResultsByIndex(prev => {
      if (!prev.has(exerciseIndex)) return prev;
      const m = new Map(prev);
      m.delete(exerciseIndex);
      return m;
    });
  }, []);

  // First incomplete set, preferring the exercise the user is viewing; falls
  // back to the workout's next pending set (the user may have navigated back
  // to a finished exercise — the lock-screen ✓ must still log something).
  const findPendingSet = (preferIdx: number): { exIdx: number; si: number } | null => {
    // Reads refs, not state: the lock-screen replay can call this repeatedly
    // between renders and must always see the latest writes.
    const pendingAt = (i: number) => {
      const s = setsDataRef.current.get(i) || [];
      return s.length === 0 ? 0 : s.findIndex(st => !st.completed);
    };
    if (liveExercises[preferIdx]) {
      const p = pendingAt(preferIdx);
      if (p !== -1) return { exIdx: preferIdx, si: p };
    }
    for (let i = 0; i < liveExercises.length; i++) {
      // Skipped/finished exercises already carry a result — don't resurrect them.
      if (resultsRef.current.has(i)) continue;
      const p = pendingAt(i);
      if (p !== -1) return { exIdx: i, si: p };
    }
    return null;
  };

  // Edit weight/reps of an ALREADY completed set (list view, Hevy parity).
  // No rest, no advance — just data + the saved result kept in sync.
  const handleEditCompletedSet = useCallback((exerciseIndex: number, setIndex: number, weight?: number, reps?: number) => {
    const existing = setsDataRef.current.get(exerciseIndex);
    if (!existing?.[setIndex]?.completed) return;
    const newSets = [...existing];
    newSets[setIndex] = { ...newSets[setIndex], weight, reps };
    const updated = new Map(setsDataRef.current);
    updated.set(exerciseIndex, newSets);
    setsDataRef.current = updated;
    setSetsDataByExercise(updated);
    if (exerciseIndex === currentExerciseIndex) setCurrentExerciseSets(newSets);
    setResultsByIndex(prev => {
      const r = prev.get(exerciseIndex);
      if (!r) return prev;
      return new Map(prev).set(exerciseIndex, { ...r, sets: newSets });
    });
  }, [currentExerciseIndex]);

  // --- Lock-screen banner for the guided workout (info-only ✓ hidden; rest
  // countdowns come from RestTimer which drives the banner itself) ---
  const [currentThumbUrl, setCurrentThumbUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const id = currentExercise?.exerciseId;
    if (!id) { setCurrentThumbUrl(null); return; }
    supabase.from('exercises').select('video_path').eq('id', id).single().then(({ data }) => {
      if (!cancelled) setCurrentThumbUrl(getVideoThumbUrl(data?.video_path || null));
    });
    return () => { cancelled = true; };
  }, [currentExercise?.exerciseId]);

  // Náhledy VŠECH cviků tréninku — potřebuje je seznam na hodinkách. Jeden
  // dotaz na celý trénink, ne dotaz na cvik.
  const [thumbUrlById, setThumbUrlById] = useState<Map<string, string | null>>(new Map());
  useEffect(() => {
    const ids = Array.from(new Set(liveExercises.map(ex => ex.exerciseId).filter((id): id is string => !!id)));
    if (ids.length === 0) return;
    let cancelled = false;
    supabase.from('exercises').select('id, video_path').in('id', ids).then(({ data }) => {
      if (cancelled || !data) return;
      setThumbUrlById(new Map(data.map(r => [r.id, getVideoThumbUrl(r.video_path || null)])));
    });
    return () => { cancelled = true; };
    // Stačí podle složení cviků — výměna cviku seznam přenačte.
  }, [liveExercises.map(ex => ex.exerciseId).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // Suggested weight for the upcoming set: last completed set this session,
  // else the most recent logged weight for the exercise (same prefill order as
  // the list view).
  const [currentExWeight, setCurrentExWeight] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    const ex = liveExercises[currentExerciseIndex];
    const inSession = [...(setsDataByExercise.get(currentExerciseIndex) || [])].reverse().find(st => st.completed && st.weight != null);
    if (inSession?.weight != null) { setCurrentExWeight(inSession.weight); return; }
    if (!ex?.exerciseId) { setCurrentExWeight(null); return; }
    supabase
      .from('workout_session_sets')
      .select('weight_kg')
      .eq('exercise_id', ex.exerciseId)
      .not('weight_kg', 'is', null)
      .gt('weight_kg', 0)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled) setCurrentExWeight((data as any)?.weight_kg ?? null); });
    return () => { cancelled = true; };
  }, [currentExerciseIndex, liveExercises, setsDataByExercise]);

  // Re-assert the lock-screen card whenever the app returns to the foreground:
  // if iOS dropped or staled the Live Activity while the phone was locked,
  // this repaints it (starting an activity needs the foreground anyway).
  const [resumeTick, setResumeTick] = useState(0);
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') setResumeTick(n => n + 1); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    if (showSummary || showCooldown) { endRestActivity(); return; }
    if (showRestTimer || playerResting || playerRestingRef.current) return; // a rest owns the banner (WorkoutSession or ExercisePlayer)
    // The card always shows the next set TO LOG — when the user navigates back
    // to a finished exercise, the workout's next pending set is shown instead,
    // so the ✓ on the lock screen keeps working.
    const target = findPendingSet(currentExerciseIndex);
    if (!target) { endRestActivity(); return; }
    const ex = liveExercises[target.exIdx];
    const sameExercise = target.exIdx === currentExerciseIndex;
    const repsText = `${ex.repMin}–${ex.repMax} ${t('workout_share.reps_abbr')}`;
    showSetActivity({
      exerciseName: (isEn && ex.exerciseNameEn) ? ex.exerciseNameEn! : (ex.exerciseName || ''),
      setText: t('log_workout.set_of', { num: Math.min(target.si + 1, ex.sets), total: ex.sets }),
      detailText: sameExercise && currentExWeight != null ? `${currentExWeight} kg × ${repsText}` : repsText,
      restSeconds: getRestSecondsForCategory(goalId, ex.slotCategory),
      showButton: true,
      thumbUrl: sameExercise ? currentThumbUrl : null,
      restOverTitle: t('workout.rest_over_title'),
      restOverBody: t('workout.rest_over_body'),
    });
  }, [currentExerciseIndex, currentSetIndex, setsDataByExercise, resultsByIndex, showRestTimer, playerResting, showSummary, showCooldown, liveExercises, currentThumbUrl, viewMode, isEn, t, currentExWeight, goalId, resumeTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Zaloguj další ČEKAJÍCÍ sérii. Jediná cesta pro lock-screen ✓ i pro ✓ na
  // hodinkách — obě musí stejně navigovat na cvik, kterému série patří, a
  // stejně doplnit váhu, jinak se list a video mirror rozejdou.
  const completePendingSetRef = useRef<(weight?: number, reps?: number) => void>(() => {});
  completePendingSetRef.current = (weight?: number, reps?: number) => {
    if (restShowingRef.current || playerRestingRef.current || showSummary || showCooldown) return;
    const target = findPendingSet(currentExerciseIndexRef.current);
    if (!target) return;
    const ex = liveExercises[target.exIdx];
    if (!ex) return;
    const sameExercise = target.exIdx === currentExerciseIndexRef.current;
    if (!sameExercise) {
      // ✓ na sérii jiného cviku = uživatel se posunul dál; následuj ho.
      goToExerciseRef.current(target.exIdx);
      setHighestIndexReached(p => Math.max(p, target.exIdx));
    }
    // handleCompactCompleteSet přeseje i mirror video playeru.
    handleCompactCompleteSet(
      target.exIdx,
      target.si,
      resolveLoggedWeight({ actionWeight: weight ?? null, sameExercise, currentExWeight }),
      reps ?? ex.repMax,
    );
  };
  const lockCompleteRef = useRef<() => void>(() => {});
  lockCompleteRef.current = () => completePendingSetRef.current();
  const lockSkipRef = useRef<() => void>(() => {});
  lockSkipRef.current = () => {
    // Video-view between-set rest lives inside ExercisePlayer — close it
    // there (its RestTimer cleanup stops beeps/notification itself).
    if (playerRestingRef.current) {
      playerSkipRestRef.current?.();
      playerRestingRef.current = false;
      return;
    }
    if (!restShowingRef.current) return;
    stopRestBeeps();
    cancelRestEndNotification();
    handleRestComplete();
    // Sync the ref immediately — the replay loop may fire the next event
    // before React re-renders (throttled webview behind the lock screen).
    restShowingRef.current = false;
  };
  const lockProcessingRef = useRef(false);
  useEffect(() => {
    const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
    const process = async () => {
      if (lockProcessingRef.current) return;
      lockProcessingRef.current = true;
      try {
        // Replay the lock-screen taps in the order they happened; settle
        // between events so each handler ref sees the previous one's state.
        let events = await consumePendingEvents();
        while (events.length > 0) {
          for (const ev of events) {
            if (ev === 'skip') {
              lockSkipRef.current();
            } else {
              // ✓ while a rest still runs in JS: the user already dealt with
              // the rest on the widget — close it first, never drop the set.
              if (restShowingRef.current || playerRestingRef.current) { lockSkipRef.current(); await wait(350); }
              lockCompleteRef.current();
            }
            await wait(350);
          }
          events = await consumePendingEvents(); // taps queued while replaying
        }
      } finally { lockProcessingRef.current = false; }
    };
    process();
    const rm1 = addLockScreenListener('setCompleted', () => process());
    const rm2 = addLockScreenListener('restSkipped', () => process());
    const onVis = () => { if (document.visibilityState === 'visible') process(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { rm1(); rm2(); document.removeEventListener('visibilitychange', onVis); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const adjustListRest = (delta: number) => {
    setRestEndsAt(prev => Math.max(Date.now(), prev + delta * 1000));
  };

  // ‹ / › z hodinek: posun po sériích v rámci cviku, na kraji na sousední cvik.
  const stepSetRef = useRef<(direction: 'prev' | 'next') => void>(() => {});
  stepSetRef.current = (direction) => {
    const exIdx = currentExerciseIndexRef.current;
    const ex = liveExercises[exIdx];
    if (!ex) return;
    const step = resolveSetStep({
      exerciseIndex: exIdx,
      setIndex: currentSetIndexRef.current,
      totalSets: ex.sets,
      exerciseCount: liveExercises.length,
    }, direction);
    if (!step) return;
    if (step.exerciseIndex !== exIdx) {
      // goToExerciseRef si index série naseeduje sám z odlogovaných sérií.
      goToExerciseRef.current(step.exerciseIndex);
      setHighestIndexReached(p => Math.max(p, step.exerciseIndex));
      return;
    }
    setCurrentSetIndex(step.setIndex);
    currentSetIndexRef.current = step.setIndex;
    setPlayerSync(n => n + 1);
  };

  // Watch (companion app) actions replayed into the same handlers the
  // in-app UI uses — logSet / skipRest / goPrevSet / goNextSet / addRest15.
  // useWatchBridge drží ref-indirekci, takže tahle funkce může být obyčejná —
  // listener vždycky volá tu z aktuálního renderu, ne zastaralou z mountu.
  const handleWatchAction = (a: WatchAction) => {
    if (a.type === 'logSet') {
      completePendingSetRef.current(a.weight ?? undefined, a.reps);
    } else if (a.type === 'skipRest') {
      if (playerRestingRef.current) { playerSkipRestRef.current?.(); playerRestingRef.current = false; return; }
      if (restShowingRef.current) { stopRestBeeps(); cancelRestEndNotification(); handleRestComplete(); restShowingRef.current = false; }
    } else if (a.type === 'addRest15') {
      if (playerRestingRef.current) { playerAdjustRestRef.current?.(15); return; }
      if (restShowingRef.current) adjustListRest(15);
    } else if (a.type === 'goPrevSet') {
      stepSetRef.current('prev');
    } else if (a.type === 'goNextSet') {
      stepSetRef.current('next');
    } else if (a.type === 'goToExercise') {
      if (a.index >= 0 && a.index < liveExercises.length) goToExerciseRef.current(a.index);
    }
  };

  // Leaving the workout removes the banner. (Hodinky uklízí useWatchBridge.)
  useEffect(() => () => { endRestActivity(); }, []);

  // Exercise detail opened from the swap sheet ⓘ (closes back to the sheet).
  const [swapInfoId, setSwapInfoId] = useState<string | null>(null);

  // Card the lock-screen Skip intent flips to after this rest: the first
  // pending set of the exercise the rest leads to. Passed as nextSet with
  // every rest start so the native flip never shows a blank card.
  const upcomingSetPayload = (): NextSetPayload | null => {
    const target = findPendingSet(restAdvance ? currentExerciseIndex + 1 : currentExerciseIndex);
    if (!target) return null;
    const ex = liveExercises[target.exIdx];
    const repsText = `${ex.repMin}–${ex.repMax} ${t('workout_share.reps_abbr')}`;
    const sameExercise = target.exIdx === currentExerciseIndex;
    return {
      exerciseName: (isEn && ex.exerciseNameEn) ? ex.exerciseNameEn! : (ex.exerciseName || ''),
      setText: t('log_workout.set_of', { num: Math.min(target.si + 1, ex.sets), total: ex.sets }),
      detailText: sameExercise && currentExWeight != null ? `${currentExWeight} kg × ${repsText}` : repsText,
      restSeconds: getRestSecondsForCategory(goalId, ex.slotCategory),
      thumbUrl: sameExercise ? currentThumbUrl : (target.exIdx === currentExerciseIndex + 1 ? getVideoThumbUrl(nextVideoUrl) : null),
    };
  };

  // Snapshot aktuálního tréninku pro spárované hodinky. Hodiny pauzy jsou
  // JEDNY (viz resolveWatchRestEndsAt) — hodinky si z restEndsAt odpočítávají
  // lokálně, takže přepočet při každém renderu by countdown resetoval.
  // Seznam cviků pro hodinky. Hotové série se počítají ze stejné mapy, ze které
  // je bere seznam v appce, takže se čísla nemůžou rozejít.
  const watchExercises = liveExercises.map((ex, idx) => ({
    name: (isEn && ex.exerciseNameEn) ? ex.exerciseNameEn! : (ex.exerciseName || ''),
    setsDone: (setsDataByExercise.get(idx) ?? []).filter(s => s.completed).length,
    setsTotal: ex.sets,
    thumbUrl: ex.exerciseId ? (thumbUrlById.get(ex.exerciseId) ?? null) : null,
  }));
  const watchHeader = {
    workoutTitle: t('admin.day_letter', { letter: dayLetter }),
    workoutStartedAt: workoutStartTime.getTime(),
    exercises: watchExercises,
  };

  const watchState: BuildInput | null = (() => {
    const ex = liveExercises[currentExerciseIndex];
    if (!ex) return null;
    const blank = {
      exerciseName: '', slotCategory: null, setIndex: 0, totalSets: 0,
      targetWeight: null, repMin: 0, repMax: 0, rir: null,
      prevWeight: null, prevReps: null, resting: false, restEndsAt: null,
      nextSetLabel: null,
    };
    if (showSummary) return { phase: 'summary', ...blank, ...watchHeader };
    if (showCooldown) return { phase: 'idle', ...blank, ...watchHeader };

    const restEnds = resolveWatchRestEndsAt({
      sessionResting: showRestTimer,
      sessionRestEndsAt: restEndsAt,
      playerResting,
      playerRestEndsAt,
    });
    // Bez známého konce pauzy nemá smysl posílat fázi rest — hodinky by
    // ukazovaly odpočet bez času. Radši zůstane obrazovka série.
    const resting = restEnds !== null;
    return {
      phase: resting ? 'rest' : 'set',
      exerciseName: (isEn && ex.exerciseNameEn) ? ex.exerciseNameEn! : (ex.exerciseName || ''),
      slotCategory: ex.slotCategory ?? null,
      setIndex: currentSetIndex, totalSets: ex.sets,
      targetWeight: currentExWeight, repMin: ex.repMin, repMax: ex.repMax,
      rir: ex.rirMax ?? ex.rirMin ?? null,
      prevWeight: currentExWeight, prevReps: ex.repMax,
      resting, restEndsAt: restEnds,
      nextSetLabel: resting ? (upcomingSetPayload()?.setText ?? null) : null,
      ...watchHeader,
    };
  })();

  useWatchBridge(watchState, handleWatchAction);

  // List-mode rest engine: beeps, rest-end notification and lock-screen
  // countdown for the bottom rest bar. The full-screen RestTimer (video view)
  // arms all of this itself; cleanups hand over cleanly on view toggles.
  const restBarBeeps = useRef({ b3: false, b2: false, b1: false, done: false });
  const restBarNativeRef = useRef(false);
  const restCompleteRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (!showRestTimer || viewMode !== 'list' || !restEndsAt) return;
    let cancelled = false;
    const remainingAtStart = Math.max(0, Math.ceil((restEndsAt - Date.now()) / 1000));
    restBarBeeps.current = { b3: remainingAtStart < 3, b2: remainingAtStart < 2, b1: remainingAtStart < 1, done: false };
    startRestBeeps(remainingAtStart).then(h => { if (!cancelled) restBarNativeRef.current = h; });
    scheduleRestEndNotification(remainingAtStart, t('workout.rest_over_title'), t('workout.rest_over_body'));
    startRestActivity({
      exerciseName: (isEn && currentExercise?.exerciseNameEn) ? currentExercise!.exerciseNameEn! : (currentExercise?.exerciseName || ''),
      nextSetText: restLabel,
      endsAt: restEndsAt,
      totalSeconds: restDuration,
      nextSet: upcomingSetPayload(),
    });
    const tick = () => {
      const rem = Math.max(0, Math.ceil((restEndsAt - Date.now()) / 1000));
      setRestRemaining(rem);
      const b = restBarBeeps.current;
      if (!restBarNativeRef.current) {
        if (rem === 3 && !b.b3) { b.b3 = true; playCountdown3(); }
        if (rem === 2 && !b.b2) { b.b2 = true; playCountdown2(); }
        if (rem === 1 && !b.b1) { b.b1 = true; playCountdown1(); }
      }
      if (rem <= 0 && !b.done) {
        b.done = true;
        if (!restBarNativeRef.current) playAlarmFinish();
        stopRestBeeps();
        cancelRestEndNotification();
        restCompleteRef.current();
      }
    };
    tick();
    const iv = setInterval(tick, 250);
    const onVis = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true; clearInterval(iv); document.removeEventListener('visibilitychange', onVis);
      stopRestBeeps(); cancelRestEndNotification(); restBarNativeRef.current = false;
    };
  }, [showRestTimer, viewMode, restEndsAt, resumeTick]); // eslint-disable-line react-hooks/exhaustive-deps

  restCompleteRef.current = handleRestComplete;

  const handleCompactSelectExercise = useCallback((index: number) => {
    goToExerciseRef.current(index);
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

  // Rest timer overlay — full screen ONLY in video view. In list view the rest
  // renders as a bottom bar over the list (custom-workout parity); both read
  // the same restEndsAt clock, so toggling views never resets the countdown.
  if (showRestTimer && viewMode === 'video') {
    return (
      <RestTimer
        duration={restDuration}
        endsAt={restEndsAt}
        onAdjust={adjustListRest}
        onComplete={handleRestComplete}
        label={restLabel}
        nextExerciseName={restAdvance
          ? ((isEn && liveExercises[currentExerciseIndex + 1]?.exerciseNameEn) ? liveExercises[currentExerciseIndex + 1]!.exerciseNameEn! : (liveExercises[currentExerciseIndex + 1]?.exerciseName || undefined))
          : ((isEn && currentExercise?.exerciseNameEn) ? currentExercise!.exerciseNameEn! : (currentExercise?.exerciseName || undefined))}
        nextVideoUrl={restAdvance ? nextVideoUrl : null}
        onToggleView={() => setViewMode('list')}
        nextSet={upcomingSetPayload()}
      />
    );
  }

  // Main exercise player
  if (!currentExercise) return null;

  // Shared swap picker + exercise detail sheets (also used by the custom-plan
  // builder and custom playback).
  const swapSheetJsx = (
    <ExerciseSwapSheet
      options={swapOptions}
      onPick={applySwap}
      onClose={() => setSwapOptions(null)}
      onShowInfo={setSwapInfoId}
    />
  );

  const infoSheetJsx = (
    <ExerciseInfoSheet exerciseId={swapInfoId} onClose={() => setSwapInfoId(null)} />
  );

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
          onSwapLongPress={handleSwapLongPress}
          isSwapping={isSwapping}
          totalExercises={liveExercises.length}
          startTime={workoutStartTime}
          restSecondsByIndex={liveExercises.map(e => getRestSecondsForCategory(goalId, e.slotCategory))}
          onShowInfo={setSwapInfoId}
          onEditSet={handleEditCompletedSet}
          onUncheckSet={handleUncheckSet}
        />

        {/* Sticky rest bar (shared clock with the full-screen rest) */}
        <AnimatePresence>
          {showRestTimer && (
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              className="fixed left-0 right-0 z-[70] px-3"
              style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
            >
              <div className="mx-auto max-w-md bg-action text-white rounded-2xl shadow-xl px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <button onClick={() => adjustListRest(-15)} className="px-2.5 py-1.5 rounded-lg bg-white/10 text-xs font-semibold active:scale-95 transition-transform">-15 s</button>
                  <div className="flex-1 text-center">
                    <p className="text-[11px] font-semibold text-[#5BC8F5] truncate">{restLabel}</p>
                    <span className={restRemaining <= 3 ? 'text-2xl font-black tabular-nums text-red-400' : 'text-2xl font-black tabular-nums text-white'}>
                      {Math.floor(restRemaining / 60)}:{String(restRemaining % 60).padStart(2, '0')}
                    </span>
                    <div className="h-1 mt-1 bg-white/15 rounded-full overflow-hidden">
                      <div className="h-full bg-[#5BC8F5] rounded-full" style={{ width: `${restDuration > 0 ? (restRemaining / restDuration) * 100 : 0}%` }} />
                    </div>
                  </div>
                  <button onClick={() => adjustListRest(15)} className="px-2.5 py-1.5 rounded-lg bg-white/10 text-xs font-semibold active:scale-95 transition-transform">+15 s</button>
                  <button onClick={() => { stopRestBeeps(); cancelRestEndNotification(); handleRestComplete(); }} className="px-3 py-1.5 rounded-lg bg-[#5BC8F5] text-xs font-bold active:scale-95 transition-transform">{t('log_workout.rest_skip')}</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {swapSheetJsx}
        {infoSheetJsx}

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
        key={`${currentExerciseIndex}-${playerSync}`}
        exercise={currentExercise}
        exerciseIndex={currentExerciseIndex}
        totalExercises={liveExercises.length}
        onCompleteExercise={handleCompleteExercise}
        onSkipExercise={handleSkipClick}
        onSwapExercise={handleSwapExercise}
        onSwapLongPress={handleSwapLongPress}
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
        initialSetIndex={Math.min(currentSetIndex, Math.max((currentExercise?.sets ?? 1) - 1, 0))}
        initialSetsData={currentExerciseSets.length > 0 ? currentExerciseSets : undefined}
        onSetChange={(setIdx, sets) => {
          setCurrentSetIndex(setIdx);
          setCurrentExerciseSets(sets);
          // Mirror player progress into the list-view map so switching to the
          // list mid-exercise shows the sets already done in the video view.
          const updated = new Map(setsDataRef.current);
          updated.set(currentExerciseIndex, sets);
          setsDataRef.current = updated;
          setSetsDataByExercise(updated);
        }}
        nextExerciseName={(isEn && liveExercises[currentExerciseIndex + 1]?.exerciseNameEn) ? liveExercises[currentExerciseIndex + 1]!.exerciseNameEn! : (liveExercises[currentExerciseIndex + 1]?.exerciseName || undefined)}
        nextVideoUrl={nextVideoUrl}
        onRestActiveChange={handlePlayerRestActiveChange}
        skipRestRef={playerSkipRestRef}
        adjustRestRef={playerAdjustRestRef}
      />

      {swapSheetJsx}
      {infoSheetJsx}

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
  onSwapLongPress,
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
  onRestActiveChange,
  skipRestRef,
  adjustRestRef,
}: {
  exercise: WorkoutExercise;
  exerciseIndex: number;
  totalExercises: number;
  onCompleteExercise: (setsData: SetData[]) => void;
  onSkipExercise: () => void;
  onSwapExercise?: () => void;
  onSwapLongPress?: () => void;
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
  onRestActiveChange?: (active: boolean, endsAt?: number) => void;
  skipRestRef?: React.MutableRefObject<(() => void) | null>;
  adjustRestRef?: React.MutableRefObject<((delta: number) => void) | null>;
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
      onSwapLongPress={onSwapLongPress}
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
      onRestActiveChange={onRestActiveChange}
      skipRestRef={skipRestRef}
      adjustRestRef={adjustRestRef}
    />
  );
};
