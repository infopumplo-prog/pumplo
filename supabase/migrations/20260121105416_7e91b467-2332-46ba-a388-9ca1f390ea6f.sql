-- Step 1: Add the new column
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS allowed_phase text DEFAULT 'main';

-- Step 2: Drop deprecated columns
ALTER TABLE public.exercises 
  DROP COLUMN IF EXISTS requires_machine,
  DROP COLUMN IF EXISTS contraindicated_injuries,
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS workout_split,
  DROP COLUMN IF EXISTS movement_pattern,
  DROP COLUMN IF EXISTS equipment,
  DROP COLUMN IF EXISTS secondary_role;

-- Step 3: Clear all existing data to prepare for fresh import
DELETE FROM public.exercises;