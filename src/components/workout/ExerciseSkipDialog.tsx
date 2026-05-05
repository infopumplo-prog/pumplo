import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  onConfirmSkip: () => void;
  exerciseId?: string;
  exerciseName: string;
  gymId?: string;
  planId?: string;
  dayLetter?: string;
}

export const ExerciseSkipDialog = ({
  open,
  onOpenChange,
  onConfirmSkip,
  exerciseId,
  exerciseName,
  gymId,
  planId,
  dayLetter,
}: ExerciseSkipDialogProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const SKIP_REASONS = [
    { id: 'too_difficult', label: t('workout.skip_reason_too_difficult') },
    { id: 'dont_want', label: t('workout.skip_reason_dont_want') },
    { id: 'health', label: t('workout.skip_reason_health') },
    { id: 'machine_missing', label: t('workout.skip_reason_machine_missing') },
    { id: 'other', label: t('workout.skip_reason_other') },
  ];

  const [skipReason, setSkipReason] = useState<string>(SKIP_REASONS[0].id);
  const [otherReason, setOtherReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirmSkip = async () => {
    if (!skipReason || !user) return;

    setIsSubmitting(true);

    try {
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

      if (error) {
        console.error('Error saving skip feedback:', error);
        toast.error(t('workout.skip_feedback_error'));
      }
    } catch (err) {
      console.error('Error saving skip feedback:', err);
    }

    setIsSubmitting(false);
    setSkipReason(SKIP_REASONS[0].id);
    setOtherReason('');
    onOpenChange(false);
    onConfirmSkip();
  };

  const handleCancel = () => {
    setSkipReason(SKIP_REASONS[0].id);
    setOtherReason('');
    onOpenChange(false);
  };

  const isValid = skipReason && (skipReason !== 'other' || otherReason.trim());

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{t('workout.skip_reason_title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('workout.skip_reason_desc')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <RadioGroup value={skipReason} onValueChange={setSkipReason} className="space-y-2">
          {SKIP_REASONS.map((reason) => (
            <div
              key={reason.id}
              className="flex items-center space-x-3 py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <RadioGroupItem value={reason.id} id={reason.id} />
              <Label htmlFor={reason.id} className="cursor-pointer flex-1 text-sm">
                {reason.label}
              </Label>
            </div>
          ))}
        </RadioGroup>

        {skipReason === 'other' && (
          <Textarea
            placeholder={t('workout.skip_other_placeholder')}
            value={otherReason}
            onChange={(e) => setOtherReason(e.target.value)}
            className="mt-2"
            rows={3}
          />
        )}

        <AlertDialogFooter className="mt-4">
          <AlertDialogCancel onClick={handleCancel}>{t('workout.skip_back')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirmSkip}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? t('workout.skip_saving') : t('workout.skip_confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
