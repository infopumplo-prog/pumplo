-- Add streak columns to user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS streak_updated_at TIMESTAMPTZ;

-- Add week_number to workout_sessions for explicit tracking
ALTER TABLE workout_sessions 
ADD COLUMN IF NOT EXISTS week_number INTEGER DEFAULT 1;