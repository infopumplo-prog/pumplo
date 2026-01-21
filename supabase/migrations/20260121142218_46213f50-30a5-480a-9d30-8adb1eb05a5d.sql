-- Add training_days column to user_workout_plans to store the training schedule at plan creation time
-- This ensures that changing onboarding settings won't affect the current active plan
ALTER TABLE public.user_workout_plans 
ADD COLUMN training_days TEXT[] DEFAULT NULL;