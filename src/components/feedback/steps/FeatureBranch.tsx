import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';
import type { FeedbackStepProps, FeaturePriority } from '../types';

const PRIORITY_KEYS: Record<FeaturePriority, { label: string; description: string }> = {
  nice_to_have: { label: 'feedback.feature_nice', description: 'feedback.feature_nice_desc' },
  important:    { label: 'feedback.feature_important', description: 'feedback.feature_important_desc' },
  must_have:    { label: 'feedback.feature_must', description: 'feedback.feature_must_desc' },
};

const PRIORITY_IDS: FeaturePriority[] = ['nice_to_have', 'important', 'must_have'];

export const FeatureBranch = ({ data, onUpdate, onNext, onBack }: FeedbackStepProps) => {
  const { t } = useTranslation();
  const responses = (data.responses || {}) as Record<string, unknown>;

  const updateResponses = (updates: Record<string, unknown>) => {
    onUpdate({ responses: { ...responses, ...updates } });
  };

  const canContinue = () => {
    return !!(responses.feature_request as string)?.trim();
  };

  const handleNext = () => {
    const priorityId = responses.feature_priority as FeaturePriority | undefined;
    const priorityLabel = priorityId ? t(PRIORITY_KEYS[priorityId].label) : '';
    const message = `${responses.feature_request}${priorityLabel ? ` [${priorityLabel}]` : ''}`;
    onUpdate({ message });
    onNext();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1 hover:bg-muted rounded">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-semibold">{t('feedback.feature_title')}</h3>
      </div>

      <div>
        <Label>{t('feedback.feature_what')}</Label>
        <Textarea
          value={(responses.feature_request as string) || ''}
          onChange={(e) => updateResponses({ feature_request: e.target.value })}
          placeholder={t('feedback.feature_placeholder')}
          className="mt-2"
          rows={3}
        />
      </div>

      <div>
        <Label>{t('feedback.feature_ideal')}</Label>
        <Textarea
          value={(responses.feature_ideal as string) || ''}
          onChange={(e) => updateResponses({ feature_ideal: e.target.value })}
          placeholder={t('feedback.feature_ideal_placeholder')}
          className="mt-2"
          rows={2}
        />
      </div>

      <div>
        <Label>{t('feedback.feature_importance')}</Label>
        <div className="space-y-2 mt-2">
          {PRIORITY_IDS.map((id) => (
            <button
              key={id}
              onClick={() => updateResponses({ feature_priority: id })}
              className={cn(
                'w-full flex flex-col items-start p-3 rounded-lg border transition-all text-left',
                responses.feature_priority === id
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              )}
            >
              <span className={cn(
                'font-medium text-sm',
                responses.feature_priority === id ? 'text-primary' : ''
              )}>
                {t(PRIORITY_KEYS[id].label)}
              </span>
              <span className="text-xs text-muted-foreground">{t(PRIORITY_KEYS[id].description)}</span>
            </button>
          ))}
        </div>
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
