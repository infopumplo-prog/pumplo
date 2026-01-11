-- Add exercise_with_weights boolean column
ALTER TABLE public.exercises 
ADD COLUMN IF NOT EXISTS exercise_with_weights boolean DEFAULT true;

-- Set exercise_with_weights = false for bodyweight/stretching exercises
UPDATE public.exercises 
SET exercise_with_weights = false 
WHERE 
  'bodyweight' = ANY(equipment) 
  OR 'stretching' = ANY(equipment)
  OR category IN ('stretching', 'flexibility', 'mobility')
  OR name ILIKE '%stretch%'
  OR name ILIKE '%plank%'
  OR name ILIKE '%push-up%'
  OR name ILIKE '%pushup%'
  OR name ILIKE '%pull-up%'
  OR name ILIKE '%pullup%'
  OR name ILIKE '%chin-up%'
  OR name ILIKE '%chinup%'
  OR name ILIKE '%dip%'
  OR name ILIKE '%crunch%'
  OR name ILIKE '%sit-up%'
  OR name ILIKE '%situp%'
  OR name ILIKE '%leg raise%'
  OR name ILIKE '%mountain climber%'
  OR name ILIKE '%burpee%'
  OR name ILIKE '%jumping jack%'
  OR name ILIKE '%high knee%'
  OR name ILIKE '%lunge%' AND 'bodyweight' = ANY(equipment);

-- Set exercise_with_weights = true for weighted exercises
UPDATE public.exercises 
SET exercise_with_weights = true 
WHERE 
  'barbell' = ANY(equipment)
  OR 'dumbbell' = ANY(equipment)
  OR 'kettlebell' = ANY(equipment)
  OR 'cable' = ANY(equipment)
  OR 'machine' = ANY(equipment)
  OR 'plate_loaded' = ANY(equipment)
  OR requires_machine = true;

-- Fix difficulty values - compound heavy exercises should be harder
UPDATE public.exercises SET difficulty = 8 WHERE name ILIKE '%deadlift%' AND name NOT ILIKE '%romanian%' AND name NOT ILIKE '%stiff%';
UPDATE public.exercises SET difficulty = 7 WHERE name ILIKE '%romanian deadlift%' OR name ILIKE '%stiff leg%';
UPDATE public.exercises SET difficulty = 7 WHERE name ILIKE '%squat%' AND name NOT ILIKE '%goblet%' AND name NOT ILIKE '%bodyweight%';
UPDATE public.exercises SET difficulty = 5 WHERE name ILIKE '%goblet squat%';
UPDATE public.exercises SET difficulty = 8 WHERE name ILIKE '%barbell row%' OR name ILIKE '%bent over row%';
UPDATE public.exercises SET difficulty = 7 WHERE name ILIKE '%overhead press%' OR name ILIKE '%military press%';
UPDATE public.exercises SET difficulty = 6 WHERE name ILIKE '%bench press%';
UPDATE public.exercises SET difficulty = 7 WHERE name ILIKE '%incline bench%';
UPDATE public.exercises SET difficulty = 5 WHERE name ILIKE '%pull-up%' OR name ILIKE '%pullup%' OR name ILIKE '%chin-up%' OR name ILIKE '%chinup%';
UPDATE public.exercises SET difficulty = 4 WHERE name ILIKE '%dip%';
UPDATE public.exercises SET difficulty = 3 WHERE name ILIKE '%curl%' AND name NOT ILIKE '%leg curl%';
UPDATE public.exercises SET difficulty = 3 WHERE name ILIKE '%tricep%' OR name ILIKE '%triceps%';
UPDATE public.exercises SET difficulty = 2 WHERE name ILIKE '%lateral raise%' OR name ILIKE '%side raise%';
UPDATE public.exercises SET difficulty = 2 WHERE name ILIKE '%front raise%';
UPDATE public.exercises SET difficulty = 4 WHERE name ILIKE '%leg curl%';
UPDATE public.exercises SET difficulty = 3 WHERE name ILIKE '%leg extension%';
UPDATE public.exercises SET difficulty = 6 WHERE name ILIKE '%leg press%';
UPDATE public.exercises SET difficulty = 5 WHERE name ILIKE '%lunge%';
UPDATE public.exercises SET difficulty = 4 WHERE name ILIKE '%hip thrust%';
UPDATE public.exercises SET difficulty = 3 WHERE name ILIKE '%calf%';
UPDATE public.exercises SET difficulty = 2 WHERE name ILIKE '%plank%';
UPDATE public.exercises SET difficulty = 3 WHERE name ILIKE '%crunch%' OR name ILIKE '%sit-up%';
UPDATE public.exercises SET difficulty = 4 WHERE name ILIKE '%cable%' AND name NOT ILIKE '%cable fly%';
UPDATE public.exercises SET difficulty = 3 WHERE name ILIKE '%cable fly%' OR name ILIKE '%chest fly%';
UPDATE public.exercises SET difficulty = 4 WHERE name ILIKE '%lat pull%';
UPDATE public.exercises SET difficulty = 4 WHERE name ILIKE '%face pull%';
UPDATE public.exercises SET difficulty = 5 WHERE name ILIKE '%clean%' OR name ILIKE '%snatch%';
UPDATE public.exercises SET difficulty = 9 WHERE name ILIKE '%power clean%' OR name ILIKE '%power snatch%';
UPDATE public.exercises SET difficulty = 10 WHERE name ILIKE '%olympic%';
UPDATE public.exercises SET difficulty = 6 WHERE name ILIKE '%farmer%' OR name ILIKE '%carry%';
UPDATE public.exercises SET difficulty = 1 WHERE name ILIKE '%stretch%' OR category = 'stretching';
UPDATE public.exercises SET difficulty = 2 WHERE name ILIKE '%resistance band%' AND difficulty > 3;