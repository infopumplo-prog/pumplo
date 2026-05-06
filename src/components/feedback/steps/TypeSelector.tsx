import { Button } from '@/components/ui/button';
import { Dumbbell, Bug, Lightbulb, HelpCircle, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import type { FeedbackType, FeedbackStepProps } from '../types';

const FEEDBACK_TYPE_ICONS: Record<FeedbackType, React.ElementType> = {
  training_exercises: Dumbbell,
  bug_error: Bug,
  missing_feature: Lightbulb,
  confusion: HelpCircle,
  other: MessageSquare,
};

const FEEDBACK_TYPE_KEYS: Record<FeedbackType, string> = {
  training_exercises: 'feedback.type_training',
  bug_error: 'feedback.type_bug',
  missing_feature: 'feedback.type_feature',
  confusion: 'feedback.type_confusion',
  other: 'feedback.type_other',
};

const FEEDBACK_TYPE_IDS: FeedbackType[] = [
  'training_exercises',
  'bug_error',
  'missing_feature',
  'confusion',
  'other',
];

export const TypeSelector = ({ data, onUpdate, onNext }: FeedbackStepProps) => {
  const { t } = useTranslation();
  const selectedType = data.feedback_type;

  const handleSelect = (type: FeedbackType) => {
    onUpdate({ feedback_type: type, responses: {} });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-center">{t('feedback.type_selector_title')}</h3>

      <div className="space-y-2">
        {FEEDBACK_TYPE_IDS.map((id) => {
          const Icon = FEEDBACK_TYPE_ICONS[id];
          return (
            <button
              key={id}
              onClick={() => handleSelect(id)}
              className={cn(
                'w-full flex items-center gap-3 p-4 rounded-xl border transition-all text-left',
                selectedType === id
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
              )}
            >
              <Icon className={cn(
                'w-5 h-5 flex-shrink-0',
                selectedType === id ? 'text-primary' : 'text-muted-foreground'
              )} />
              <span className={cn(
                'font-medium',
                selectedType === id ? 'text-primary' : ''
              )}>
                {t(FEEDBACK_TYPE_KEYS[id])}
              </span>
            </button>
          );
        })}
      </div>

      <Button
        onClick={onNext}
        disabled={!selectedType}
        className="w-full"
      >
        {t('feedback.type_continue')}
      </Button>
    </div>
  );
};
