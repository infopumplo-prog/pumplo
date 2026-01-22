import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';
import type { FeedbackStepProps, ConfusionType, HelpType } from '../types';

const confusionTypes: { id: ConfusionType; label: string }[] = [
  { id: 'why_this_workout', label: 'Proč mám tento trénink' },
  { id: 'why_these_exercises', label: 'Proč tyto cviky' },
  { id: 'how_to_do_workout', label: 'Jak trénink správně odcvičit' },
  { id: 'how_plan_split_works', label: 'Jak funguje plán / split' },
  { id: 'other_confusion', label: 'Něco jiného' },
];

const helpTypes: { id: HelpType; label: string }[] = [
  { id: 'explanation', label: 'Vysvětlení textem' },
  { id: 'video', label: 'Video' },
  { id: 'tooltip', label: 'Tooltip / nápověda' },
  { id: 'example', label: 'Ukázka/příklad' },
  { id: 'other_help', label: 'Něco jiného' },
];

export const ConfusionBranch = ({ data, onUpdate, onNext, onBack }: FeedbackStepProps) => {
  const responses = (data.responses || {}) as Record<string, unknown>;

  const updateResponses = (updates: Record<string, unknown>) => {
    onUpdate({ responses: { ...responses, ...updates } });
  };

  const toggleHelpType = (type: HelpType) => {
    const current = (responses.help_types as string[]) || [];
    const updated = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type];
    updateResponses({ help_types: updated });
  };

  const canContinue = () => {
    return !!responses.confusion_type;
  };

  const handleNext = () => {
    const confusionLabel = confusionTypes.find(c => c.id === responses.confusion_type)?.label;
    const helpLabels = ((responses.help_types as string[]) || [])
      .map(t => helpTypes.find(h => h.id === t)?.label)
      .filter(Boolean)
      .join(', ');
    
    let message = `Nerozuměl/a jsem: ${confusionLabel}`;
    if (helpLabels) {
      message += ` | Pomohlo by: ${helpLabels}`;
    }
    if (responses.confusion_detail) {
      message += ` | Detail: ${responses.confusion_detail}`;
    }
    
    onUpdate({ message });
    onNext();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1 hover:bg-muted rounded">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-semibold">Co bylo matoucí?</h3>
      </div>

      <div>
        <Label>Čemu jsi nerozuměl/a? *</Label>
        <div className="space-y-2 mt-2">
          {confusionTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => updateResponses({ confusion_type: type.id })}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left text-sm',
                responses.confusion_type === type.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              )}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>Co by ti pomohlo? (více možností)</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {helpTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => toggleHelpType(type.id)}
              className={cn(
                'p-3 rounded-lg border transition-all text-sm',
                ((responses.help_types as string[]) || []).includes(type.id)
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              )}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>Popiš co přesně bylo matoucí (volitelné)</Label>
        <Textarea
          value={(responses.confusion_detail as string) || ''}
          onChange={(e) => updateResponses({ confusion_detail: e.target.value })}
          placeholder="Detailnější popis"
          className="mt-2"
        />
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
