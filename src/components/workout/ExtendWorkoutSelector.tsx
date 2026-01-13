import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Minus, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ExtendWorkoutSelectorProps {
  onConfirm: (count: number) => void;
  isLoading?: boolean;
  title?: string;
  description?: string;
  buttonText?: string;
  showCard?: boolean;
}

export const ExtendWorkoutSelector = ({ 
  onConfirm, 
  isLoading,
  title,
  description,
  buttonText,
  showCard = false
}: ExtendWorkoutSelectorProps) => {
  const [count, setCount] = useState(2);

  const minCount = 1;
  const maxCount = 6;

  const handleIncrement = () => {
    if (count < maxCount) setCount(count + 1);
  };

  const handleDecrement = () => {
    if (count > minCount) setCount(count - 1);
  };

  const getExerciseWord = (n: number) => {
    if (n === 1) return 'cvik';
    if (n < 5) return 'cviky';
    return 'cvikov';
  };

  const content = (
    <>
      {(title || description) && (
        <div className="mb-4">
          {title && <h3 className="font-bold text-lg">{title}</h3>}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      )}

      {/* Counter */}
      <div className="flex items-center justify-center gap-4 mb-4">
        <Button
          variant="outline"
          size="icon"
          onClick={handleDecrement}
          disabled={count <= minCount || isLoading}
          className="w-10 h-10 rounded-full"
        >
          <Minus className="w-4 h-4" />
        </Button>

        <div className="w-16 text-center">
          <span className="text-3xl font-bold text-primary">{count}</span>
          <p className="text-xs text-muted-foreground mt-0.5">
            {getExerciseWord(count)}
          </p>
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={handleIncrement}
          disabled={count >= maxCount || isLoading}
          className="w-10 h-10 rounded-full"
        >
          <Plus className="w-4 h-4" />
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
            {buttonText || `Pridať ${count} ${getExerciseWord(count)}`}
            <ChevronRight className="w-4 h-4" />
          </>
        )}
      </Button>
    </>
  );

  if (showCard) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="p-4 rounded-xl bg-gradient-to-br from-primary/10 via-background to-primary/5 border border-primary/20"
      >
        {content}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {content}
    </motion.div>
  );
};