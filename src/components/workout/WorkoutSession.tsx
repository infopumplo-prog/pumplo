import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { X, Trophy, Clock, Dumbbell, Weight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExercisePlayer } from './ExercisePlayer';
import { RestTimer } from './RestTimer';
import { WorkoutExitDialog } from './WorkoutExitDialog';
import { WorkoutShareCard } from './WorkoutShareCard';
import { WorkoutExercise, TrainingGoalId } from '@/lib/trainingGoals';
import { supabase } from '@/integrations/supabase/client';
import { useWorkoutHistory } from '@/hooks/useWorkoutHistory';
import { ExerciseSkipDialog } from './ExerciseSkipDialog';
import { CARDIO_ROLE_IDS } from '@/lib/bmiUtils';
import { CompactWorkoutView } from './CompactWorkoutView';
import { toast } from 'sonner';

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

/**
 * Extract relative file path from video_path which may be a full URL or relative path.
 * DB stores full URLs like: https://xxx.supabase.co/storage/v1/object/public/exercise-videos/file.mp4
 * But createSignedUrl() needs just: file.mp4
 */
const extractVideoFilePath = (videoPath: string): string => {
  const bucketMarker = '/exercise-videos/';
  const idx = videoPath.indexOf(bucketMarker);
  if (idx !== -1) {
    return videoPath.substring(idx + bucketMarker.length);
  }
  return videoPath;
};

