import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Check, SkipForward, Trophy, Play, Pause, ChevronRight, X, Info, MessageSquarePlus, MapPin, AlertTriangle, RefreshCw, List, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useCustomPlanDetail } from '@/hooks/useCustomPlans';
import { usePausedCustomWorkout } from '@/hooks/usePausedCustomWorkout';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAuth } from '@/contexts/AuthContext';
import { FeedbackModal } from '@/components/feedback/FeedbackModal';
import { GymSelector } from '@/components/workout/GymSelector';
import { WorkoutShareCard } from '@/components/workout/WorkoutShareCard';
import { CompactWorkoutView } from '@/components/workout/CompactWorkoutView';
import { supabase } from '@/integrations/supabase/client';
const REST_BETWEEN_SETS = 90; // seconds
const REST_BETWEEN_EXERCISES = 120; // seconds

import { playBeep, playFinishSound, unlockAudio, announceExercise, speakText, announceWorkoutComplete } from '@/lib/workoutAudio';

interface ExerciseWithVideo {
  id: string;
  exercise_id: string;
  exercise_name: string;
  sets: number;
  reps: number;
  reps_per_set: number[] | null;
  weight_kg: number | null;
  weight_per_set: number[] | null;
  rest_seconds: number;
  rest_per_set: number[] | null;
  video_path: string | null;
  machine_id: string | null;
  unit_type: string;
  category: string;
}

interface CompletedSetData {
  completed: boolean;
  weight: number | null;
  reps: number | null;
  durationSeconds: number | null;
}

interface ExerciseDetail {
  name: string;
  category: string;
  equipment_type: string | null;
  primary_muscles: string[];
  secondary_muscles: string[];
  video_path: string | null;
  machine_name: string | null;
  description: string | null;
  setup_instructions: string | null;
  common_mistakes: string | null;
  tips: string | null;
}

interface UnavailableExercise {
  exercise_name: string;
  exercise_id: string;
  reason: string;
}

interface SuggestedAlternative {
  exerciseId: string;
  exerciseName: string;
  forExercise: string;
}

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

type PlayerState = 'select_gym' | 'select_day' | 'equipment_warning' | 'exercise' | 'rest' | 'completed';

