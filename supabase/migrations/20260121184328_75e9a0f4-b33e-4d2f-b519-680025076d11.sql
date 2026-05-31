-- Fix existing NULL training_days by copying from user_profiles
UPDATE user_workout_plans 
SET training_days = (
  SELECT COALESCE(training_days, '{}') 
  FROM user_profiles 
  WHERE user_profiles.user_id = user_workout_plans.user_id
)
WHERE training_days IS NULL;

-- Add default value for training_days column
ALTER TABLE user_workout_plans 
ALTER COLUMN training_days SET DEFAULT '{}'::text[];