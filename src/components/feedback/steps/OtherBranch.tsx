import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft } from 'lucide-react';
import type { FeedbackStepProps } from '../types';

export const OtherBranch = ({ data, onUpdate, onNext, onBack }: FeedbackStepProps) => {
  const responses = (data.responses || {}) as Record<string, unknown>;

  const updateResponses = (updates: Record<string, unknown>) => {
    onUpdate({ responses: { ...responses, ...updates } });
  };

  const canContinue = () => {
    return !!(responses.other_message as string)?.trim();
  };

  const handleNext = () => {
    onUpdate({ message: responses.other_message as string });
    onNext();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1 hover:bg-muted rounded">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-semibold">Něco jiného</h3>
      </div>

      <div>
        <Label>Popiš to vlastními slovy *</Label>
        <Textarea
          value={(responses.other_message as string) || ''}
          onChange={(e) => updateResponses({ other_message: e.target.value })}
          placeholder="Co tě trápí nebo co bys chtěl/a říct?"
          className="mt-2"
          rows={5}
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
