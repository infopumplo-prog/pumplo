-- Add week tracking and plan duration to training goals
ALTER TABLE training_goals ADD COLUMN IF NOT EXISTS duration_weeks INTEGER DEFAULT 4;

-- Update goals with appropriate durations
UPDATE training_goals SET duration_weeks = 12 WHERE id = 'muscle_gain';
UPDATE training_goals SET duration_weeks = 8 WHERE id = 'fat_loss';
UPDATE training_goals SET duration_weeks = 8 WHERE id = 'strength';
UPDATE training_goals SET duration_weeks = 6 WHERE id = 'general_fitness';

-- Add week tracking to user workout plans
ALTER TABLE user_workout_plans ADD COLUMN IF NOT EXISTS current_week INTEGER DEFAULT 1;
ALTER TABLE user_workout_plans ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT now();