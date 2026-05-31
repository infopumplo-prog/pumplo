import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';
import type { FeedbackStepProps, BugLocation, RepeatedStatus } from '../types';

const BUG_LOCATION_KEYS: Record<BugLocation, string> = {
  generating_workout: 'feedback.bug_loc_generating',
  switching_days: 'feedback.bug_loc_switching',
  opening_exercise: 'feedback.bug_loc_opening',
  marking_done: 'feedback.bug_loc_marking',
  other_place: 'feedback.bug_loc_other',
};

const REPEATED_OPTION_KEYS: Record<RepeatedStatus, string> = {
  yes: 'feedback.bug_repeated_yes',
  no: 'feedback.bug_repeated_no',
  not_sure: 'feedback.bug_repeated_unsure',
};

const BUG_LOCATIONS: BugLocation[] = ['generating_workout', 'switching_days', 'opening_exercise', 'marking_done', 'other_place'];
const REPEATED_OPTIONS: RepeatedStatus[] = ['yes', 'no', 'not_sure'];

export const BugBranch = ({ data, onUpdate, onNext, onBack }: FeedbackStepProps) => {
  const { t } = useTranslation();
  const responses = (data.responses || {}) as Record<string, unknown>;

  const updateResponses = (updates: Record<string, unknown>) => {
    onUpdate({ responses: { ...responses, ...updates } });
  };

  const canContinue = () => {
    return !!(responses.bug_description as string)?.trim() && !!responses.bug_location;
  };

  const handleNext = () => {
    const location = t(BUG_LOCATION_KEYS[responses.bug_location as BugLocation]);
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
        <h3 className="text-lg font-semibold">{t('feedback.bug_title')}</h3>
      </div>

      <div>
        <Label>{t('feedback.bug_what')}</Label>
        <Textarea
          value={(responses.bug_description as string) || ''}
          onChange={(e) => updateResponses({ bug_description: e.target.value })}
          placeholder={t('feedback.bug_what_placeholder')}
          className="mt-2"
          rows={3}
        />
      </div>

      <div>
        <Label>{t('feedback.bug_where')}</Label>
        <div className="space-y-2 mt-2">
          {BUG_LOCATIONS.map((id) => (
            <button
              key={id}
              onClick={() => updateResponses({ bug_location: id })}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left text-sm',
                responses.bug_location === id
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              )}
            >
              {t(BUG_LOCATION_KEYS[id])}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>{t('feedback.bug_repeated')}</Label>
        <div className="flex gap-2 mt-2">
          {REPEATED_OPTIONS.map((id) => (
            <button
              key={id}
              onClick={() => updateResponses({ bug_repeated: id })}
              className={cn(
                'flex-1 p-3 rounded-lg border transition-all text-sm font-medium',
                responses.bug_repeated === id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/50'
              )}
            >
              {t(REPEATED_OPTION_KEYS[id])}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>{t('feedback.bug_extra')}</Label>
        <Textarea
          value={(responses.bug_extra as string) || ''}
          onChange={(e) => updateResponses({ bug_extra: e.target.value })}
          placeholder={t('feedback.bug_extra_placeholder')}
          className="mt-2"
        />
      </div>

      <Button
        onClick={handleNext}
        disabled={!canContinue()}
        className="w-full"
      >
        {t('feedback.type_continue')}
      </Button>
    </div>
  );
};
