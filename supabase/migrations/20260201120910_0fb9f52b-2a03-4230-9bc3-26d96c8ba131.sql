-- Add split_type column to user_workout_plans
ALTER TABLE user_workout_plans ADD COLUMN split_type text;

-- Add comment for documentation
COMMENT ON COLUMN user_workout_plans.split_type IS 'Split type used when generating this plan: full_body, upper_lower, or ppl';