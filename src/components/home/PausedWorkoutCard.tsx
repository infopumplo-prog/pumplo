import { motion } from 'framer-motion';
import { Play, X, Clock, Dumbbell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PausedWorkoutState } from '@/hooks/usePausedWorkout';
import { formatDistanceToNow } from 'date-fns';
import { cs } from 'date-fns/locale';

interface PausedWorkoutCardProps {
  pausedWorkout: PausedWorkoutState;
  onResume: () => void;
  onDiscard: () => void;
}

export const PausedWorkoutCard = ({ pausedWorkout, onResume, onDiscard }: PausedWorkoutCardProps) => {
  const pausedTimeAgo = formatDistanceToNow(new Date(pausedWorkout.pausedAt), { 
    addSuffix: true, 
    locale: cs 
  });
  
  const completedExercises = Object.keys(pausedWorkout.completedSets).length;
  const totalExercises = pausedWorkout.exercises.length;
  const progress = Math.round((completedExercises / totalExercises) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-transparent border-2 border-amber-500/30 p-5"
    >
      <div className="absolute -right-6 -top-6 w-24 h-24 bg-amber-500/20 rounded-full blur-2xl" />
      
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
              <Dumbbell className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">Rozpracovaný trénink</h3>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Pozastaveno {pausedTimeAgo}
              </p>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={onDiscard}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{completedExercises}/{totalExercises} cviků</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-amber-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
            />
          </div>
        </div>
        
        <Button
          onClick={onResume}
          className="w-full gap-2 bg-amber-500 hover:bg-amber-600 text-white"
        >
          <Play className="w-4 h-4" />
          Pokračovat v tréninku
        </Button>
      </div>
    </motion.div>
  );
};