const getSignedVideoUrl = async (videoPath: string | null): Promise<string | null> => {
  if (!videoPath) return null;

  const filePath = extractVideoFilePath(videoPath);
  const { data, error } = await supabase.storage
    .from('exercise-videos')
    .createSignedUrl(filePath, 3600);

  if (error) {
    console.error('Error getting signed video URL:', error);
    return null;
  }

  return data?.signedUrl || null;
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
}: WorkoutSessionProps) => {
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
  const [workoutStartTime] = useState(new Date());
  const [showSkipDialog, setShowSkipDialog] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [gymName, setGymName] = useState<string>('');
  const [isSwapping, setIsSwapping] = useState(false);
  const [viewMode, setViewMode] = useState<'video' | 'list'>('video');
  // Mutable exercises array for live swap
  const [liveExercises, setLiveExercises] = useState<WorkoutExercise[]>(exercises);
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
      .select('name')
      .eq('id', gymId)
      .single()
      .then(({ data }) => {
        if (data?.name) setGymName(data.name);
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
        .select('id, name, primary_role, machine_id, equipment_type, primary_muscles, secondary_muscles, category');

      if (isCardio) {
        query = query.eq('category', 'cardio');
      } else {
        query = query.eq('primary_role', roleId);
      }

      const { data: candidates, error } = await query;
      if (error || !candidates || candidates.length === 0) {
        toast.error('Žádná náhrada nenalezena');
        return;
      }

      // Filter: exclude current exercises, must be available at gym (machine check)
      const valid = candidates.filter(c => {
        if (excludeIds.includes(c.id)) return false;
        if (c.machine_id && !machineIds.has(c.machine_id)) return false;
        return true;
      });

      if (valid.length === 0) {
        toast.error('Žádná náhrada nenalezena');
        return;
      }

      // Pick random from all valid candidates
      const pick = valid[Math.floor(Math.random() * valid.length)];

      // Fetch machine name if applicable
      let newMachineName: string | null = null;
      if (pick.machine_id) {
        const { data: machine } = await supabase
          .from('machines')
          .select('name')
          .eq('id', pick.machine_id)
          .single();
        newMachineName = machine?.name || null;
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
          machineName: newMachineName,
          isFallback: true,
          fallbackReason: 'user_swap',
        };
        return updated;
      });

      toast.success(`Vyměněno za: ${pick.name}`);
    } catch (err) {
      console.error('[Swap] Error:', err);
      toast.error('Chyba při výměně cviku');
    } finally {
      setIsSwapping(false);
    }
  }, [currentExerciseIndex, liveExercises, gymId, planId, dayLetter, isSwapping]);

  // Track current set state for pause functionality
  const [currentSetIndex, setCurrentSetIndex] = useState(initialSetIndex);
  const [currentExerciseSets, setCurrentExerciseSets] = useState<SetData[]>(
    initialCurrentExerciseSets || []
  );

  const currentExercise = liveExercises[currentExerciseIndex];

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
      setRestLabel('Příprava na další cvik');
      setShowRestTimer(true);
      setHighestIndexReached(prev => Math.max(prev, currentExerciseIndex + 1));
    } else {
      // Workout complete
      setShowSummary(true);
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
      setShowSummary(true);
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

  const handleFinishWorkout = useCallback(async () => {
    const orderedResults = Array.from({ length: liveExercises.length }, (_, i) => resultsByIndex.get(i))
      .filter((r): r is ExerciseResult => r !== undefined);

    // Save workout to history
    await saveWorkoutSession({
      planId,
      gymId,
      dayLetter,
      goalId,
      startedAt: workoutStartTime,
      results: orderedResults,
      isBonus
    });

    onComplete(orderedResults);
    navigate('/');
  }, [onComplete, resultsByIndex, liveExercises.length, saveWorkoutSession, planId, gymId, dayLetter, goalId, workoutStartTime, isBonus, navigate]);

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
            setShowSummary(true);
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

  // Summary / Share screen
  if (showSummary) {
    return (
      <WorkoutShareCard
        dayLetter={dayLetter}
        goalId={goalId}
        gymName={gymName}
        totalDuration={totalDuration}
        totalSets={totalSets}
        totalWeight={totalWeight}
        totalReps={totalReps}
        exerciseCount={results.length}
        isBonus={isBonus}
        onClose={() => setShowSummary(false)}
        onFinish={handleFinishWorkout}
        isSaving={isSaving}
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
          exerciseName={currentExercise.exerciseName || 'Cvik'}
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
      />

      {/* Skip Dialog */}
      <ExerciseSkipDialog
        open={showSkipDialog}
        onOpenChange={setShowSkipDialog}
        exerciseId={currentExercise.exerciseId}
        exerciseName={currentExercise.exerciseName || 'Cvik'}
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
}) => {
  const [videoData, setVideoData] = useState<{
    url: string | null;
    description: string | null;
    setupInstructions: string | null;
    commonMistakes: string | null;
    tips: string | null;
    difficulty: number | null;
    exerciseWithWeights: boolean;
    category: string;
    equipmentType: string | null;
    primaryMuscles: string[];
    secondaryMuscles: string[];
  }>({ url: null, description: null, setupInstructions: null, commonMistakes: null, tips: null, difficulty: null, exerciseWithWeights: true, category: '', equipmentType: null, primaryMuscles: [], secondaryMuscles: [] });
  const [lastWeight, setLastWeight] = useState<number | undefined>(undefined);

  // Fetch video path + detail from exercise on mount
  useEffect(() => {
    const fetchVideoData = async () => {
      if (!exercise.exerciseId) return;

      const { data } = await supabase
        .from('exercises')
        .select('video_path, difficulty, exercise_with_weights, category, equipment_type, primary_muscles, secondary_muscles, description, setup_instructions, common_mistakes, tips')
        .eq('id', exercise.exerciseId)
        .single();

      if (data) {
        setVideoData({
          url: data.video_path || null,
          description: (data as any).description || null,
          setupInstructions: (data as any).setup_instructions || null,
          commonMistakes: (data as any).common_mistakes || null,
          tips: (data as any).tips || null,
          difficulty: data.difficulty,
          exerciseWithWeights: data.exercise_with_weights ?? true,
          category: data.category || '',
          equipmentType: data.equipment_type || null,
          primaryMuscles: data.primary_muscles || [],
          secondaryMuscles: data.secondary_muscles || [],
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
      exerciseName={exercise.exerciseName || 'Cvik'}
      exerciseDescription={videoData.description || undefined}
      setupInstructions={videoData.setupInstructions || undefined}
      commonMistakes={videoData.commonMistakes || undefined}
      tips={videoData.tips || undefined}
      rirMin={exercise.rirMin}
      rirMax={exercise.rirMax}
      videoUrl={videoData.url}
      roleId={exercise.roleId}
      equipment={exercise.equipment || []}
      machineName={exercise.machineName}
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
      restBetweenSets={restBetweenSets}
      lastWeight={lastWeight}
      initialSetIndex={initialSetIndex}
      initialSetsData={initialSetsData}
      onSetChange={onSetChange}
    />
  );
};
