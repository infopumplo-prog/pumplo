import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { X, Trophy, Clock, Dumbbell, Weight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExercisePlayer } from './ExercisePlayer';
import { RestTimer } from './RestTimer';
import { WorkoutExitDialog } from './WorkoutExitDialog';
import { WorkoutExercise, TrainingGoalId } from '@/lib/trainingGoals';
import { supabase } from '@/integrations/supabase/client';
import { useWorkoutHistory } from '@/hooks/useWorkoutHistory';
import { ExerciseSkipDialog } from './ExerciseSkipDialog';

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

// Rest times in seconds based on goal and situation
const REST_TIMES = {
  muscle_gain: { betweenSets: 90, betweenExercises: 180 },
  fat_loss: { betweenSets: 45, betweenExercises: 90 },
  strength: { betweenSets: 180, betweenExercises: 240 },
  general_fitness: { betweenSets: 60, betweenExercises: 120 },
};

const getSignedVideoUrl = async (videoPath: string | null): Promise<string | null> => {
  if (!videoPath) return null;
  
  const { data, error } = await supabase.storage
    .from('exercise-videos')
    .createSignedUrl(videoPath, 3600); // 1 hour expiry
  
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
  const [results, setResults] = useState<ExerciseResult[]>(initialResults);
  const [showSummary, setShowSummary] = useState(false);
  const [workoutStartTime] = useState(new Date());
  const [showSkipDialog, setShowSkipDialog] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const { saveWorkoutSession, isSaving } = useWorkoutHistory();
  
  // Track current set state for pause functionality
  const [currentSetIndex, setCurrentSetIndex] = useState(initialSetIndex);
  const [currentExerciseSets, setCurrentExerciseSets] = useState<SetData[]>(
    initialCurrentExerciseSets || []
  );

  const currentExercise = exercises[currentExerciseIndex];
  const restTimes = REST_TIMES[goalId] || REST_TIMES.general_fitness;

  // Note: weight tracking is now determined by exercise_with_weights field from DB

  const handleCompleteExercise = useCallback((setsData: SetData[]) => {
    const newResult: ExerciseResult = {
      exerciseId: currentExercise.exerciseId || '',
      exerciseName: currentExercise.exerciseName || '',
      sets: setsData
    };
    
    setResults(prev => [...prev, newResult]);

    if (currentExerciseIndex < exercises.length - 1) {
      // Show rest timer before next exercise
      setRestDuration(restTimes.betweenExercises);
      setRestLabel('Příprava na další cvik');
      setShowRestTimer(true);
    } else {
      // Workout complete
      setShowSummary(true);
    }
  }, [currentExercise, currentExerciseIndex, exercises.length, restTimes.betweenExercises]);

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
    setResults(prev => [...prev, newResult]);

    if (currentExerciseIndex < exercises.length - 1) {
      setCurrentExerciseIndex(prev => prev + 1);
    } else {
      setShowSummary(true);
    }
  }, [currentExercise, currentExerciseIndex, exercises.length]);

  const handleFinishWorkout = useCallback(async () => {
    // Save workout to history
    await saveWorkoutSession({
      planId,
      gymId,
      dayLetter,
      goalId,
      startedAt: workoutStartTime,
      results,
      isBonus
    });
    
    onComplete(results);
  }, [onComplete, results, saveWorkoutSession, planId, gymId, dayLetter, goalId, workoutStartTime, isBonus]);

  // Calculate workout stats
  const totalDuration = Math.floor((Date.now() - workoutStartTime.getTime()) / 1000 / 60);
  const totalSets = results.reduce((sum, r) => sum + r.sets.filter(s => s.completed).length, 0);
  const totalWeight = results.reduce((sum, r) => 
    sum + r.sets.reduce((setSum, s) => setSum + ((s.weight || 0) * (s.reps || 0)), 0), 0
  );

  // Summary screen
  if (showSummary) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-6 pb-32"
      >
        <motion.div
          initial={{ scale: 0.8, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center w-full max-w-sm"
        >
          <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Trophy className="w-12 h-12 text-primary" />
          </div>
          
          <h1 className="text-3xl font-bold mb-2">Skvělá práce!</h1>
          <p className="text-muted-foreground mb-8">
            {isBonus ? 'Bonusový trénink' : `Den ${dayLetter.replace('_EXT', '+')}`} dokončen
          </p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-muted rounded-xl p-4">
              <Clock className="w-6 h-6 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold">{totalDuration}</p>
              <p className="text-xs text-muted-foreground">minut</p>
            </div>
            <div className="bg-muted rounded-xl p-4">
              <Dumbbell className="w-6 h-6 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold">{totalSets}</p>
              <p className="text-xs text-muted-foreground">sérií</p>
            </div>
            <div className="bg-muted rounded-xl p-4">
              <Weight className="w-6 h-6 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold">{Math.round(totalWeight / 1000)}</p>
              <p className="text-xs text-muted-foreground">tun</p>
            </div>
          </div>

          {/* Exercise breakdown */}
          <div className="w-full mb-6">
            <p className="text-sm text-muted-foreground mb-3 text-left">Přehled cviků:</p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {results.map((result, i) => (
                <div key={i} className="flex items-center justify-between text-sm bg-muted/50 rounded-lg px-3 py-2">
                  <span className="truncate flex-1 text-left">{result.exerciseName}</span>
                  <span className="text-muted-foreground ml-2">
                    {result.sets.filter(s => s.completed).length} sérií
                  </span>
                </div>
              ))}
            </div>
          </div>

          <Button 
            size="lg" 
            className="w-full" 
            onClick={handleFinishWorkout}
            disabled={isSaving}
          >
            {isSaving ? 'Ukládám...' : 'Dokončit trénink'}
          </Button>
        </motion.div>
      </motion.div>
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

  return (
    <div className="fixed inset-0 z-50">
      {/* Cancel button - positioned for card layout */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-3 left-4 z-[60] text-foreground hover:bg-muted"
        onClick={() => setShowExitDialog(true)}
      >
        <X className="w-5 h-5" />
      </Button>

      <ExercisePlayerWithVideo
        exercise={currentExercise}
        exerciseIndex={currentExerciseIndex}
        totalExercises={exercises.length}
        onCompleteExercise={handleCompleteExercise}
        onSkipExercise={handleSkipClick}
        showWeightInput={true}
        restBetweenSets={restTimes.betweenSets}
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
    difficulty: number | null;
    exerciseWithWeights: boolean;
  }>({ url: null, description: null, difficulty: null, exerciseWithWeights: true });

  // Fetch video path from exercise on mount
  useEffect(() => {
    const fetchVideoData = async () => {
      if (!exercise.exerciseId) return;
      
      const { data } = await supabase
        .from('exercises')
        .select('video_path, difficulty, exercise_with_weights')
        .eq('id', exercise.exerciseId)
        .single();
      
      if (data) {
        let url = null;
        if (data.video_path) {
          // Use signed URL for private bucket
          const { data: signedData, error } = await supabase.storage
            .from('exercise-videos')
            .createSignedUrl(data.video_path, 3600); // 1 hour expiry
          
          if (!error && signedData) {
            url = signedData.signedUrl;
          }
        }
        
        setVideoData({ 
          url,
          description: null, // description column was removed
          difficulty: data.difficulty,
          exerciseWithWeights: data.exercise_with_weights ?? true
        });
      }
    };
    fetchVideoData();
  }, [exercise.exerciseId]);

  return (
    <ExercisePlayer
      exerciseName={exercise.exerciseName || 'Cvik'}
      exerciseDescription={videoData.description || undefined}
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
      showWeightInput={videoData.exerciseWithWeights}
      restBetweenSets={restBetweenSets}
      initialSetIndex={initialSetIndex}
      initialSetsData={initialSetsData}
      onSetChange={onSetChange}
    />
  );
};
