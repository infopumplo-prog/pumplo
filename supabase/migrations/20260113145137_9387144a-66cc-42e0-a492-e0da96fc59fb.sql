-- Add is_bonus column to workout_sessions to track bonus/extra workouts
ALTER TABLE public.workout_sessions 
ADD COLUMN IF NOT EXISTS is_bonus BOOLEAN NOT NULL DEFAULT false;

-- Add comment explaining the column
COMMENT ON COLUMN public.workout_sessions.is_bonus IS 'Marks workouts that are bonus/extra sessions not part of the regular training plan progress';