-- Opraviť aktívne plány s NULL alebo prázdnymi training_days - synchronizovať z profilu
UPDATE user_workout_plans 
SET training_days = (
  SELECT COALESCE(training_days, '{}') 
  FROM user_profiles 
  WHERE user_profiles.user_id = user_workout_plans.user_id
)
WHERE is_active = true AND (training_days IS NULL OR training_days = '{}');