export type FeedbackType = 
  | 'training_exercises'
  | 'bug_error'
  | 'missing_feature'
  | 'confusion'
  | 'other';

export type FeedbackStatus = 'new' | 'in_progress' | 'fixed' | 'wont_fix';

// Training branch sub-types
export type TrainingIssueType = 
  | 'exercise_doesnt_make_sense'
  | 'missing_equipment'
  | 'too_easy_hard'
  | 'missing_exercise_type'
  | 'other_training';

export type ExerciseIssueReason = 
  | 'i_cant_do_it'
  | 'pain_discomfort'
  | 'doesnt_fit_workout'
  | 'other_reason';

export type DifficultyType = 'too_easy' | 'too_hard';

export type DifficultyFactor = 'reps' | 'weight' | 'volume' | 'exercise_selection';

export type MissingExerciseType = 
  | 'more_strength'
  | 'more_cardio'
  | 'more_core'
  | 'more_mobility'
  | 'more_variety'
  | 'other_type';

// Bug branch
export type BugLocation = 
  | 'generating_workout'
  | 'switching_days'
  | 'opening_exercise'
  | 'marking_done'
  | 'other_place';

export type RepeatedStatus = 'yes' | 'no' | 'not_sure';

// Feature branch
export type FeaturePriority = 'nice_to_have' | 'important' | 'must_have';

// Confusion branch
export type ConfusionType = 
  | 'why_this_workout'
  | 'why_these_exercises'
  | 'how_to_do_workout'
  | 'how_plan_split_works'
  | 'other_confusion';

export type HelpType = 'explanation' | 'video' | 'tooltip' | 'example' | 'other_help';

// Full feedback data structure
export interface FeedbackData {
  feedback_type: FeedbackType;
  message?: string;
  responses: Record<string, unknown>;
  
  // Context
  app_version?: string;
  platform?: string;
  locale?: string;
  timezone?: string;
  current_route?: string;
  
  // Workout context
  plan_id?: string;
  week_index?: number;
  day_index?: number;
  day_letter?: string;
  workout_id?: string;
  exercise_id?: string;
  gym_id?: string;
  
  // Bug context
  last_action?: string;
  error_code?: string;
  error_message?: string;
  screenshot_url?: string;
  
  // Contact
  can_contact?: boolean;
  contact_email?: string;
}

export interface FeedbackStep {
  id: string;
  title: string;
  component: React.ComponentType<FeedbackStepProps>;
}

export interface FeedbackStepProps {
  data: Partial<FeedbackData>;
  onUpdate: (updates: Partial<FeedbackData>) => void;
  onNext: () => void;
  onBack?: () => void;
  exercises?: { id: string; name: string }[];
}
