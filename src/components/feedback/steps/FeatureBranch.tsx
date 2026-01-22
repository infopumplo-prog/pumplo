import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';
import type { FeedbackStepProps, FeaturePriority } from '../types';

const priorityOptions: { id: FeaturePriority; label: string; description: string }[] = [
  { id: 'nice_to_have', label: 'Bylo by fajn', description: 'Není to urgentní' },
  { id: 'important', label: 'Důležité', description: 'Dost mi to chybí' },
  { id: 'must_have', label: 'Nutnost', description: 'Bez toho to nejde' },
];

export const FeatureBranch = ({ data, onUpdate, onNext, onBack }: FeedbackStepProps) => {
  const responses = (data.responses || {}) as Record<string, unknown>;

  const updateResponses = (updates: Record<string, unknown>) => {
    onUpdate({ responses: { ...responses, ...updates } });
  };

  const canContinue = () => {
    return !!(responses.feature_request as string)?.trim();
  };

  const handleNext = () => {
    const priority = priorityOptions.find(p => p.id === responses.feature_priority)?.label || '';
    const message = `${responses.feature_request}${priority ? ` [${priority}]` : ''}`;
    onUpdate({ message });
    onNext();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1 hover:bg-muted rounded">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-semibold">Chybějící funkce</h3>
      </div>

      <div>
        <Label>Co ti v Pumplu chybí? *</Label>
        <Textarea
          value={(responses.feature_request as string) || ''}
          onChange={(e) => updateResponses({ feature_request: e.target.value })}
          placeholder="Popiš, co bys chtěl/a mít v aplikaci"
          className="mt-2"
          rows={3}
        />
      </div>

      <div>
        <Label>Jak bys to chtěl/a mít ideálně? (volitelné)</Label>
        <Textarea
          value={(responses.feature_ideal as string) || ''}
          onChange={(e) => updateResponses({ feature_ideal: e.target.value })}
          placeholder="Popiš svou ideální představu"
          className="mt-2"
          rows={2}
        />
      </div>

      <div>
        <Label>Jak moc je to důležité?</Label>
        <div className="space-y-2 mt-2">
          {priorityOptions.map((priority) => (
            <button
              key={priority.id}
              onClick={() => updateResponses({ feature_priority: priority.id })}
              className={cn(
                'w-full flex flex-col items-start p-3 rounded-lg border transition-all text-left',
                responses.feature_priority === priority.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              )}
            >
              <span className={cn(
                'font-medium text-sm',
                responses.feature_priority === priority.id ? 'text-primary' : ''
              )}>
                {priority.label}
              </span>
              <span className="text-xs text-muted-foreground">{priority.description}</span>
            </button>
          ))}
        </div>
      </div>

      <Button 
        onClick={handleNext} 
        disabled={!canContinue()}
        className="w-full"
      >
        Pokračovat
      </Button>
    </div>
  );
};
