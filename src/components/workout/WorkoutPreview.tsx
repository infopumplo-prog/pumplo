import { motion } from 'framer-motion';
import { X, Play, Clock, Dumbbell, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WorkoutExercise } from '@/lib/trainingGoals';
import { cn } from '@/lib/utils';

interface WorkoutPreviewProps {
  exercises: WorkoutExercise[];
  dayLetter: string;
  dayName: string;
  estimatedDuration: number;
  onStartWarmup: () => void;
  onClose: () => void;
  isLoading?: boolean;
}

export const WorkoutPreview = ({
  exercises,
  dayLetter,
  dayName,
  estimatedDuration,
  onStartWarmup,
  onClose,
  isLoading = false
}: WorkoutPreviewProps) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background flex flex-col"
    >
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
        <h2 className="font-bold text-lg">Dnešní trénink</h2>
        <Badge variant="secondary" className="gap-1">
          <Clock className="w-3 h-3" />
          ~{estimatedDuration} min
        </Badge>
      </div>

      {/* Day info */}
      <div className="p-4 bg-gradient-to-br from-primary/10 via-background to-background border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
            <span className="font-bold text-lg text-primary">{dayLetter}</span>
          </div>
          <div>
            <h3 className="font-bold text-lg">{dayName}</h3>
            <p className="text-sm text-muted-foreground">
              {exercises.length} cviků připraveno
            </p>
          </div>
        </div>
      </div>

      {/* Exercise list */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {exercises.map((ex, idx) => (
            <motion.div
              key={ex.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="flex items-center gap-3 py-3 px-4 rounded-xl bg-muted/50 border border-border/50"
            >
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <span className="font-bold text-sm text-primary">{idx + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{ex.exerciseName}</p>
                <p className="text-xs text-muted-foreground">
                  {ex.sets} sérií × {ex.repMin}-{ex.repMax} opak.
                </p>
              </div>
              <Dumbbell className="w-4 h-4 text-muted-foreground shrink-0" />
            </motion.div>
          ))}
        </div>
      </ScrollArea>

      {/* Action button */}
      <div className="p-4 border-t border-border bg-background">
        <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
          <Flame className="w-4 h-4 text-orange-500" />
          <span>Začneme rozcvičkou pro přípravu svalů</span>
        </div>
        <Button 
          size="lg" 
          className="w-full gap-2"
          onClick={onStartWarmup}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Flame className="w-5 h-5" />
              </motion.div>
              Připravuji rozcvičku...
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              Začít rozcvičku
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );
};
