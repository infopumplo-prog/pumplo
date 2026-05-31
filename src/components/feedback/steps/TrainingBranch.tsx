import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';
import type {
  FeedbackStepProps,
  TrainingIssueType,
  ExerciseIssueReason,
  DifficultyType,
  DifficultyFactor,
  MissingExerciseType
} from '../types';

export const TrainingBranch = ({ data, onUpdate, onNext, onBack, exercises = [] }: FeedbackStepProps) => {
  const { t } = useTranslation();
  const responses = (data.responses || {}) as Record<string, unknown>;
  const [step, setStep] = useState<'issue' | 'details'>('issue');

  const issueTypes: { id: TrainingIssueType; label: string }[] = [
    { id: 'exercise_doesnt_make_sense', label: t('feedback.training_issue_doesnt_make_sense') },
    { id: 'missing_equipment', label: t('feedback.training_issue_missing_equipment') },
    { id: 'too_easy_hard', label: t('feedback.training_issue_too_easy_hard') },
    { id: 'missing_exercise_type', label: t('feedback.training_issue_missing_type') },
    { id: 'other_training', label: t('feedback.training_issue_other') },
  ];

  const exerciseReasons: { id: ExerciseIssueReason; label: string }[] = [
    { id: 'i_cant_do_it', label: t('feedback.training_reason_cant') },
    { id: 'pain_discomfort', label: t('feedback.training_reason_pain') },
    { id: 'doesnt_fit_workout', label: t('feedback.training_reason_doesnt_fit') },
    { id: 'other_reason', label: t('feedback.training_reason_other') },
  ];

  const difficultyFactors: { id: DifficultyFactor; label: string }[] = [
    { id: 'reps', label: t('feedback.training_diff_reps') },
    { id: 'weight', label: t('feedback.training_diff_weight') },
    { id: 'volume', label: t('feedback.training_diff_volume') },
    { id: 'exercise_selection', label: t('feedback.training_diff_selection') },
  ];

  const missingTypes: { id: MissingExerciseType; label: string }[] = [
    { id: 'more_strength', label: t('feedback.training_more_strength') },
    { id: 'more_cardio', label: t('feedback.training_more_cardio') },
    { id: 'more_core', label: t('feedback.training_more_core') },
    { id: 'more_mobility', label: t('feedback.training_more_mobility') },
    { id: 'more_variety', label: t('feedback.training_more_variety') },
    { id: 'other_type', label: t('feedback.training_other_type') },
  ];

  const selectedIssue = responses.training_issue as TrainingIssueType | undefined;

  const updateResponses = (updates: Record<string, unknown>) => {
    onUpdate({ responses: { ...responses, ...updates } });
  };

  const handleIssueSelect = (issue: TrainingIssueType) => {
    updateResponses({ training_issue: issue });
  };

  const canContinue = () => {
    if (step === 'issue') return !!selectedIssue;

    switch (selectedIssue) {
      case 'exercise_doesnt_make_sense':
        return !!responses.exercise_name && !!responses.exercise_reason;
      case 'missing_equipment':
        return !!responses.missing_equipment;
      case 'too_easy_hard':
        return !!responses.difficulty_type;
      case 'missing_exercise_type':
        return (responses.missing_types as string[] || []).length > 0;
      case 'other_training':
        return !!(responses.other_detail as string)?.trim();
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (step === 'issue') {
      setStep('details');
    } else {
      // Build message from responses
      let message = '';
      switch (selectedIssue) {
        case 'exercise_doesnt_make_sense':
          message = `Cvik "${responses.exercise_name}" - ${exerciseReasons.find(r => r.id === responses.exercise_reason)?.label}`;
          break;
        case 'missing_equipment':
          message = `Chybějící vybavení: ${responses.missing_equipment}`;
          break;
        case 'too_easy_hard':
          message = `Trénink byl ${responses.difficulty_type === 'too_easy' ? t('feedback.training_too_easy') : t('feedback.training_too_hard')}`;
          break;
        case 'missing_exercise_type':
          message = `Chybějící typy: ${(responses.missing_types as string[] || []).map(mt =>
            missingTypes.find(m => m.id === mt)?.label
          ).join(', ')}`;
          break;
        case 'other_training':
          message = responses.other_detail as string;
          break;
      }
      onUpdate({ message });
      onNext();
    }
  };

  const handleBack = () => {
    if (step === 'details') {
      setStep('issue');
    } else {
      onBack?.();
    }
  };

  const toggleMissingType = (type: MissingExerciseType) => {
    const current = (responses.missing_types as string[]) || [];
    const updated = current.includes(type)
      ? current.filter(mt => mt !== type)
      : [...current, type];
    updateResponses({ missing_types: updated });
  };

  const toggleDifficultyFactor = (factor: DifficultyFactor) => {
    const current = (responses.difficulty_factors as string[]) || [];
    const updated = current.includes(factor)
      ? current.filter(f => f !== factor)
      : [...current, factor];
    updateResponses({ difficulty_factors: updated });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={handleBack} className="p-1 hover:bg-muted rounded">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-semibold">
          {step === 'issue' ? t('feedback.training_title_issue') : t('feedback.training_title_detail')}
        </h3>
      </div>

      {step === 'issue' && (
        <div className="space-y-2">
          {issueTypes.map((issue) => (
            <button
              key={issue.id}
              onClick={() => handleIssueSelect(issue.id)}
              className={cn(
                'w-full flex items-center gap-3 p-4 rounded-xl border transition-all text-left',
                selectedIssue === issue.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
              )}
            >
              <span className={cn(
                'font-medium',
                selectedIssue === issue.id ? 'text-primary' : ''
              )}>
                {issue.label}
              </span>
            </button>
          ))}
        </div>
      )}

      {step === 'details' && selectedIssue === 'exercise_doesnt_make_sense' && (
        <div className="space-y-4">
          <div>
            <Label>{t('feedback.training_which_exercise')}</Label>
            {exercises.length > 0 ? (
              <Select
                value={responses.exercise_id as string}
                onValueChange={(value) => {
                  const ex = exercises.find(e => e.id === value);
                  updateResponses({ exercise_id: value, exercise_name: ex?.name });
                }}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder={t('feedback.training_select_exercise')} />
                </SelectTrigger>
                <SelectContent>
                  {exercises.map((ex) => (
                    <SelectItem key={ex.id} value={ex.id}>{ex.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Textarea
                value={(responses.exercise_name as string) || ''}
                onChange={(e) => updateResponses({ exercise_name: e.target.value })}
                placeholder={t('feedback.training_exercise_name')}
                className="mt-2"
              />
            )}
          </div>

          <div>
            <Label>{t('feedback.training_why')}</Label>
            <div className="space-y-2 mt-2">
              {exerciseReasons.map((reason) => (
                <button
                  key={reason.id}
                  onClick={() => updateResponses({ exercise_reason: reason.id })}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left text-sm',
                    responses.exercise_reason === reason.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  {reason.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>{t('feedback.training_exercise_detail')}</Label>
            <Textarea
              value={(responses.exercise_detail as string) || ''}
              onChange={(e) => updateResponses({ exercise_detail: e.target.value })}
              placeholder={t('feedback.training_exercise_detail_placeholder')}
              className="mt-2"
            />
          </div>
        </div>
      )}

      {step === 'details' && selectedIssue === 'missing_equipment' && (
        <div className="space-y-4">
          <div>
            <Label>{t('feedback.training_missing_equipment_label')}</Label>
            <Textarea
              value={(responses.missing_equipment as string) || ''}
              onChange={(e) => updateResponses({ missing_equipment: e.target.value })}
              placeholder={t('feedback.training_missing_equipment_placeholder')}
              className="mt-2"
            />
          </div>

          {exercises.length > 0 && (
            <div>
              <Label>{t('feedback.training_caused_by_exercise')}</Label>
              <Select
                value={responses.exercise_id as string}
                onValueChange={(value) => {
                  const ex = exercises.find(e => e.id === value);
                  updateResponses({ exercise_id: value, exercise_name: ex?.name });
                }}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder={t('feedback.training_select_exercise')} />
                </SelectTrigger>
                <SelectContent>
                  {exercises.map((ex) => (
                    <SelectItem key={ex.id} value={ex.id}>{ex.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      {step === 'details' && selectedIssue === 'too_easy_hard' && (
        <div className="space-y-4">
          <div>
            <Label>{t('feedback.training_difficulty_was')}</Label>
            <div className="flex gap-2 mt-2">
              {[
                { id: 'too_easy' as DifficultyType, label: t('feedback.training_too_easy') },
                { id: 'too_hard' as DifficultyType, label: t('feedback.training_too_hard') },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => updateResponses({ difficulty_type: opt.id })}
                  className={cn(
                    'flex-1 p-3 rounded-lg border transition-all text-sm font-medium',
                    responses.difficulty_type === opt.id
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
            <Label>{t('feedback.training_problem_in')}</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {difficultyFactors.map((factor) => (
                <button
                  key={factor.id}
                  onClick={() => toggleDifficultyFactor(factor.id)}
                  className={cn(
                    'p-3 rounded-lg border transition-all text-sm',
                    ((responses.difficulty_factors as string[]) || []).includes(factor.id)
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  {factor.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>{t('feedback.training_diff_change')}</Label>
            <Textarea
              value={(responses.difficulty_detail as string) || ''}
              onChange={(e) => updateResponses({ difficulty_detail: e.target.value })}
              placeholder={t('feedback.training_diff_change_placeholder')}
              className="mt-2"
            />
          </div>
        </div>
      )}

      {step === 'details' && selectedIssue === 'missing_exercise_type' && (
        <div className="space-y-4">
          <div>
            <Label>{t('feedback.training_missing_what')}</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {missingTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => toggleMissingType(type.id)}
                  className={cn(
                    'p-3 rounded-lg border transition-all text-sm',
                    ((responses.missing_types as string[]) || []).includes(type.id)
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
            <Label>{t('feedback.training_ideal_variant')}</Label>
            <Textarea
              value={(responses.missing_detail as string) || ''}
              onChange={(e) => updateResponses({ missing_detail: e.target.value })}
              placeholder={t('feedback.training_ideal_placeholder')}
              className="mt-2"
            />
          </div>
        </div>
      )}

      {step === 'details' && selectedIssue === 'other_training' && (
        <div>
          <Label>{t('feedback.training_other_describe')}</Label>
          <Textarea
            value={(responses.other_detail as string) || ''}
            onChange={(e) => updateResponses({ other_detail: e.target.value })}
            placeholder={t('feedback.training_other_placeholder')}
            className="mt-2"
            rows={4}
          />
        </div>
      )}

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
