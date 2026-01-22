import { Button } from '@/components/ui/button';
import { Dumbbell, Bug, Lightbulb, HelpCircle, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FeedbackType, FeedbackStepProps } from '../types';

const feedbackTypes: { id: FeedbackType; label: string; icon: React.ElementType }[] = [
  { id: 'training_exercises', label: 'Trénink / cviky', icon: Dumbbell },
  { id: 'bug_error', label: 'Našel/a jsem bug nebo chybu', icon: Bug },
  { id: 'missing_feature', label: 'Něco mi chybí / chtěl/a bych jinak', icon: Lightbulb },
  { id: 'confusion', label: 'Něčemu jsem nerozuměl/a', icon: HelpCircle },
  { id: 'other', label: 'Něco jiného', icon: MessageSquare },
];

export const TypeSelector = ({ data, onUpdate, onNext }: FeedbackStepProps) => {
  const selectedType = data.feedback_type;

  const handleSelect = (type: FeedbackType) => {
    onUpdate({ feedback_type: type, responses: {} });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-center">S čím máš problém?</h3>
      
      <div className="space-y-2">
        {feedbackTypes.map((type) => (
          <button
            key={type.id}
            onClick={() => handleSelect(type.id)}
            className={cn(
              'w-full flex items-center gap-3 p-4 rounded-xl border transition-all text-left',
              selectedType === type.id
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50 hover:bg-muted/50'
            )}
          >
            <type.icon className={cn(
              'w-5 h-5 flex-shrink-0',
              selectedType === type.id ? 'text-primary' : 'text-muted-foreground'
            )} />
            <span className={cn(
              'font-medium',
              selectedType === type.id ? 'text-primary' : ''
            )}>
              {type.label}
            </span>
          </button>
        ))}
      </div>

      <Button 
        onClick={onNext} 
        disabled={!selectedType}
        className="w-full"
      >
        Pokračovat
      </Button>
    </div>
  );
};
