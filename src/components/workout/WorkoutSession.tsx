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
import { getSignedVideoUrl, getVideoThumbUrl, enterVideoFullscreen } from '@/lib/videoUtils';
import { showSetActivity, endRestActivity, startRestActivity, consumePendingEvents, addLockScreenListener } from '@/lib/restLiveActivity';
import { startRestBeeps, stopRestBeeps } from '@/lib/restAudioNative';
import { scheduleRestEndNotification, cancelRestEndNotification } from '@/lib/restNotification';
import { playCountdown3, playCountdown2, playCountdown1, playAlarmFinish } from '@/lib/workoutAudio';
import { ExerciseInfoContent } from './ExerciseInfoContent';
import { Info, Maximize2 } from 'lucide-react';
import { useWorkoutHistory } from '@/hooks/useWorkoutHistory';
import { writePausedWorkoutSnapshot, clearPausedWorkoutStorage } from '@/hooks/usePausedWorkout';
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

// A slot alternative offered by the swap button / hold-to-pick sheet.
interface SwapCandidate {
  id: string;
  name: string;
  name_en: string | null;
  machine_id: string | null;
  video_path: string | null;
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
  const [restAdvance, setRestAdvance] = useState(true);
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
  
  // All valid alternatives for the current slot (same role, available at gym,
  // not already in the workout). Feeds both the quick swap and the hold-to-pick
  // sheet.
  const fetchSwapCandidates = useCallback(async (): Promise<SwapCandidate[]> => {
    const exercise = liveExercises[currentExerciseIndex];
    if (!exercise) return [];

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
      .select('id, name, name_en, primary_role, machine_id, equipment_type, primary_muscles, secondary_muscles, category, video_path')
      .eq('allowed_phase', 'main');

    if (isCardio) {
      query = query.eq('category', 'cardio');
    } else {
      query = query.eq('primary_role', roleId);
    }

    const { data: candidates, error } = await query;
    if (error || !candidates) return [];

    // Filter: exclude current exercises, must be available at gym (machine check)
    const valid = candidates.filter(c => {
      if (excludeIds.includes(c.id)) return false;
      if (c.machine_id && !machineIds.has(c.machine_id)) return false;
      return true;
    });
    console.log(`[Swap] Role: ${roleId}, DB candidates: ${candidates?.length}, after gym/exclude filter: ${valid.length}`);
    return valid as SwapCandidate[];
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
    setSetsDataByExercise(prev => new Map(prev).set(currentExerciseIndex, setsData));

    if (currentExerciseIndex < liveExercises.length - 1) {
      // Show rest timer before next exercise — use the NEXT exercise's category for rest
      const nextExercise = liveExercises[currentExerciseIndex + 1];
      const nextRest = getRestSecondsForCategory(goalId, nextExercise?.slotCategory);
      setRestAdvance(true);
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
    setRestAdvance(prev => {
      if (prev) setCurrentExerciseIndex(i => i + 1);
      return true;
    });
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
      if (!allDone) {
        // Rest between sets (Pumplo-guided, same as the video flow)
        const sec = getRestSecondsForCategory(goalId, exercise.slotCategory);
        setRestAdvance(false);
        setRestDuration(sec);
        setRestEndsAt(Date.now() + sec * 1000);
        setRestLabel(t('log_workout.rest'));
        setShowRestTimer(true);
      }
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
          setRestAdvance(false); // index already moved
          const nextSec = getRestSecondsForCategory(goalId, liveExercises[nextIdx]?.slotCategory);
          setRestDuration(nextSec);
          setRestEndsAt(Date.now() + nextSec * 1000);
          setRestLabel(t('workout.next_exercise_prep'));
          setShowRestTimer(true);
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
  }, [liveExercises, goalId, t]);

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

  useEffect(() => {
    if (showSummary || showCooldown) { endRestActivity(); return; }
    if (showRestTimer) return; // RestTimer owns the banner while resting
    const ex = liveExercises[currentExerciseIndex];
    if (!ex) return;
    const sets = setsDataByExercise.get(currentExerciseIndex) || [];
    const mapIdx = sets.findIndex(st => !st.completed);
    const setIdx = viewMode === 'list' ? (mapIdx === -1 ? Math.max(ex.sets - 1, 0) : mapIdx) : currentSetIndex;
    const repsText = `${ex.repMin}–${ex.repMax} ${t('workout_share.reps_abbr')}`;
    showSetActivity({
      exerciseName: (isEn && ex.exerciseNameEn) ? ex.exerciseNameEn! : (ex.exerciseName || ''),
      setText: t('log_workout.set_of', { num: Math.min(setIdx + 1, ex.sets), total: ex.sets }),
      detailText: currentExWeight != null ? `${currentExWeight} kg × ${repsText}` : repsText,
      restSeconds: getRestSecondsForCategory(goalId, ex.slotCategory),
      showButton: true,
      thumbUrl: currentThumbUrl,
      restOverTitle: t('workout.rest_over_title'),
      restOverBody: t('workout.rest_over_body'),
    });
  }, [currentExerciseIndex, currentSetIndex, setsDataByExercise, showRestTimer, showSummary, showCooldown, liveExercises, currentThumbUrl, viewMode, isEn, t, currentExWeight, goalId]);

  // ✓ / Skip from the lock screen (same behaviour as the custom workout).
  const [playerSync, setPlayerSync] = useState(0);
  useEffect(() => { setPlayerSync(0); }, [currentExerciseIndex]);
  const lockCompleteRef = useRef<() => void>(() => {});
  lockCompleteRef.current = () => {
    if (showRestTimer || showSummary || showCooldown) return;
    const ex = liveExercises[currentExerciseIndex];
    if (!ex) return;
    const base = viewMode === 'video' && currentExerciseSets.length === ex.sets
      ? currentExerciseSets
      : (setsDataByExercise.get(currentExerciseIndex) || Array.from({ length: ex.sets }, () => ({ completed: false })));
    const si = base.findIndex(st => !st.completed);
    if (si === -1) return;
    const reps = ex.repMax;
    handleCompactCompleteSet(currentExerciseIndex, si, currentExWeight ?? undefined, reps);
    if (viewMode === 'video') {
      // Re-seed the video player so it lands on the next set when unlocked.
      const updated = [...base];
      updated[si] = { completed: true, weight: currentExWeight ?? undefined, reps };
      setCurrentExerciseSets(updated);
      setCurrentSetIndex(Math.min(si + 1, ex.sets - 1));
      setPlayerSync(n => n + 1);
    }
  };
  const lockSkipRef = useRef<() => void>(() => {});
  lockSkipRef.current = () => {
    if (!showRestTimer) return;
    stopRestBeeps();
    cancelRestEndNotification();
    handleRestComplete();
  };
  useEffect(() => {
    const process = async () => {
      const { completions, skips } = await consumePendingEvents();
      if (skips > 0) lockSkipRef.current();
      // Every queued ✓ logs one set; spaced so state settles between writes.
      for (let i = 0; i < completions; i++) {
        if (i > 0) await new Promise(r => setTimeout(r, 400));
        lockCompleteRef.current();
      }
    };
    process();
    const rm1 = addLockScreenListener('setCompleted', () => process());
    const rm2 = addLockScreenListener('restSkipped', () => process());
    const onVis = () => { if (document.visibilityState === 'visible') process(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { rm1(); rm2(); document.removeEventListener('visibilitychange', onVis); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Leaving the workout removes the banner.
  useEffect(() => () => { endRestActivity(); }, []);

  // Exercise detail opened from the swap sheet (closes back to the list).
  interface SwapInfo {
    name: string; nameEn: string | null; videoUrl: string | null; category: string;
    equipmentType: string | null; machineName: string | null;
    primaryMuscles: string[]; secondaryMuscles: string[];
    primaryMusclesEn: string[] | null; secondaryMusclesEn: string[] | null;
    description: string | null; setupInstructions: string | null;
    commonMistakes: string | null; tips: string | null;
  }
  const [swapInfo, setSwapInfo] = useState<SwapInfo | null>(null);
  const openExerciseInfo = async (exerciseId: string) => {
    const { data } = await supabase
      .from('exercises')
      .select('name, name_en, category, equipment_type, primary_muscles, secondary_muscles, primary_muscles_en, secondary_muscles_en, video_path, description, setup_instructions, common_mistakes, tips, machines!exercises_machine_id_fkey(name)')
      .eq('id', exerciseId)
      .single();
    if (!data) return;
    const d = data as any;
    setSwapInfo({
      name: d.name, nameEn: d.name_en || null, videoUrl: d.video_path || null,
      category: d.category || '', equipmentType: d.equipment_type || null,
      machineName: d.machines?.name || null,
      primaryMuscles: d.primary_muscles || [], secondaryMuscles: d.secondary_muscles || [],
      primaryMusclesEn: d.primary_muscles_en || null, secondaryMusclesEn: d.secondary_muscles_en || null,
      description: d.description || null, setupInstructions: d.setup_instructions || null,
      commonMistakes: d.common_mistakes || null, tips: d.tips || null,
    });
  };

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
  }, [showRestTimer, viewMode, restEndsAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const adjustListRest = (delta: number) => {
    setRestEndsAt(prev => Math.max(Date.now(), prev + delta * 1000));
  };
  restCompleteRef.current = handleRestComplete;

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
      />
    );
  }

  // Main exercise player
  if (!currentExercise) return null;

  // Hold-to-pick sheet with every valid slot alternative (shared by both views).
  const swapSheetJsx = (
    <AnimatePresence>
      {swapOptions && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm"
            onClick={() => setSwapOptions(null)}
          />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed left-0 right-0 bottom-0 z-[81] bg-card rounded-t-3xl max-h-[70vh] flex flex-col safe-bottom"
          >
            <div className="flex items-center justify-between p-5 pb-3 shrink-0">
              <h2 className="text-lg font-bold">{t('workout.swap_pick_title')}</h2>
              <button onClick={() => setSwapOptions(null)} className="p-1.5 rounded-lg text-muted-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto pb-8">
              {swapOptions.map(c => {
                const thumb = getVideoThumbUrl(c.video_path);
                return (
                  <div key={c.id} className="w-full flex items-center gap-1 pr-3 hover:bg-muted transition-colors">
                    <button
                      onClick={() => { setSwapOptions(null); applySwap(c); }}
                      className="flex-1 min-w-0 flex items-center gap-3 pl-5 py-2.5 text-left"
                    >
                      <div className="shrink-0 w-11 h-11 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                        {thumb ? (
                          <img src={thumb} alt="" loading="lazy" className="w-full h-full object-cover" />
                        ) : (
                          <Dumbbell className="w-5 h-5 text-muted-foreground/50" />
                        )}
                      </div>
                      <span className="text-sm font-medium truncate">{(isEn && c.name_en) ? c.name_en : c.name}</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openExerciseInfo(c.id); }}
                      className="p-2.5 rounded-xl text-muted-foreground shrink-0"
                    >
                      <Info className="w-5 h-5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>

        </>
      )}
    </AnimatePresence>
  );

  // Exercise detail sheet (list-view ⓘ and swap-sheet ⓘ) — closing it returns
  // to whatever was underneath.
  const infoSheetJsx = (
          <AnimatePresence>
            {swapInfo && (
              <>
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[85] bg-black/40"
                  onClick={() => setSwapInfo(null)}
                />
                <motion.div
                  initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                  className="fixed left-0 right-0 bottom-0 z-[86] bg-background rounded-t-3xl max-h-[85vh] flex flex-col safe-bottom"
                >
                  <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
                    <p className="text-base font-bold truncate">{(isEn && swapInfo.nameEn) ? swapInfo.nameEn : swapInfo.name}</p>
                    <button onClick={() => setSwapInfo(null)} className="p-1.5 rounded-lg text-muted-foreground"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="overflow-y-auto px-5 pb-8">
                    {swapInfo.videoUrl ? (
                      <div className="relative rounded-2xl overflow-hidden bg-black mb-4 aspect-video">
                        <video
                          src={swapInfo.videoUrl}
                          playsInline autoPlay loop muted preload="auto"
                          className="w-full h-full object-contain"
                        />
                        <button
                          type="button"
                          onClick={(e) => enterVideoFullscreen(e.currentTarget.parentElement?.querySelector('video') ?? null)}
                          className="absolute bottom-2 right-2 z-10 p-2 rounded-lg bg-black/50 text-white active:scale-90 transition-transform"
                        >
                          <Maximize2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="rounded-2xl bg-muted mb-4 aspect-video flex items-center justify-center">
                        <p className="text-sm text-muted-foreground">{t('workout.no_video')}</p>
                      </div>
                    )}
                    <ExerciseInfoContent
                      category={swapInfo.category}
                      equipmentType={swapInfo.equipmentType}
                      machineName={swapInfo.machineName}
                      primaryMuscles={swapInfo.primaryMuscles}
                      secondaryMuscles={swapInfo.secondaryMuscles}
                      primaryMusclesEn={swapInfo.primaryMusclesEn}
                      secondaryMusclesEn={swapInfo.secondaryMusclesEn}
                      description={swapInfo.description}
                      descriptionEn={null}
                      setupInstructions={swapInfo.setupInstructions}
                      setupInstructionsEn={null}
                      commonMistakes={swapInfo.commonMistakes}
                      commonMistakesEn={null}
                      tips={swapInfo.tips}
                      tipsEn={null}
                    />
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
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
          onShowInfo={openExerciseInfo}
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
              <div className="mx-auto max-w-md bg-[#1A2744] text-white rounded-2xl shadow-xl px-3 py-2.5">
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
        initialSetIndex={playerSync > 0 ? currentSetIndex : (currentExerciseIndex === initialExerciseIndex ? initialSetIndex : 0)}
        initialSetsData={playerSync > 0 ? currentExerciseSets : (currentExerciseIndex === initialExerciseIndex ? initialCurrentExerciseSets : undefined)}
        onSetChange={(setIdx, sets) => {
          setCurrentSetIndex(setIdx);
          setCurrentExerciseSets(sets);
        }}
        nextExerciseName={(isEn && liveExercises[currentExerciseIndex + 1]?.exerciseNameEn) ? liveExercises[currentExerciseIndex + 1]!.exerciseNameEn! : (liveExercises[currentExerciseIndex + 1]?.exerciseName || undefined)}
        nextVideoUrl={nextVideoUrl}
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
    />
  );
};
