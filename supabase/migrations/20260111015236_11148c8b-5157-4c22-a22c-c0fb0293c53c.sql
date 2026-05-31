-- Create workout_sessions table to track completed workouts
CREATE TABLE public.workout_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan_id UUID REFERENCES public.user_workout_plans(id) ON DELETE SET NULL,
  gym_id UUID REFERENCES public.gyms(id) ON DELETE SET NULL,
  day_letter TEXT NOT NULL,
  goal_id TEXT NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  total_sets INTEGER DEFAULT 0,
  total_reps INTEGER DEFAULT 0,
  total_weight_kg NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create workout_session_sets table to track individual sets within a workout
CREATE TABLE public.workout_session_sets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES public.exercises(id) ON DELETE SET NULL,
  exercise_name TEXT NOT NULL,
  set_number INTEGER NOT NULL,
  weight_kg NUMERIC,
  reps INTEGER,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_session_sets ENABLE ROW LEVEL SECURITY;

-- RLS policies for workout_sessions
CREATE POLICY "Users can view their own workout sessions"
ON public.workout_sessions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own workout sessions"
ON public.workout_sessions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workout sessions"
ON public.workout_sessions
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workout sessions"
ON public.workout_sessions
FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for workout_session_sets (via session ownership)
CREATE POLICY "Users can view their own session sets"
ON public.workout_session_sets
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.workout_sessions
  WHERE workout_sessions.id = workout_session_sets.session_id
  AND workout_sessions.user_id = auth.uid()
));

CREATE POLICY "Users can create their own session sets"
ON public.workout_session_sets
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.workout_sessions
  WHERE workout_sessions.id = workout_session_sets.session_id
  AND workout_sessions.user_id = auth.uid()
));

CREATE POLICY "Users can update their own session sets"
ON public.workout_session_sets
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.workout_sessions
  WHERE workout_sessions.id = workout_session_sets.session_id
  AND workout_sessions.user_id = auth.uid()
));

CREATE POLICY "Users can delete their own session sets"
ON public.workout_session_sets
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.workout_sessions
  WHERE workout_sessions.id = workout_session_sets.session_id
  AND workout_sessions.user_id = auth.uid()
));

-- Indexes for performance
CREATE INDEX idx_workout_sessions_user_id ON public.workout_sessions(user_id);
CREATE INDEX idx_workout_sessions_completed_at ON public.workout_sessions(completed_at);
CREATE INDEX idx_workout_session_sets_session_id ON public.workout_session_sets(session_id);

-- Modify user_workout_plans to make gym_id optional for plan creation without gym
ALTER TABLE public.user_workout_plans ALTER COLUMN gym_id DROP NOT NULL;