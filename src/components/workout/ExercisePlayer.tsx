import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, ChevronDown, Info, SkipForward, Check, Dumbbell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SetTracker } from './SetTracker';
import { RestTimer } from './RestTimer';
import { TRAINING_ROLE_NAMES } from '@/lib/trainingRoles';
import { cn } from '@/lib/utils';

interface SetData {
  completed: boolean;
  weight?: number;
  reps?: number;
}

interface ExercisePlayerProps {
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
  showWeightInput?: boolean;
  restBetweenSets?: number;
}

export const ExercisePlayer = ({
  exerciseName,
  exerciseDescription,
  videoUrl,
  roleId,
  equipment,
  machineName,
  difficulty,
  totalSets,
  repMin,
  repMax,
  exerciseIndex,
  totalExercises,
  onCompleteExercise,
  onSkipExercise,
  showWeightInput = true,
  restBetweenSets = 90
}: ExercisePlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentSet, setCurrentSet] = useState(0);
  const [setsData, setSetsData] = useState<SetData[]>(
    Array.from({ length: totalSets }, () => ({ completed: false }))
  );
  const [showDescription, setShowDescription] = useState(false);
  const [showFullName, setShowFullName] = useState(false);
  const [showRestTimer, setShowRestTimer] = useState(false);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = true;
      if (isPlaying && !showRestTimer) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, showRestTimer]);

  const handleCompleteSet = (setIndex: number, weight?: number, reps?: number) => {
    const newSetsData = [...setsData];
    newSetsData[setIndex] = { completed: true, weight, reps };
    setSetsData(newSetsData);
    
    if (setIndex + 1 >= totalSets) {
      onCompleteExercise(newSetsData);
    } else {
      setShowRestTimer(true);
    }
  };

  const handleRestComplete = () => {
    setShowRestTimer(false);
    setCurrentSet(prev => prev + 1);
  };

  const togglePlay = () => {
    setIsPlaying(prev => !prev);
  };

  const equipmentDisplay = machineName || equipment.map(eq => {
    const eqNames: Record<string, string> = {
      'barbell': 'Veľká činka',
      'dumbbell': 'Jednoručky',
      'kettlebell': 'Kettlebell',
      'cable': 'Kladka',
      'machine': 'Stroj',
      'bodyweight': 'Vlastná váha',
      'free_weights': 'Voľné váhy',
      'plate_loaded': 'Kotúčový stroj',
      'resistance_band': 'Guma',
      'exercise_ball': 'Fitlopta',
      'trx': 'TRX',
      'ez_bar': 'EZ činka',
      'smith_machine': 'Smithov stroj',
      'pull_up_bar': 'Hrazda',
      'bench': 'Lavička',
      'foam_roller': 'Valec',
      'medicine_ball': 'Medicinbal'
    };
    return eqNames[eq] || eq.replace(/_/g, ' ');
  }).join(', ');

  const completedSets = setsData.filter(s => s.completed).length;

  if (showRestTimer) {
    return (
      <RestTimer
        duration={restBetweenSets}
        onComplete={handleRestComplete}
        label={`Odpočinek před ${currentSet + 2}. sérií`}
      />
    );
  }

  // Get difficulty color based on value (1-10 scale)
  const getDifficultyColor = (diff?: number) => {
    if (!diff) return 'bg-muted text-muted-foreground';
    if (diff <= 3) return 'bg-green-500/10 text-green-600';
    if (diff <= 6) return 'bg-yellow-500/10 text-yellow-600';
    return 'bg-red-500/10 text-red-600';
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-y-auto">
      {/* Header - with left padding for X button */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border pl-14 pr-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-primary/10 text-primary font-semibold">
              {exerciseIndex + 1} / {totalExercises}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Série {completedSets}/{totalSets}
            </span>
          </div>
          {onSkipExercise && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={onSkipExercise}
            >
              <SkipForward className="w-4 h-4 mr-1" />
              Přeskočit
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 pb-32 space-y-4">
        {/* Video Card */}
        <Card className="overflow-hidden shadow-card">
          <div className="relative aspect-video bg-muted" onClick={togglePlay}>
            {videoUrl ? (
              <>
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="w-full h-full object-cover"
                  loop
                  muted
                  autoPlay
                  playsInline
                />
                {/* Play/pause overlay */}
                <AnimatePresence>
                  {!isPlaying && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="absolute inset-0 flex items-center justify-center bg-black/30"
                    >
                      <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
                        <Play className="w-8 h-8 text-foreground ml-1" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Dumbbell className="w-12 h-12 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Video není dostupné</p>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Exercise Info Card */}
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h2 
                  className={cn(
                    "text-xl font-bold text-foreground cursor-pointer",
                    !showFullName && "truncate"
                  )}
                  onClick={() => setShowFullName(!showFullName)}
                >
                  {exerciseName}
                </h2>
                {machineName && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Stroj: {machineName}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    {TRAINING_ROLE_NAMES[roleId as keyof typeof TRAINING_ROLE_NAMES] || roleId}
                  </Badge>
                  {equipmentDisplay && (
                    <Badge variant="secondary" className="text-xs">
                      {equipmentDisplay}
                    </Badge>
                  )}
                  {difficulty && (
                    <Badge className={cn("text-xs", getDifficultyColor(difficulty))}>
                      Obtížnost: {difficulty}/10
                    </Badge>
                  )}
                </div>
              </div>
              <Badge className="bg-primary text-primary-foreground shrink-0">
                {repMin}-{repMax} opak.
              </Badge>
            </div>

            {/* Description toggle */}
            {exerciseDescription && (
              <div className="mt-4">
                <button
                  onClick={() => setShowDescription(!showDescription)}
                  className="flex items-center gap-2 text-sm text-primary font-medium w-full"
                >
                  <Info className="w-4 h-4" />
                  <span>Instrukce</span>
                  <ChevronDown className={cn(
                    "w-4 h-4 ml-auto transition-transform",
                    showDescription && "rotate-180"
                  )} />
                </button>
                <AnimatePresence>
                  {showDescription && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <p className="text-sm text-muted-foreground mt-3 bg-muted/50 rounded-lg p-3">
                        {exerciseDescription}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Set Tracker Card */}
        <Card className="shadow-card">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
              <Dumbbell className="w-4 h-4" />
              Sledování sérií
            </h3>
            <SetTracker
              totalSets={totalSets}
              repMin={repMin}
              repMax={repMax}
              currentSet={currentSet}
              setsData={setsData}
              onCompleteSet={handleCompleteSet}
              showWeightInput={showWeightInput}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
