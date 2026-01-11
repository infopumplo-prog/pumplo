import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Minus, Dumbbell, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface ExtendWorkoutSelectorProps {
  onConfirm: (count: number) => void;
  isLoading?: boolean;
}

export const ExtendWorkoutSelector = ({ onConfirm, isLoading }: ExtendWorkoutSelectorProps) => {
  const [count, setCount] = useState(2);

  const minCount = 1;
  const maxCount = 6;

  const handleIncrement = () => {
    if (count < maxCount) setCount(count + 1);
  };

  const handleDecrement = () => {
    if (count > minCount) setCount(count - 1);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <Card className="p-6 bg-gradient-to-br from-primary/10 via-background to-primary/5 border-primary/20">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
            <Dumbbell className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-lg">Rozšíriť trénink?</h3>
            <p className="text-sm text-muted-foreground">
              Dnešný tréning už máš za sebou!
            </p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Vyber si počet extra cviků, ktoré chceš pridať k dnešnému tréningu.
        </p>

        {/* Counter */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <Button
            variant="outline"
            size="icon"
            onClick={handleDecrement}
            disabled={count <= minCount || isLoading}
            className="w-12 h-12 rounded-full"
          >
            <Minus className="w-5 h-5" />
          </Button>

          <div className="w-20 text-center">
            <span className="text-4xl font-bold text-primary">{count}</span>
            <p className="text-xs text-muted-foreground mt-1">
              {count === 1 ? 'cvik' : count < 5 ? 'cviky' : 'cvikov'}
            </p>
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={handleIncrement}
            disabled={count >= maxCount || isLoading}
            className="w-12 h-12 rounded-full"
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>

        {/* Confirm Button */}
        <Button
          className="w-full gap-2"
          onClick={() => onConfirm(count)}
          disabled={isLoading}
        >
          {isLoading ? (
            'Generujem cviky...'
          ) : (
            <>
              Pridať {count} {count === 1 ? 'cvik' : count < 5 ? 'cviky' : 'cvikov'}
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </Card>
    </motion.div>
  );
};