const CustomWorkoutPlayer = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { plan, isLoading } = useCustomPlanDetail(id || null);
  const { pausedWorkout, savePausedWorkout, clearPausedWorkout } = usePausedCustomWorkout();
  const { profile } = useUserProfile();
  const searchParams = new URLSearchParams(window.location.search);
  const resumeMode = searchParams.get('resume') === 'true';

  // State
  const [selectedGymId, setSelectedGymId] = useState<string | null>(null);
  const [gymName, setGymName] = useState<string>('');
  const [gymInstagram, setGymInstagram] = useState<string | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [resumeApplied, setResumeApplied] = useState(false);
  const [exercises, setExercises] = useState<ExerciseWithVideo[]>([]);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [playerState, setPlayerState] = useState<PlayerState>('select_gym');
  const [restSeconds, setRestSeconds] = useState(0);
  const [startTime] = useState<Date>(new Date());
  const [totalSetsCompleted, setTotalSetsCompleted] = useState(0);
  const [videoError, setVideoError] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [infoDrawerOpen, setInfoDrawerOpen] = useState(false);
  const [exerciseDetail, setExerciseDetail] = useState<ExerciseDetail | null>(null);
  const [infoVideoError, setInfoVideoError] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [unavailableExercises, setUnavailableExercises] = useState<UnavailableExercise[]>([]);
  const [suggestedAlternatives, setSuggestedAlternatives] = useState<SuggestedAlternative[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'video' | 'list'>('list');
  const [weight, setWeight] = useState<string>('');
  const [reps, setReps] = useState<string>('');
  // Track completed sets per exercise: Map<exerciseIndex, CompletedSetData[]>
  const [completedSetsMap, setCompletedSetsMap] = useState<Map<number, CompletedSetData[]>>(new Map());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Rest duration from plan DB (default 120s)
  const [currentRestTotal, setCurrentRestTotal] = useState<number>(120);

  const pendingAdvanceRef = useRef<{ type: 'next_exercise' | 'next_set'; exIdx: number; set?: number } | null>(null);

  // Cardio timer state
  const [cardioSeconds, setCardioSeconds] = useState(0);
  const [cardioTotalSeconds, setCardioTotalSeconds] = useState(0);
  const [cardioPaused, setCardioPaused] = useState(false);
  const cardioEndTimeRef = useRef<number>(0);
  const cardioPausedAtRef = useRef<number | null>(null);
  const cardioBeepsRef = useRef({ b3: false, b2: false, b1: false, done: false });

  // Must be declared before the cardio useEffects — dep array evaluates immediately (not a closure)
  const currentExercise = exercises[currentExerciseIndex] || null;
  const isCurrentCardio = currentExercise?.unit_type === 'time_min' || currentExercise?.category === 'cardio';

  // Init cardio timer when cardio exercise starts
  useEffect(() => {
    if (!isCurrentCardio || playerState !== 'exercise') return;
    const totalSec = currentExercise?.reps || 600;
    cardioEndTimeRef.current = Date.now() + totalSec * 1000;
    setCardioSeconds(totalSec);
    setCardioTotalSeconds(totalSec);
    setCardioPaused(false);
    cardioPausedAtRef.current = null;
    cardioBeepsRef.current = { b3: false, b2: false, b1: false, done: false };
  }, [currentExerciseIndex, currentSet, isCurrentCardio, playerState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cardio timer tick
  useEffect(() => {
    if (!isCurrentCardio || playerState !== 'exercise' || cardioPaused) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((cardioEndTimeRef.current - Date.now()) / 1000));
      setCardioSeconds(remaining);
      if (remaining === 3 && !cardioBeepsRef.current.b3) { cardioBeepsRef.current.b3 = true; playBeep(); }
      if (remaining === 2 && !cardioBeepsRef.current.b2) { cardioBeepsRef.current.b2 = true; playBeep(); }
      if (remaining === 1 && !cardioBeepsRef.current.b1) { cardioBeepsRef.current.b1 = true; playBeep(); }
      if (remaining <= 0 && !cardioBeepsRef.current.done) {
        cardioBeepsRef.current.done = true;
        playFinishSound();
        handleCardioComplete();
      }
    };
    tick();
    const interval = setInterval(tick, 250);
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
  }, [isCurrentCardio, playerState, cardioPaused]); // eslint-disable-line react-hooks/exhaustive-deps

  // Serialize completedSetsMap to plain object for localStorage
  const serializeCompletedSets = () => {
    const obj: Record<number, CompletedSetData[]> = {};
    completedSetsMap.forEach((sets, idx) => { obj[idx] = sets; });
    return obj;
  };

  const totalExercises = exercises.length;
  const totalSets = exercises.reduce((sum, e) => sum + e.sets, 0);

  // Initialize weight/reps inputs when exercise or set changes, with per-set values
  useEffect(() => {
    if (!currentExercise) return;
    const sIdx = currentSet - 1; // 0-based

    // Per-set reps, fallback to exercise-level
    const plannedReps = currentExercise.reps_per_set?.[sIdx] ?? currentExercise.reps;
    setReps(String(plannedReps || ''));

    // Per-set weight, fallback to exercise-level, then history
    const plannedWeight = currentExercise.weight_per_set?.[sIdx] ?? currentExercise.weight_kg;
    if (plannedWeight) {
      setWeight(String(plannedWeight));
    } else if (currentExercise.exercise_id) {
      supabase
        .from('workout_session_sets')
        .select('weight_kg')
        .eq('exercise_id', currentExercise.exercise_id)
        .not('weight_kg', 'is', null)
        .gt('weight_kg', 0)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
        .then(({ data }) => {
          if (data?.weight_kg) {
            setWeight(String(data.weight_kg));
          } else {
            setWeight('');
          }
        });
    } else {
      setWeight('');
    }
  }, [currentExerciseIndex, currentSet, currentExercise?.exercise_id]);

  // Compute progress: sets done / total sets
  const progressPercent = totalSets > 0 ? (totalSetsCompleted / totalSets) * 100 : 0;

  // Total weight and reps from actual completed sets
  const totalWeight = Array.from(completedSetsMap.values()).reduce((sum, sets) =>
    sum + sets.reduce((s, set) => s + ((set.weight || 0) * (set.reps || 0)), 0), 0);
  const totalReps = Array.from(completedSetsMap.values()).reduce((sum, sets) =>
    sum + sets.reduce((s, set) => s + (set.reps || 0), 0), 0);

  // Handle gym selection
  const handleGymSelected = async (gymId: string) => {
    setSelectedGymId(gymId);

    // Fetch gym name
    const { data: gymData } = await supabase
      .from('gyms')
      .select('name, instagram_handle')
      .eq('id', gymId)
      .single();
    if (gymData?.name) setGymName(gymData.name);
    if (gymData?.instagram_handle) setGymInstagram(gymData.instagram_handle);

    // Check if we're resuming (skip gym selection on resume)
    if (resumeMode && pausedWorkout && pausedWorkout.planId === id) {
      // Resume flow handled in useEffect
      setPlayerState('select_day');
      return;
    }

    setPlayerState('select_day');
  };

  // Check exercise equipment compatibility with selected gym
  const checkEquipmentCompatibility = useCallback(async (dayExercises: ExerciseWithVideo[]) => {
    if (!selectedGymId) return;

    // Get gym machines
    const { data: gymMachines } = await supabase
      .from('gym_machines')
      .select('machine_id')
      .eq('gym_id', selectedGymId);

    const gymMachineIds = new Set(gymMachines?.map(m => m.machine_id) || []);

    // Check which exercises require machines not in the gym
    const unavailable: UnavailableExercise[] = [];
    const alternatives: SuggestedAlternative[] = [];

    for (const ex of dayExercises) {
      if (ex.machine_id && !gymMachineIds.has(ex.machine_id)) {
        unavailable.push({
          exercise_name: ex.exercise_name,
          exercise_id: ex.exercise_id,
          reason: 'Stroj není v posilovně',
        });

        // Find alternative exercise with same primary_role that uses gym's equipment
        const { data: original } = await supabase
          .from('exercises')
          .select('primary_role')
          .eq('id', ex.exercise_id)
          .single();

        if (original?.primary_role) {
          const { data: alts } = await supabase
            .from('exercises')
            .select('id, name, machine_id')
            .eq('primary_role', original.primary_role)
            .neq('id', ex.exercise_id)
            .limit(20);

          // Find one that's available in the gym (or bodyweight)
          const alt = alts?.find(a => !a.machine_id || gymMachineIds.has(a.machine_id));
          if (alt) {
            alternatives.push({
              exerciseId: alt.id,
              exerciseName: alt.name,
              forExercise: ex.exercise_name,
            });
          }
        }
      }
    }

    if (unavailable.length > 0) {
      setUnavailableExercises(unavailable);
      setSuggestedAlternatives(alternatives);
      setPlayerState('equipment_warning');
    } else {
      setPlayerState('exercise');
    }
  }, [selectedGymId]);

  // Load exercises with video_path for selected day
  const loadDayExercises = useCallback(async (dayId: string) => {
    if (!plan) return;
    const day = plan.days.find(d => d.id === dayId);
    if (!day) return;

    const exerciseIds = day.exercises.map(e => e.exercise_id);
    const { data: exerciseData } = await supabase
      .from('exercises')
      .select('id, name, video_path, machine_id, unit_type, category')
      .in('id', exerciseIds);

    const dataMap = new Map<string, { video_path: string | null; machine_id: string | null; unit_type: string; category: string }>();
    exerciseData?.forEach(e => dataMap.set(e.id, { video_path: e.video_path, machine_id: e.machine_id, unit_type: (e as any).unit_type || 'reps', category: e.category || '' }));

    const loaded: ExerciseWithVideo[] = day.exercises.map(e => ({
      id: e.id,
      exercise_id: e.exercise_id,
      exercise_name: e.exercise_name || 'Cvik',
      sets: e.sets,
      reps: e.reps,
      reps_per_set: e.reps_per_set || null,
      weight_kg: e.weight_kg,
      weight_per_set: e.weight_per_set || null,
      rest_seconds: e.rest_seconds || 120,
      rest_per_set: e.rest_per_set || null,
      video_path: dataMap.get(e.exercise_id)?.video_path || null,
      machine_id: dataMap.get(e.exercise_id)?.machine_id || null,
      unit_type: dataMap.get(e.exercise_id)?.unit_type || 'reps',
      category: dataMap.get(e.exercise_id)?.category || '',
    }));

    // Fetch last weights from history for all exercises
    const exIds = loaded.map(e => e.exercise_id).filter(Boolean);
    if (exIds.length > 0) {
      const { data: weightData } = await supabase
        .from('workout_session_sets')
        .select('exercise_id, weight_kg')
        .in('exercise_id', exIds)
        .not('weight_kg', 'is', null)
        .gt('weight_kg', 0)
        .order('created_at', { ascending: false });

      if (weightData) {
        // Get latest weight per exercise (first occurrence since ordered desc)
        const weightMap = new Map<string, number>();
        weightData.forEach(w => {
          if (!weightMap.has(w.exercise_id)) weightMap.set(w.exercise_id, w.weight_kg);
        });
        // Update exercises with history weights
        loaded.forEach(ex => {
          if (!ex.weight_kg && weightMap.has(ex.exercise_id)) {
            ex.weight_kg = weightMap.get(ex.exercise_id)!;
          }
        });
      }
    }

    setExercises(loaded);
    setCurrentExerciseIndex(0);
    setCurrentSet(1);
    setTotalSetsCompleted(0);

    // Announce first exercise — per-set values for set 1
    if (loaded[0]) {
      const ex = loaded[0];
      const w = ex.weight_per_set?.[0] ?? ex.weight_kg;
      const r = ex.reps_per_set?.[0] ?? ex.reps;
      setTimeout(() => announceExercise(ex.exercise_name, w || undefined, `${r}`), 500);
    }

    // Check equipment compatibility
    await checkEquipmentCompatibility(loaded);
  }, [plan, checkEquipmentCompatibility]);

  // Start day
  const handleStartDay = (dayId: string) => {
    unlockAudio(); // Unlock audio on user gesture for mobile browsers
    setSelectedDayId(dayId);
    loadDayExercises(dayId);
  };

  // Resume paused workout or auto-start if plan has only one day
  useEffect(() => {
    if (!plan || resumeApplied) return;
    if (playerState !== 'select_day') return;

    if (resumeMode && pausedWorkout && pausedWorkout.planId === id) {
      setResumeApplied(true);
      const dayId = pausedWorkout.dayId;
      setSelectedDayId(dayId);
      // Restore completed sets data before loading exercises
      const savedSetsData = pausedWorkout.completedSetsData;
      loadDayExercises(dayId).then(() => {
        setCurrentExerciseIndex(pausedWorkout.currentExerciseIndex);
        setCurrentSet(pausedWorkout.currentSet);
        setTotalSetsCompleted(pausedWorkout.totalSetsCompleted);
        // Restore completed sets map
        if (savedSetsData) {
          const restored = new Map<number, CompletedSetData[]>();
          Object.entries(savedSetsData).forEach(([key, sets]) => {
            restored.set(Number(key), sets);
          });
          setCompletedSetsMap(restored);
        }
      });
      clearPausedWorkout();
      return;
    }
    if (plan.days.length === 1 && playerState === 'select_day') {
      handleStartDay(plan.days[0].id);
    }
  }, [plan, playerState]);

  // Rest timer — uses real clock so it survives phone sleep
  const restEndTimeRef = useRef<number>(0);
  const restBeepsRef = useRef({ b3: false, b2: false, b1: false, done: false, spoken: false });

  // Set end time when rest starts
  useEffect(() => {
    if (playerState === 'rest' && currentRestTotal > 0) {
      restEndTimeRef.current = Date.now() + currentRestTotal * 1000;
      restBeepsRef.current = { b3: false, b2: false, b1: false, done: false, spoken: false };
    }
  }, [playerState, currentRestTotal]);

  // Build announcement text for next set/exercise using per-set values
  const buildAnnouncementText = () => {
    const pending = pendingAdvanceRef.current;
    let name = '';
    let w: number | null = null;
    let r: number | null = null;

    if (pending?.type === 'next_exercise') {
      const nextEx = exercises[pending.exIdx];
      if (nextEx) {
        name = nextEx.exercise_name;
        w = nextEx.weight_per_set?.[0] ?? nextEx.weight_kg;
        r = nextEx.reps_per_set?.[0] ?? nextEx.reps;
      }
    } else if (pending?.type === 'next_set') {
      const ex = exercises[pending.exIdx];
      if (ex) {
        const setIdx = (pending.set || 1) - 1;
        name = ex.exercise_name;
        w = ex.weight_per_set?.[setIdx] ?? ex.weight_kg;
        r = ex.reps_per_set?.[setIdx] ?? ex.reps;
      }
    } else if (currentExercise) {
      // Video mode fallback
      if (currentSet >= currentExercise.sets && currentExerciseIndex < exercises.length - 1) {
        const nextEx = exercises[currentExerciseIndex + 1];
        name = nextEx.exercise_name;
        w = nextEx.weight_per_set?.[0] ?? nextEx.weight_kg;
        r = nextEx.reps_per_set?.[0] ?? nextEx.reps;
      } else if (currentSet < currentExercise.sets) {
        const setIdx = currentSet; // next set (0-based = currentSet since currentSet is 1-based current)
        name = currentExercise.exercise_name;
        w = currentExercise.weight_per_set?.[setIdx] ?? currentExercise.weight_kg;
        r = currentExercise.reps_per_set?.[setIdx] ?? currentExercise.reps;
      }
    }

    let text = '3, 2, 1';
    if (name) {
      text += `, ${name}`;
      if (w && w > 0) text += `, ${w} kilo`;
      if (r) text += `, ${r} opakování`;
    }
    return text;
  };

  // Tick rest timer
  useEffect(() => {
    if (playerState !== 'rest') return;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((restEndTimeRef.current - Date.now()) / 1000));
      setRestSeconds(remaining);

      const b = restBeepsRef.current;
      // Voice countdown at 5s — gives TTS time to load and play aligned with 3,2,1
      if (remaining <= 5 && remaining > 3 && !b.spoken) {
        b.spoken = true;
        const text = buildAnnouncementText();
        speakText(text);
      }
      if (remaining === 3 && !b.b3) { b.b3 = true; playBeep(); }
      if (remaining === 2 && !b.b2) { b.b2 = true; playBeep(); }
      if (remaining === 1 && !b.b1) { b.b1 = true; playBeep(); }
      if (remaining <= 0 && !b.done) {
        b.done = true;
        playFinishSound();
        advanceAfterRest();
      }
    };

    tick();
    const interval = setInterval(tick, 250);
    const handleVisibility = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [playerState]); // eslint-disable-line react-hooks/exhaustive-deps

  // What happens after rest ends
  const advanceAfterRest = () => {
    // Check if list mode triggered the rest (pendingAdvance)
    const pending = pendingAdvanceRef.current;
    if (pending) {
      pendingAdvanceRef.current = null;
      if (pending.type === 'next_exercise') {
        setCurrentExerciseIndex(pending.exIdx);
        setCurrentSet(1);
        setPlayerState('exercise');
      } else {
        setCurrentExerciseIndex(pending.exIdx);
        setCurrentSet(pending.set || 1);
        setPlayerState('exercise');
      }
      return;
    }

    // Video mode rest logic
    if (!currentExercise) return;
    if (currentSet < currentExercise.sets) {
      setCurrentSet(prev => prev + 1);
      setPlayerState('exercise');
    } else {
      if (currentExerciseIndex < exercises.length - 1) {
        setCurrentExerciseIndex(prev => prev + 1);
        setCurrentSet(1);
        setPlayerState('exercise');
      } else {
        setPlayerState('completed');
        announceWorkoutComplete();
      }
    }
  };

  // Complete current set
  const handleCompleteSet = () => {
    // Save weight/reps for this set
    const enteredWeight = weight ? parseFloat(weight) : (currentExercise?.weight_kg || null);
    const enteredReps = reps ? parseInt(reps) : (currentExercise?.reps || null);

    setCompletedSetsMap(prev => {
      const next = new Map(prev);
      const existing = next.get(currentExerciseIndex) || [];
      next.set(currentExerciseIndex, [...existing, { completed: true, weight: enteredWeight, reps: enteredReps, durationSeconds: null }]);
      return next;
    });

    setTotalSetsCompleted(prev => prev + 1);

    const isLastSet = currentSet >= (currentExercise?.sets || 1);
    const isLastExercise = currentExerciseIndex >= exercises.length - 1;

    if (isLastSet && isLastExercise) {
      setPlayerState('completed');
      return;
    }

    // Reset inputs for next set (keep weight, reset reps)
    if (isLastSet) {
      setWeight('');
      setReps('');
    }

    // Start rest — use per-set rest duration
    const setIdx = currentSet - 1; // 0-based
    const restTime = currentExercise?.rest_per_set?.[setIdx] ?? currentExercise?.rest_seconds ?? 120;
    setRestSeconds(restTime);
    setCurrentRestTotal(restTime);
    setPlayerState('rest');
  };

  const handleCardioComplete = () => {
    if (cardioBeepsRef.current.done && cardioSeconds > 0) return;
    setCompletedSetsMap(prev => {
      const next = new Map(prev);
      const existing = next.get(currentExerciseIndex) || [];
      next.set(currentExerciseIndex, [...existing, { completed: true, weight: null, reps: currentExercise?.reps || 0, durationSeconds: cardioTotalSeconds }]);
      return next;
    });
    setTotalSetsCompleted(prev => prev + 1);
    const isLastExercise = currentExerciseIndex >= exercises.length - 1;
    if (isLastExercise) { setPlayerState('completed'); announceWorkoutComplete(); return; }
    const restTime = currentExercise?.rest_seconds ?? 60;
    setRestSeconds(restTime);
    setCurrentRestTotal(restTime);
    setPlayerState('rest');
    pendingAdvanceRef.current = { type: 'next_exercise', exIdx: currentExerciseIndex + 1 };
  };

  const handleCardioPauseToggle = () => {
    if (cardioPaused) {
      const pausedDur = Date.now() - (cardioPausedAtRef.current || Date.now());
      cardioEndTimeRef.current += pausedDur;
      cardioPausedAtRef.current = null;
      const remaining = Math.max(0, Math.ceil((cardioEndTimeRef.current - Date.now()) / 1000));
      cardioBeepsRef.current.b3 = remaining < 3;
      cardioBeepsRef.current.b2 = remaining < 2;
      cardioBeepsRef.current.b1 = remaining < 1;
    } else {
      cardioPausedAtRef.current = Date.now();
    }
    setCardioPaused(p => !p);
  };

  // Skip rest
  const handleSkipRest = () => {
    setRestSeconds(0);
    advanceAfterRest();
  };

  // Go back to previous set
  const handleGoBack = () => {
    if (playerState === 'rest') {
      setPlayerState('exercise');
      return;
    }
    if (currentSet > 1) {
      setCurrentSet(prev => prev - 1);
      setTotalSetsCompleted(prev => Math.max(0, prev - 1));
    } else if (currentExerciseIndex > 0) {
      const prevExercise = exercises[currentExerciseIndex - 1];
      setCurrentExerciseIndex(prev => prev - 1);
      setCurrentSet(prevExercise.sets);
      setTotalSetsCompleted(prev => Math.max(0, prev - 1));
    }
  };

  // Format seconds to mm:ss
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Duration
  const durationMinutes = Math.round((new Date().getTime() - startTime.getTime()) / 60000);

  // Next exercise name for rest screen
  const getNextInfo = () => {
    if (!currentExercise) return '';
    if (currentSet < currentExercise.sets) {
      return `${currentExercise.exercise_name} · Série ${currentSet + 1}`;
    }
    if (currentExerciseIndex < exercises.length - 1) {
      return exercises[currentExerciseIndex + 1].exercise_name;
    }
    return '';
  };

  const handleShowInfo = async (exerciseId: string) => {
    setInfoVideoError(false);
    const { data } = await supabase
      .from('exercises')
      .select('name, category, equipment_type, primary_muscles, secondary_muscles, video_path, description, setup_instructions, common_mistakes, tips, machines!exercises_machine_id_fkey(name)')
      .eq('id', exerciseId)
      .single();
    if (data) {
      setExerciseDetail({
        name: data.name,
        category: data.category || '',
        equipment_type: data.equipment_type,
        primary_muscles: data.primary_muscles || [],
        secondary_muscles: data.secondary_muscles || [],
        video_path: data.video_path,
        machine_name: (data as any).machines?.name || null,
        description: (data as any).description || null,
        setup_instructions: (data as any).setup_instructions || null,
        common_mistakes: (data as any).common_mistakes || null,
        tips: (data as any).tips || null,
      });
      setInfoDrawerOpen(true);
    }
  };

  // Finish workout — save session + navigate home
  const handleFinishWorkout = async () => {
    setIsSaving(true);
    try {
      if (user) {
        const completedAt = new Date();
        const durationSeconds = Math.floor((completedAt.getTime() - startTime.getTime()) / 1000);

        // Create workout session record
        const { data: session, error: sessionError } = await supabase
          .from('workout_sessions')
          .insert({
            user_id: user.id,
            plan_id: null,
            gym_id: selectedGymId,
            day_letter: plan?.name?.substring(0, 2).toUpperCase() || 'CU',
            goal_id: 'general_fitness',
            started_at: startTime.toISOString(),
            completed_at: completedAt.toISOString(),
            duration_seconds: durationSeconds,
            total_sets: totalSetsCompleted,
            total_reps: totalReps,
            total_weight_kg: totalWeight,
            is_bonus: false,
          })
          .select()
          .single();

        if (sessionError) {
          console.error('Error creating custom workout session:', sessionError);
        }
        if (!sessionError && session) {
          // Save individual set records from actual completed data
          const setInserts: any[] = [];
          exercises.forEach((exercise, exIdx) => {
            const setsData = completedSetsMap.get(exIdx) || [];
            for (let i = 0; i < exercise.sets; i++) {
              const setData = setsData[i];
              setInserts.push({
                session_id: session.id,
                exercise_id: exercise.exercise_id || null,
                exercise_name: exercise.exercise_name,
                set_number: i + 1,
                weight_kg: setData?.weight || null,
                reps: setData?.reps || null,
                completed: setData?.completed || false,
              });
            }
          });
          if (setInserts.length > 0) {
            const { error: setsError } = await supabase.from('workout_session_sets').insert(setInserts);
            if (setsError) console.error('Error saving custom workout sets:', setsError);
          }
        }
      }
    } catch (err) {
      console.error('Error saving custom workout session:', err);
    }
    clearPausedWorkout();
    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#5BC8F5] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Plán nenalezen</p>
          <Button onClick={() => navigate('/')} variant="outline">Zpět</Button>
        </div>
      </div>
    );
  }

  // --- Gym Selection ---
  if (playerState === 'select_gym') {
    return (
      <GymSelector
        onSelect={handleGymSelected}
        onCancel={() => navigate(-1)}
        selectedGymId={profile?.selected_gym_id}
      />
    );
  }

  // --- Day Selection ---
  if (playerState === 'select_day') {
    return (
      <div className="min-h-screen bg-background safe-top">
        <div className="px-6 pt-8 pb-4">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setPlayerState('select_gym')} className="p-2 -ml-2 rounded-xl hover:bg-muted transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold">{plan.name}</h1>
          </div>

          {/* Selected gym info */}
          {gymName && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-muted/50 rounded-xl">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{gymName}</span>
              <button
                onClick={() => setPlayerState('select_gym')}
                className="ml-auto text-xs text-primary font-medium"
              >
                Změnit
              </button>
            </div>
          )}

          <p className="text-muted-foreground mb-6">Vyber den, který chceš trénovat:</p>
          <div className="space-y-3">
            {plan.days.filter(d => d.exercises.length > 0).map((day) => (
              <button
                key={day.id}
                onClick={() => handleStartDay(day.id)}
                className="w-full flex items-center gap-4 p-4 bg-card border border-border rounded-2xl hover:border-[#5BC8F5]/50 transition-colors text-left"
              >
                <div className="w-12 h-12 bg-[#5BC8F5]/10 rounded-xl flex items-center justify-center shrink-0">
                  <Play className="w-5 h-5 text-[#5BC8F5]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{day.name || `Den ${day.day_number}`}</p>
                  <p className="text-sm text-muted-foreground">{day.exercises.length} cviků</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- Equipment Warning ---
  if (playerState === 'equipment_warning') {
    return (
      <div className="min-h-screen bg-background safe-top">
        <div className="px-6 pt-8 pb-4">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setPlayerState('select_day')} className="p-2 -ml-2 rounded-xl hover:bg-muted transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold">Upozornění na vybavení</h1>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-amber-700 dark:text-amber-400 mb-1">
                  Některé cviky nejsou dostupné
                </p>
                <p className="text-sm text-muted-foreground">
                  V posilovně <strong>{gymName}</strong> chybí vybavení pro tyto cviky:
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            {unavailableExercises.map((ex, i) => {
              const alt = suggestedAlternatives.find(a => a.forExercise === ex.exercise_name);
              return (
                <div key={i} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <X className="w-4 h-4 text-red-500" />
                    <p className="font-medium text-sm">{ex.exercise_name}</p>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">{ex.reason}</p>
                  {alt && (
                    <div className="mt-2 ml-6 flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 text-green-500" />
                      <p className="text-xs text-green-600 dark:text-green-400">
                        Doporučení: <strong>{alt.exerciseName}</strong>
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-sm text-muted-foreground mb-6">
            Můžeš pokračovat i s těmito cviky, nebo se vrátit a upravit svůj plán.
          </p>

          <div className="space-y-3">
            <Button
              className="w-full"
              onClick={() => setPlayerState('exercise')}
            >
              Pokračovat přesto
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate(`/custom-plan/${id}`)}
            >
              Upravit plán
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // --- Completed Screen (Share Card) ---
  if (playerState === 'completed') {
    return (
      <WorkoutShareCard
        dayLetter={plan.name.substring(0, 2).toUpperCase()}
        dayName={plan.name}
        goalId="general_fitness"
        gymName={gymName}
        gymInstagram={gymInstagram}
        totalDuration={durationMinutes}
        totalSets={totalSetsCompleted}
        totalWeight={totalWeight}
        totalReps={totalReps}
        exerciseCount={totalExercises}
        exerciseDetails={exercises.map((ex, i) => {
          const sets = completedSetsMap.get(i) || [];
          return { name: ex.exercise_name, sets: sets.filter(s => s.completed).map(s => ({ weight: s.weight ?? 0, reps: s.reps ?? 0 })) };
        })}
        onClose={() => setPlayerState('exercise')}
        onFinish={handleFinishWorkout}
        isSaving={isSaving}
      />
    );
  }

  // --- List Mode Rest Screen ---
  if (viewMode === 'list' && playerState === 'rest') {
    return (
      <div className="h-[100dvh] bg-background flex flex-col items-center justify-center px-6">
        <button onClick={() => setShowExitDialog(true)} className="absolute top-4 right-4 safe-top p-2 rounded-xl bg-muted text-muted-foreground">
          <X className="w-5 h-5" />
        </button>
        <p className="text-muted-foreground text-sm font-medium mb-4">Odpočinek</p>

        <div className="relative w-48 h-48 mb-6">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted" />
            <circle
              cx="100" cy="100" r="90" fill="none" stroke="hsl(var(--primary))" strokeWidth="6"
              strokeDasharray={565.5}
              strokeDashoffset={565.5 * (1 - restSeconds / currentRestTotal)}
              strokeLinecap="round"
              className="transition-all duration-300"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            {restSeconds <= 3 && restSeconds > 0 ? (
              <span className="text-7xl font-black text-destructive animate-pulse">{restSeconds}</span>
            ) : (
              <span className="text-5xl font-bold tabular-nums">{formatTime(restSeconds)}</span>
            )}
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          Další: {getNextInfo()}
        </p>

        <button
          onClick={handleSkipRest}
          className="flex items-center gap-2 px-5 py-3 rounded-xl border border-border text-muted-foreground"
        >
          <SkipForward className="w-4 h-4" />
          Přeskočit pauzu
        </button>

        {/* Exit dialog */}
        <AnimatePresence>
          {showExitDialog && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6">
              <div className="bg-background rounded-2xl p-6 max-w-sm w-full">
                <h3 className="text-lg font-bold mb-2">Ukončit trénink?</h3>
                <p className="text-sm text-muted-foreground mb-4">Tvůj postup bude ztracen.</p>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setShowExitDialog(false)}>Zpět</Button>
                  <Button variant="destructive" className="flex-1" onClick={() => navigate(-1)}>Ukončit</Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // --- Compact List Mode ---
  if (viewMode === 'list' && playerState === 'exercise') {
    // Map custom workout data to CompactWorkoutView format
    const compactExercises = exercises.map(ex => ({
      id: ex.id,
      exerciseId: ex.exercise_id,
      exerciseName: ex.exercise_name,
      roleId: '',
      machineName: null as string | null,
      sets: ex.sets,
      repMin: ex.reps,
      repMax: ex.reps,
      slotCategory: null as string | null,
      repsPerSet: ex.reps_per_set,
      weightPerSet: ex.weight_per_set,
    }));

    const compactSetsMap = new Map<number, { completed: boolean; weight?: number; reps?: number; durationSeconds?: number }[]>();
    exercises.forEach((ex, idx) => {
      const completedSets = completedSetsMap.get(idx) || [];
      const fullSets = Array.from({ length: ex.sets }, (_, i) => {
        const s = completedSets[i];
        return s
          ? { completed: s.completed, weight: s.weight ?? undefined, reps: s.reps ?? undefined, durationSeconds: s.durationSeconds ?? undefined }
          : { completed: false };
      });
      compactSetsMap.set(idx, fullSets);
    });

    const handleCompactComplete = (exIdx: number, setIdx: number, w?: number, r?: number, duration?: number) => {
      setCompletedSetsMap(prev => {
        const next = new Map(prev);
        const existing = next.get(exIdx) || [];
        const newSets = [...existing];
        while (newSets.length <= setIdx) {
          newSets.push({ completed: false, weight: null, reps: null, durationSeconds: null });
        }
        newSets[setIdx] = { completed: true, weight: w ?? null, reps: r ?? null, durationSeconds: duration ?? null };
        next.set(exIdx, newSets);
        return next;
      });
      setTotalSetsCompleted(prev => prev + 1);

      // Check if all sets done for exercise → auto advance
      const exercise = exercises[exIdx];
      if (!exercise) return;
      const setsForEx = (completedSetsMap.get(exIdx) || []).length + 1;
      const completedSetIdx = setsForEx - 1; // just completed set (0-based)
      const exRestSec = exercise.rest_per_set?.[completedSetIdx] ?? exercise.rest_seconds ?? 120;
      if (setsForEx >= exercise.sets) {
        if (exIdx < exercises.length - 1) {
          setRestSeconds(exRestSec);
          setCurrentRestTotal(exRestSec);
          setPlayerState('rest');
          pendingAdvanceRef.current = { type: 'next_exercise', exIdx: exIdx + 1 };
        } else {
          setPlayerState('completed');
          announceWorkoutComplete();
        }
      } else {
        setCurrentExerciseIndex(exIdx);
        setCurrentSet(setsForEx + 1);
        setRestSeconds(exRestSec);
        setCurrentRestTotal(exRestSec);
        setPlayerState('rest');
        pendingAdvanceRef.current = { type: 'next_set', exIdx, set: setsForEx + 1 };
      }
    };

    return (
      <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
        <CompactWorkoutView
          exercises={compactExercises}
          currentExerciseIndex={currentExerciseIndex}
          setsDataByExercise={compactSetsMap}
          onCompleteSet={handleCompactComplete}
          onSelectExercise={(idx) => {
            setCurrentExerciseIndex(idx);
            setCurrentSet(1);
          }}
          onSwitchToVideo={() => {
            setViewMode('video');
            setPlayerState('exercise');
          }}
          onClose={() => setShowExitDialog(true)}
          onSkipExercise={() => {
            if (currentExerciseIndex < exercises.length - 1) {
              setCurrentExerciseIndex(prev => prev + 1);
              setCurrentSet(1);
            } else {
              setPlayerState('completed');
            }
          }}
          totalExercises={exercises.length}
          showTimer
          onShowInfo={handleShowInfo}
          onFinishWorkout={() => setPlayerState('completed')}
        />

        {/* Exit confirmation dialog */}
        <AnimatePresence>
          {showExitDialog && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowExitDialog(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm"
                onClick={e => e.stopPropagation()}
              >
                <h2 className="text-lg font-bold text-center mb-1">Ukončit trénink?</h2>
                <p className="text-muted-foreground text-sm text-center mb-6">Co chceš udělat s tréninkem?</p>
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      setShowExitDialog(false);
                      if (id && plan && selectedDayId) {
                        const day = plan.days.find(d => d.id === selectedDayId);
                        savePausedWorkout({
                          planId: id,
                          planName: plan.name,
                          dayId: selectedDayId,
                          dayName: day?.name || `Den ${day?.day_number || 1}`,
                          currentExerciseIndex,
                          currentSet,
                          totalSetsCompleted,
                          startedAt: startTime.toISOString(),
                          pausedAt: new Date().toISOString(),
                          completedSetsData: serializeCompletedSets(),
                        });
                      }
                      navigate('/');
                    }}
                    className="w-full py-3.5 rounded-xl bg-muted text-foreground font-semibold hover:bg-muted/80 transition-colors"
                  >
                    Pozastavit trénink
                  </button>
                  <button
                    onClick={() => {
                      setShowExitDialog(false);
                      clearPausedWorkout();
                      setPlayerState('completed');
                    }}
                    className="w-full py-3.5 rounded-xl bg-red-500/90 text-white font-semibold hover:bg-red-500 transition-colors"
                  >
                    Ukončit trénink
                  </button>
                  <button
                    onClick={() => setShowExitDialog(false)}
                    className="w-full py-3.5 rounded-xl text-muted-foreground font-medium hover:text-foreground transition-colors"
                  >
                    Pokračovat
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Exercise info drawer (list mode) */}
        <Drawer open={infoDrawerOpen} onOpenChange={setInfoDrawerOpen}>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader>
              <DrawerTitle>{exerciseDetail?.name || 'Detail cviku'}</DrawerTitle>
            </DrawerHeader>
            {exerciseDetail && (
              <div className="px-4 pb-6 overflow-y-auto">
                {exerciseDetail.video_path ? (
                  <div className="rounded-2xl overflow-hidden bg-black mb-4 aspect-video">
                    {infoVideoError ? (
                      <div className="w-full h-full flex items-center justify-center text-white/50 text-sm">Video nedostupné</div>
                    ) : (
                      <video
                        key={exerciseDetail.video_path}
                        src={exerciseDetail.video_path}
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
                  {categoryLabels[exerciseDetail.category] || exerciseDetail.category}
                  {exerciseDetail.equipment_type && ` · ${equipmentLabels[exerciseDetail.equipment_type] || exerciseDetail.equipment_type}`}
                  {exerciseDetail.machine_name && ` · ${exerciseDetail.machine_name}`}
                </p>
                {exerciseDetail.primary_muscles.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Primární svaly</p>
                    <div className="flex flex-wrap gap-1.5">
                      {exerciseDetail.primary_muscles.map((m) => (
                        <span key={m} className="text-xs bg-[#5BC8F5]/15 text-[#5BC8F5] px-2.5 py-1 rounded-full font-medium">{m}</span>
                      ))}
                    </div>
                  </div>
                )}
                {exerciseDetail.secondary_muscles.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Sekundární svaly</p>
                    <div className="flex flex-wrap gap-1.5">
                      {exerciseDetail.secondary_muscles.map((m) => (
                        <span key={m} className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full">{m}</span>
                      ))}
                    </div>
                  </div>
                )}
                {exerciseDetail.description && (
                  <div className="mb-4 p-3 bg-muted/50 rounded-xl">
                    <p className="text-xs font-semibold text-foreground mb-1">Popis & technika</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{exerciseDetail.description}</p>
                  </div>
                )}
                {exerciseDetail.setup_instructions && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-foreground mb-1">Nastavení</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{exerciseDetail.setup_instructions}</p>
                  </div>
                )}
                {exerciseDetail.common_mistakes && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-amber-600 mb-1">Časté chyby</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{exerciseDetail.common_mistakes}</p>
                  </div>
                )}
                {exerciseDetail.tips && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-green-600 mb-1">Tipy</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{exerciseDetail.tips}</p>
                  </div>
                )}
              </div>
            )}
          </DrawerContent>
        </Drawer>
      </div>
    );
  }

  // --- Exercise / Rest Screen ---
  return (
    <div className="h-[100dvh] bg-black flex flex-col overflow-hidden" style={{ overscrollBehavior: 'none', touchAction: 'none' }}>
      <AnimatePresence mode="wait">
        {playerState === 'exercise' && currentExercise && (
          <motion.div
            key={`exercise-${currentExerciseIndex}-${currentSet}`}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col relative"
          >
            {/* Full-screen video */}
            <div className="flex-1 relative">
              {currentExercise.video_path && !videoError ? (
                <video
                  key={currentExercise.video_path}
                  src={currentExercise.video_path!}
                  autoPlay loop muted playsInline
                  preload="auto"
                  className="w-full h-full object-cover"
                  onError={() => setVideoError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-neutral-900">
                  <p className="text-white/30 text-sm">{videoError ? 'Video nedostupné' : 'Bez videa'}</p>
                </div>
              )}

              {/* Top overlay: back + progress + counter */}
              <div className="absolute top-0 left-0 right-0 safe-top">
                <div className="flex items-center gap-3 px-4 pt-4 pb-2">
                  {(currentExerciseIndex > 0 || currentSet > 1 || playerState === 'rest') && (
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
                    {currentExerciseIndex + 1}/{totalExercises}
                  </span>
                  <button onClick={() => setViewMode('list')} className="p-2 rounded-xl bg-black/30 backdrop-blur-sm text-white">
                    <List className="w-5 h-5" />
                  </button>
                  <button onClick={() => setShowExitDialog(true)} className="p-2 rounded-xl bg-black/30 backdrop-blur-sm text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Top-left: exercise name + set info + info button */}
              <div className="absolute top-16 left-0 px-4 safe-top flex items-start gap-2">
                <div className="bg-black/40 backdrop-blur-sm rounded-xl px-3 py-2">
                  <p className="text-white font-bold text-base leading-tight">{currentExercise.exercise_name}</p>
                  <p className="text-white/70 text-sm mt-0.5">
                    Série {currentSet} / {currentExercise.sets}
                  </p>
                </div>
                <button
                  onClick={() => handleShowInfo(currentExercise.exercise_id)}
                  className="p-2.5 rounded-xl bg-black/40 backdrop-blur-sm text-white/70 hover:text-white transition-colors"
                >
                  <Info className="w-5 h-5" />
                </button>
              </div>

              {/* Bottom overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-16 pb-16 px-5">
                {isCurrentCardio ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="bg-black/40 backdrop-blur-sm rounded-xl px-6 py-3 text-center">
                      <p className="text-white/60 text-xs mb-1">Kardio · {Math.floor(currentExercise.reps / 60)}:{String(currentExercise.reps % 60).padStart(2, '0')} min</p>
                      <p className={`text-5xl font-bold tabular-nums ${cardioSeconds <= 10 ? 'text-red-400' : 'text-white'}`}>
                        {formatTime(cardioSeconds)}
                      </p>
                      {cardioPaused && <p className="text-white/50 text-xs mt-1">Pozastaveno</p>}
                    </div>
                    <div className="flex items-center gap-4">
                      <button onClick={handleCardioPauseToggle} className="w-16 h-16 rounded-full bg-[#5BC8F5] flex items-center justify-center shadow-lg shadow-[#5BC8F5]/40 active:scale-95 transition-transform">
                        {cardioPaused ? <Play className="w-7 h-7 text-white ml-1" /> : <Pause className="w-7 h-7 text-white" />}
                      </button>
                      <button onClick={handleCardioComplete} className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform">
                        <SkipForward className="w-5 h-5 text-white" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {(completedSetsMap.get(currentExerciseIndex) || []).some(s => s.completed && s.weight) && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {(completedSetsMap.get(currentExerciseIndex) || []).map((set, i) =>
                          set.completed && set.weight ? (
                            <span key={i} className="text-xs bg-white/15 backdrop-blur-sm text-white/80 px-2 py-1 rounded-lg">
                              S{i + 1}: {set.weight}kg × {set.reps || 0}
                            </span>
                          ) : null
                        )}
                      </div>
                    )}
                    <div className="flex items-end gap-3">
                      <div className="flex-1">
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="text-[10px] text-white/50 mb-0.5 block px-1">Váha (kg)</label>
                            <input type="number" inputMode="decimal" placeholder="např. 60" value={weight} onChange={(e) => setWeight(e.target.value)} className="w-full bg-white/15 backdrop-blur-sm text-white text-center text-lg font-semibold rounded-xl h-12 border-0 outline-none focus:ring-2 focus:ring-[#5BC8F5]/50 placeholder:text-white/30" />
                          </div>
                          <div className="flex-1">
                            <label className="text-[10px] text-white/50 mb-0.5 block px-1">Opakování</label>
                            <input type="number" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} className="w-full bg-white/15 backdrop-blur-sm text-white text-center text-lg font-semibold rounded-xl h-12 border-0 outline-none focus:ring-2 focus:ring-[#5BC8F5]/50" />
                          </div>
                        </div>
                      </div>
                      <button onClick={() => { setVideoError(false); handleCompleteSet(); }} className="w-16 h-16 rounded-full bg-[#5BC8F5] flex items-center justify-center shadow-lg shadow-[#5BC8F5]/40 active:scale-95 transition-transform">
                        <ChevronRight className="w-8 h-8 text-white" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {playerState === 'rest' && (
          <motion.div
            key="rest"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col items-center justify-center px-6 relative bg-white"
          >
            {/* Exit button on rest screen */}
            <button onClick={() => setShowExitDialog(true)} className="absolute top-4 right-4 safe-top p-2 rounded-xl bg-black/5 text-neutral-400">
              <X className="w-5 h-5" />
            </button>
            <p className="text-neutral-400 text-sm font-medium mb-4">Odpočinek</p>

            {/* Big timer */}
            <div className="relative w-48 h-48 mb-6">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" strokeWidth="6" className="text-neutral-100" />
                <circle
                  cx="100" cy="100" r="90" fill="none" stroke="#5BC8F5" strokeWidth="6"
                  strokeDasharray={565.5}
                  strokeDashoffset={565.5 * (1 - restSeconds / (currentSet < (currentExercise?.sets || 1) ? REST_BETWEEN_SETS : REST_BETWEEN_EXERCISES))}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                {restSeconds <= 3 && restSeconds > 0 ? (
                  <span className="text-7xl font-black text-red-500 animate-pulse">{restSeconds}</span>
                ) : (
                  <span className={`text-5xl font-bold tabular-nums text-[#1A2744]`}>{formatTime(restSeconds)}</span>
                )}
              </div>
            </div>

            {/* Next info */}
            <p className="text-sm text-neutral-400 mb-8">
              Další: {getNextInfo()}
            </p>


            {/* Skip button */}
            <button
              onClick={handleSkipRest}
              className="flex items-center gap-2 px-5 py-3 rounded-xl border border-neutral-200 text-neutral-500 hover:text-[#1A2744] hover:border-neutral-300 transition-colors"
            >
              <SkipForward className="w-4 h-4" />
              Přeskočit pauzu
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Exit confirmation dialog */}
      <AnimatePresence>
        {showExitDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowExitDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-neutral-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm"
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-white text-lg font-bold text-center mb-1">Ukončit trénink?</h2>
              <p className="text-white/50 text-sm text-center mb-6">Co chceš udělat s tréninkem?</p>
              <div className="space-y-3">
                <button
                  onClick={() => {
                    setShowExitDialog(false);
                    // Save paused state
                    if (id && plan && selectedDayId) {
                      const day = plan.days.find(d => d.id === selectedDayId);
                      savePausedWorkout({
                        planId: id,
                        planName: plan.name,
                        dayId: selectedDayId,
                        dayName: day?.name || `Den ${day?.day_number || 1}`,
                        currentExerciseIndex,
                        currentSet,
                        totalSetsCompleted,
                        startedAt: startTime.toISOString(),
                        pausedAt: new Date().toISOString(),
                        completedSetsData: serializeCompletedSets(),
                      });
                    }
                    navigate('/');
                  }}
                  className="w-full py-3.5 rounded-xl bg-white/10 text-white font-semibold hover:bg-white/15 transition-colors"
                >
                  Pozastavit trénink
                </button>
                <button
                  onClick={() => {
                    setShowExitDialog(false);
                    clearPausedWorkout();
                    setPlayerState('completed');
                  }}
                  className="w-full py-3.5 rounded-xl bg-red-500/90 text-white font-semibold hover:bg-red-500 transition-colors"
                >
                  Ukončit trénink
                </button>
                <button
                  onClick={() => setShowExitDialog(false)}
                  className="w-full py-3.5 rounded-xl text-white/50 font-medium hover:text-white/70 transition-colors"
                >
                  Pokračovat
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Exercise info drawer */}
      <Drawer open={infoDrawerOpen} onOpenChange={setInfoDrawerOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>{exerciseDetail?.name || 'Detail cviku'}</DrawerTitle>
          </DrawerHeader>
          {exerciseDetail && (
            <div className="px-4 pb-6 overflow-y-auto">
              {exerciseDetail.video_path ? (
                <div className="rounded-2xl overflow-hidden bg-black mb-4 aspect-video">
                  {infoVideoError ? (
                    <div className="w-full h-full flex items-center justify-center text-white/50 text-sm">Video nedostupné</div>
                  ) : (
                    <video
                      key={exerciseDetail.video_path}
                      src={exerciseDetail.video_path}
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
                {categoryLabels[exerciseDetail.category] || exerciseDetail.category}
                {exerciseDetail.equipment_type && ` · ${equipmentLabels[exerciseDetail.equipment_type] || exerciseDetail.equipment_type}`}
                {exerciseDetail.machine_name && ` · ${exerciseDetail.machine_name}`}
              </p>

              <button
                onClick={() => {
                  setInfoDrawerOpen(false);
                  setTimeout(() => setFeedbackOpen(true), 300);
                }}
                className="flex items-center gap-2 w-full px-4 py-3 mb-4 rounded-xl border border-border bg-muted/50 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <MessageSquarePlus className="w-4 h-4 text-[#5BC8F5]" />
                Zpětná vazba k tomuto cviku
              </button>

              {exerciseDetail.primary_muscles.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Primární svaly</p>
                  <div className="flex flex-wrap gap-1.5">
                    {exerciseDetail.primary_muscles.map((m) => (
                      <span key={m} className="text-xs bg-[#5BC8F5]/15 text-[#5BC8F5] px-2.5 py-1 rounded-full font-medium">{m}</span>
                    ))}
                  </div>
                </div>
              )}
              {exerciseDetail.secondary_muscles.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Sekundární svaly</p>
                  <div className="flex flex-wrap gap-1.5">
                    {exerciseDetail.secondary_muscles.map((m) => (
                      <span key={m} className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full">{m}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {/* Feedback modal */}
      <FeedbackModal
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        exercises={currentExercise ? [{ id: currentExercise.exercise_id, name: currentExercise.exercise_name }] : []}
        workoutContext={{
          plan_id: id,
          exercise_id: currentExercise?.exercise_id,
        }}
      />
    </div>
  );
};

export default CustomWorkoutPlayer;
