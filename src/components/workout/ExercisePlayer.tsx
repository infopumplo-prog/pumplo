import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Volume2, VolumeX, ChevronUp, Info, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';
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
  totalSets: number;
  repMin: number;
  repMax: number;
  exerciseIndex: number;
  totalExercises: number;
  onCompleteExercise: (setsData: SetData[]) => void;
  onSkipExercise?: () => void;
  showWeightInput?: boolean;
  restBetweenSets?: number; // seconds
}

export const ExercisePlayer = ({
  exerciseName,
  exerciseDescription,
  videoUrl,
  roleId,
  equipment,
  machineName,
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
  const [isMuted, setIsMuted] = useState(true);
  const [currentSet, setCurrentSet] = useState(0);
  const [setsData, setSetsData] = useState<SetData[]>(
    Array.from({ length: totalSets }, () => ({ completed: false }))
  );
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [showRestTimer, setShowRestTimer] = useState(false);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
      if (isPlaying && !showRestTimer) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, isMuted, showRestTimer]);

  const handleCompleteSet = (setIndex: number, weight?: number, reps?: number) => {
    const newSetsData = [...setsData];
    newSetsData[setIndex] = { completed: true, weight, reps };
    setSetsData(newSetsData);
    
    if (setIndex + 1 >= totalSets) {
      // All sets completed
      onCompleteExercise(newSetsData);
    } else {
      // Show rest timer before next set
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

  const toggleMute = () => {
    setIsMuted(prev => !prev);
  };

  const equipmentDisplay = machineName || equipment.map(eq => {
    const eqNames: Record<string, string> = {
      'barbell': 'Velká činka',
      'dumbbell': 'Jednoručky',
      'kettlebell': 'Kettlebell',
      'cable': 'Kabel',
      'machine': 'Stroj',
      'bodyweight': 'Vlastní váha',
      'free_weights': 'Volné váhy',
      'plate_loaded': 'Kotouče'
    };
    return eqNames[eq] || eq;
  }).join(', ');

  // Rest timer overlay
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
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Video container */}
      <div className="relative flex-1 bg-black">
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-contain"
            loop
            muted={isMuted}
            autoPlay
            playsInline
            onClick={togglePlay}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <div className="text-center text-muted-foreground">
              <Info className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Video není dostupné</p>
            </div>
          </div>
        )}

        {/* Video controls overlay */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-white/20 text-white">
                {exerciseIndex + 1} / {totalExercises}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={toggleMute}
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </Button>
              {onSkipExercise && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={onSkipExercise}
                >
                  <SkipForward className="w-5 h-5" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Play/pause indicator */}
        <AnimatePresence>
          {!isPlaying && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <div className="w-20 h-20 bg-black/50 rounded-full flex items-center justify-center">
                <Play className="w-10 h-10 text-white ml-1" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom drawer with exercise info */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerTrigger asChild>
          <button 
            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-transparent pt-12 pb-6 flex flex-col items-center"
          >
            <ChevronUp className={cn(
              "w-6 h-6 text-muted-foreground transition-transform",
              drawerOpen && "rotate-180"
            )} />
            <h2 className="text-xl font-bold text-foreground mt-1">{exerciseName}</h2>
            {equipmentDisplay && (
              <p className="text-sm text-muted-foreground">{equipmentDisplay}</p>
            )}
          </button>
        </DrawerTrigger>
        
        <DrawerContent className="max-h-[75vh]">
          <div className="p-4 pb-8 space-y-6 overflow-y-auto">
            {/* Exercise header */}
            <div className="text-center pt-2">
              <h2 className="text-xl font-bold">{exerciseName}</h2>
              <div className="flex items-center justify-center gap-2 mt-2">
                <Badge variant="outline">
                  {TRAINING_ROLE_NAMES[roleId as keyof typeof TRAINING_ROLE_NAMES] || roleId}
                </Badge>
                {equipmentDisplay && (
                  <Badge variant="secondary">{equipmentDisplay}</Badge>
                )}
              </div>
            </div>

            {/* Description */}
            {exerciseDescription && (
              <div className="bg-muted/50 rounded-lg p-4">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Instrukce
                </h3>
                <p className="text-sm text-muted-foreground">{exerciseDescription}</p>
              </div>
            )}

            {/* Set tracker */}
            <SetTracker
              totalSets={totalSets}
              repMin={repMin}
              repMax={repMax}
              currentSet={currentSet}
              setsData={setsData}
              onCompleteSet={handleCompleteSet}
              showWeightInput={showWeightInput}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};
