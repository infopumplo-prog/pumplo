import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';
import type { FeedbackStepProps, BugLocation, RepeatedStatus } from '../types';

const bugLocations: { id: BugLocation; label: string }[] = [
  { id: 'generating_workout', label: 'Generování tréninku' },
  { id: 'switching_days', label: 'Přepínání dnů' },
  { id: 'opening_exercise', label: 'Kliknutí na cvik' },
  { id: 'marking_done', label: 'Označení tréninku jako hotový' },
  { id: 'other_place', label: 'Jinde' },
];

const repeatedOptions: { id: RepeatedStatus; label: string }[] = [
  { id: 'yes', label: 'Ano' },
  { id: 'no', label: 'Ne' },
  { id: 'not_sure', label: 'Nevím' },
];

export const BugBranch = ({ data, onUpdate, onNext, onBack }: FeedbackStepProps) => {
  const responses = (data.responses || {}) as Record<string, unknown>;

  const updateResponses = (updates: Record<string, unknown>) => {
    onUpdate({ responses: { ...responses, ...updates } });
  };

  const canContinue = () => {
    return !!(responses.bug_description as string)?.trim() && !!responses.bug_location;
  };

  const handleNext = () => {
    const location = bugLocations.find(l => l.id === responses.bug_location)?.label;
    const message = `Bug v "${location}": ${responses.bug_description}`;
    onUpdate({ 
      message,
      last_action: responses.bug_location as string,
    });
    onNext();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1 hover:bg-muted rounded">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-semibold">Nahlásit bug</h3>
      </div>

      <div>
        <Label>Co přesně se pokazilo? *</Label>
        <Textarea
          value={(responses.bug_description as string) || ''}
          onChange={(e) => updateResponses({ bug_description: e.target.value })}
          placeholder="Na co jsi kliknul/a a co se stalo?"
          className="mt-2"
          rows={3}
        />
      </div>

      <div>
        <Label>Kde se to stalo? *</Label>
        <div className="space-y-2 mt-2">
          {bugLocations.map((location) => (
            <button
              key={location.id}
              onClick={() => updateResponses({ bug_location: location.id })}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left text-sm',
                responses.bug_location === location.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              )}
            >
              {location.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>Stalo se to opakovaně?</Label>
        <div className="flex gap-2 mt-2">
          {repeatedOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => updateResponses({ bug_repeated: opt.id })}
              className={cn(
                'flex-1 p-3 rounded-lg border transition-all text-sm font-medium',
                responses.bug_repeated === opt.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/50'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>Další detaily (volitelné)</Label>
        <Textarea
          value={(responses.bug_extra as string) || ''}
          onChange={(e) => updateResponses({ bug_extra: e.target.value })}
          placeholder="Cokoliv dalšího, co by nám pomohlo"
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
