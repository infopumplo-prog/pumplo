import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Circle, Weight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface SetData {
  completed: boolean;
  weight?: number;
  reps?: number;
}

interface SetTrackerProps {
  totalSets: number;
  repMin: number;
  repMax: number;
  currentSet: number;
  setsData: SetData[];
  onCompleteSet: (setIndex: number, weight?: number, reps?: number) => void;
  showWeightInput?: boolean;
}

export const SetTracker = ({
  totalSets,
  repMin,
  repMax,
  currentSet,
  setsData,
  onCompleteSet,
  showWeightInput = true
}: SetTrackerProps) => {
  const [weight, setWeight] = useState<string>('');
  const [reps, setReps] = useState<string>(`${repMax}`);

  const handleCompleteSet = () => {
    const weightNum = weight ? parseFloat(weight) : undefined;
    const repsNum = reps ? parseInt(reps) : repMax;
    onCompleteSet(currentSet, weightNum, repsNum);
    // Reset for next set
    setReps(`${repMax}`);
  };

  return (
    <div className="space-y-4">
      {/* Sets indicator */}
      <div className="flex items-center justify-center gap-2">
        {Array.from({ length: totalSets }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0.8 }}
            animate={{ 
              scale: i === currentSet ? 1.2 : 1,
              opacity: setsData[i]?.completed ? 1 : 0.5
            }}
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
              setsData[i]?.completed
                ? "bg-primary text-primary-foreground"
                : i === currentSet
                  ? "bg-primary/20 border-2 border-primary"
                  : "bg-muted"
            )}
          >
            {setsData[i]?.completed ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <span className="font-semibold">{i + 1}</span>
            )}
          </motion.div>
        ))}
      </div>

      {/* Current set info */}
      <div className="text-center">
        <p className="text-lg font-semibold">
          Série {currentSet + 1} z {totalSets}
        </p>
        <p className="text-muted-foreground">
          {repMin}-{repMax} opakování
        </p>
      </div>

      {/* Weight and reps input */}
      {showWeightInput && currentSet < totalSets && (
        <div className="grid grid-cols-2 gap-3 px-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <Weight className="w-3 h-3" />
              Váha (kg)
            </label>
            <Input
              type="number"
              placeholder="např. 60"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="text-center text-lg font-semibold h-12"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              Opakování
            </label>
            <Input
              type="number"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              className="text-center text-lg font-semibold h-12"
            />
          </div>
        </div>
      )}

      {/* Complete set button */}
      {currentSet < totalSets && (
        <Button
          size="lg"
          className="w-full h-14 text-lg gap-2"
          onClick={handleCompleteSet}
        >
          <CheckCircle2 className="w-6 h-6" />
          Dokončit sérii
        </Button>
      )}

      {/* Previous sets summary */}
      {setsData.some(s => s.completed && s.weight) && (
        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">Předchozí série:</p>
          <div className="flex flex-wrap gap-2">
            {setsData.map((set, i) => 
              set.completed && set.weight ? (
                <span key={i} className="text-xs bg-muted px-2 py-1 rounded">
                  {set.weight}kg × {set.reps || repMax}
                </span>
              ) : null
            )}
          </div>
        </div>
      )}
    </div>
  );
};
