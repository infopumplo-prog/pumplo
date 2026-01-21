import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ExerciseSkipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exerciseId?: string;
  exerciseName: string;
  gymId?: string;
  planId?: string;
  dayLetter?: string;
  onConfirmSkip: () => void;
}

const SKIP_REASONS = [
  { id: 'too_difficult', label: 'Bol cvik príliš náročný?' },
  { id: 'dont_want', label: 'Cvik sa mi nechce robiť.' },
  { id: 'health', label: 'Zdravotný dôvod' },
  { id: 'machine_missing', label: 'Stroj sa v posilke nenachádza' },
  { id: 'other', label: 'Iné' },
];

export const ExerciseSkipDialog = ({
  open,
  onOpenChange,
  exerciseId,
  exerciseName,
  gymId,
  planId,
  dayLetter,
  onConfirmSkip,
}: ExerciseSkipDialogProps) => {
  const { user } = useAuth();
  const [skipReason, setSkipReason] = useState<string>('');
  const [otherReason, setOtherReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirmSkip = async () => {
    if (!skipReason || !user) return;

    setIsSubmitting(true);
    
    const { error } = await supabase.from('exercise_skip_feedback').insert({
      user_id: user.id,
      exercise_id: exerciseId || null,
      exercise_name: exerciseName,
      gym_id: gymId || null,
      plan_id: planId || null,
      day_letter: dayLetter || null,
      reason: skipReason,
      other_reason: skipReason === 'other' ? otherReason : null,
    });

    setIsSubmitting(false);

    if (error) {
      console.error('Error saving skip feedback:', error);
      toast.error('Chyba pri ukladaní feedbacku');
    }

    // Reset state
    setSkipReason('');
    setOtherReason('');
    onOpenChange(false);
    onConfirmSkip();
  };

  const isValid = skipReason && (skipReason !== 'other' || otherReason.trim());

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Prečo preskakuješ cvik?</AlertDialogTitle>
          <AlertDialogDescription>
            Tvoja spätná väzba nám pomáha zlepšiť tréningy
          </AlertDialogDescription>
        </AlertDialogHeader>

        <RadioGroup value={skipReason} onValueChange={setSkipReason} className="space-y-2">
          {SKIP_REASONS.map((reason) => (
            <div key={reason.id} className="flex items-center space-x-3 py-2">
              <RadioGroupItem value={reason.id} id={reason.id} />
              <Label htmlFor={reason.id} className="cursor-pointer flex-1">
                {reason.label}
              </Label>
            </div>
          ))}
        </RadioGroup>

        {skipReason === 'other' && (
          <Textarea
            placeholder="Napíš dôvod..."
            value={otherReason}
            onChange={(e) => setOtherReason(e.target.value)}
            className="mt-2"
          />
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Späť</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirmSkip}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? 'Ukladám...' : 'Preskočiť'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
