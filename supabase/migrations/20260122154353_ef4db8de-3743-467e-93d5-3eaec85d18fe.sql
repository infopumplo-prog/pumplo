-- Create feedback type enum
CREATE TYPE feedback_type AS ENUM (
  'training_exercises', 
  'bug_error', 
  'missing_feature', 
  'confusion', 
  'other'
);

-- Create feedback status enum
CREATE TYPE feedback_status AS ENUM (
  'new', 
  'in_progress', 
  'fixed', 
  'wont_fix'
);

-- Create user_feedback table
CREATE TABLE public.user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Core fields
  feedback_type feedback_type NOT NULL,
  message TEXT,
  
  -- Structured responses (JSONB for flexibility per branch)
  responses JSONB DEFAULT '{}',
  
  -- Context (auto-captured)
  app_version TEXT,
  platform TEXT,
  locale TEXT,
  timezone TEXT,
  current_route TEXT,
  
  -- Workout context
  plan_id UUID,
  week_index INTEGER,
  day_index INTEGER,
  day_letter TEXT,
  workout_id UUID,
  exercise_id UUID,
  gym_id UUID,
  
  -- Bug context
  last_action TEXT,
  error_code TEXT,
  error_message TEXT,
  screenshot_url TEXT,
  
  -- Contact consent
  can_contact BOOLEAN DEFAULT false,
  contact_email TEXT,
  
  -- Admin triage
  status feedback_status DEFAULT 'new',
  admin_notes TEXT
);

-- Enable RLS
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY "Users can insert own feedback"
ON public.user_feedback
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own feedback
CREATE POLICY "Users can view own feedback"
ON public.user_feedback
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all feedback
CREATE POLICY "Admins can view all feedback"
ON public.user_feedback
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update all feedback (for triage)
CREATE POLICY "Admins can update all feedback"
ON public.user_feedback
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));