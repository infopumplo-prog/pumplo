-- Phase 1: Workout Roles/Templates MVP Database Schema

-- 1. Training Roles table (reference table for 12 roles)
CREATE TABLE public.training_roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('upper', 'lower', 'core')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert 12 training roles
INSERT INTO public.training_roles (id, name, category, description) VALUES
  ('horizontal_push', 'Horizontální tlak', 'upper', 'Tlakové cviky v horizontální rovině (bench press, kliky)'),
  ('horizontal_pull', 'Horizontální tah', 'upper', 'Tahové cviky v horizontální rovině (přitahování, veslování)'),
  ('vertical_push', 'Vertikální tlak', 'upper', 'Tlakové cviky ve vertikální rovině (overhead press)'),
  ('vertical_pull', 'Vertikální tah', 'upper', 'Tahové cviky ve vertikální rovině (shyby, lat pulldown)'),
  ('knee_dominant', 'Dřep', 'lower', 'Cviky s dominancí kolen (dřepy, leg press)'),
  ('hip_dominant', 'Hip hinge', 'lower', 'Cviky s dominancí kyčlí (deadlift, hip thrust)'),
  ('single_leg_lower', 'Unilaterální nohy', 'lower', 'Jednostranné cviky na nohy (výpady, single leg)'),
  ('calf_isolation', 'Lýtka', 'lower', 'Izolované cviky na lýtka'),
  ('biceps_isolation', 'Biceps', 'upper', 'Izolované cviky na biceps'),
  ('triceps_isolation', 'Triceps', 'upper', 'Izolované cviky na triceps'),
  ('core_anti_extension', 'Core - anti-extenze', 'core', 'Cviky proti extenzi páteře (plank, ab wheel)'),
  ('core_rotation', 'Core - rotace', 'core', 'Rotační a anti-rotační cviky (russian twist, pallof press)');

-- Enable RLS on training_roles (public read)
ALTER TABLE public.training_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Training roles are publicly readable"
ON public.training_roles FOR SELECT
USING (true);

-- 2. Add primary_role and secondary_role to exercises table
ALTER TABLE public.exercises 
  ADD COLUMN IF NOT EXISTS primary_role TEXT REFERENCES public.training_roles(id),
  ADD COLUMN IF NOT EXISTS secondary_role TEXT REFERENCES public.training_roles(id);

-- Migrate existing movement_pattern to primary_role
UPDATE public.exercises SET primary_role = 
  CASE movement_pattern
    WHEN 'HORIZONTAL_PUSH' THEN 'horizontal_push'
    WHEN 'HORIZONTAL_PULL' THEN 'horizontal_pull'
    WHEN 'VERTICAL_PUSH' THEN 'vertical_push'
    WHEN 'VERTICAL_PULL' THEN 'vertical_pull'
    WHEN 'SQUAT' THEN 'knee_dominant'
    WHEN 'HINGE' THEN 'hip_dominant'
    WHEN 'SINGLE_LEG' THEN 'single_leg_lower'
    WHEN 'CALVES' THEN 'calf_isolation'
    WHEN 'CORE_ANTERIOR' THEN 'core_anti_extension'
    WHEN 'CORE_ROTATION' THEN 'core_rotation'
    WHEN 'ACCESSORY_UPPER' THEN 'biceps_isolation'
    WHEN 'ACCESSORY_LOWER' THEN 'hip_dominant'
    ELSE NULL
  END
WHERE primary_role IS NULL;

-- 3. Training Goals table
CREATE TABLE public.training_goals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  day_count INTEGER NOT NULL CHECK (day_count >= 1 AND day_count <= 7),
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.training_goals (id, name, description, day_count) VALUES
  ('muscle_gain', 'Nabrat svaly', 'Zaměřeno na hypertrofii a růst svalové hmoty', 3),
  ('fat_loss', 'Zhubnout', 'Vysoká intenzita, kratší pauzy pro maximální spalování', 2),
  ('strength', 'Získat sílu', 'Nízké opakování, vysoké váhy pro rozvoj síly', 2),
  ('general_fitness', 'Obecná kondice', 'Vyvážený program pro celkovou fyzickou zdatnost', 2);

ALTER TABLE public.training_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Training goals are publicly readable"
ON public.training_goals FOR SELECT
USING (true);

-- 4. Day Templates table (stores the structure of each training day)
CREATE TABLE public.day_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id TEXT REFERENCES public.training_goals(id) NOT NULL,
  day_letter TEXT NOT NULL,
  day_name TEXT NOT NULL,
  slot_order INTEGER NOT NULL,
  role_id TEXT REFERENCES public.training_roles(id) NOT NULL,
  beginner_sets INTEGER NOT NULL DEFAULT 2,
  intermediate_sets INTEGER NOT NULL DEFAULT 3,
  advanced_sets INTEGER NOT NULL DEFAULT 4,
  rep_min INTEGER DEFAULT 8,
  rep_max INTEGER DEFAULT 12,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(goal_id, day_letter, slot_order)
);

ALTER TABLE public.day_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Day templates are publicly readable"
ON public.day_templates FOR SELECT
USING (true);

-- Insert day templates for Muscle Gain (3 days: Push/Pull/Legs)
INSERT INTO public.day_templates (goal_id, day_letter, day_name, slot_order, role_id, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max) VALUES
  -- Day A (Push)
  ('muscle_gain', 'A', 'Push', 1, 'horizontal_push', 3, 4, 5, 8, 12),
  ('muscle_gain', 'A', 'Push', 2, 'vertical_push', 2, 3, 4, 8, 12),
  ('muscle_gain', 'A', 'Push', 3, 'horizontal_push', 2, 3, 3, 10, 15),
  ('muscle_gain', 'A', 'Push', 4, 'triceps_isolation', 2, 3, 4, 10, 15),
  -- Day B (Pull)
  ('muscle_gain', 'B', 'Pull', 1, 'vertical_pull', 3, 4, 5, 8, 12),
  ('muscle_gain', 'B', 'Pull', 2, 'horizontal_pull', 3, 4, 4, 8, 12),
  ('muscle_gain', 'B', 'Pull', 3, 'horizontal_pull', 2, 3, 3, 10, 15),
  ('muscle_gain', 'B', 'Pull', 4, 'biceps_isolation', 2, 3, 4, 10, 15),
  -- Day C (Legs)
  ('muscle_gain', 'C', 'Legs', 1, 'knee_dominant', 3, 4, 5, 8, 12),
  ('muscle_gain', 'C', 'Legs', 2, 'hip_dominant', 3, 4, 5, 8, 12),
  ('muscle_gain', 'C', 'Legs', 3, 'single_leg_lower', 2, 3, 3, 10, 12),
  ('muscle_gain', 'C', 'Legs', 4, 'calf_isolation', 3, 4, 4, 12, 20),
  ('muscle_gain', 'C', 'Legs', 5, 'core_anti_extension', 2, 3, 3, 10, 15);

-- Insert day templates for Fat Loss (2 days: Full Body A/B)
INSERT INTO public.day_templates (goal_id, day_letter, day_name, slot_order, role_id, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max) VALUES
  -- Day A
  ('fat_loss', 'A', 'Full Body A', 1, 'knee_dominant', 3, 4, 4, 12, 15),
  ('fat_loss', 'A', 'Full Body A', 2, 'horizontal_push', 3, 3, 4, 12, 15),
  ('fat_loss', 'A', 'Full Body A', 3, 'horizontal_pull', 3, 3, 4, 12, 15),
  ('fat_loss', 'A', 'Full Body A', 4, 'core_anti_extension', 2, 3, 3, 15, 20),
  -- Day B
  ('fat_loss', 'B', 'Full Body B', 1, 'hip_dominant', 3, 4, 4, 12, 15),
  ('fat_loss', 'B', 'Full Body B', 2, 'vertical_push', 3, 3, 4, 12, 15),
  ('fat_loss', 'B', 'Full Body B', 3, 'vertical_pull', 3, 3, 4, 12, 15),
  ('fat_loss', 'B', 'Full Body B', 4, 'core_rotation', 2, 3, 3, 12, 15);

-- Insert day templates for Strength (2 days: Upper/Lower)
INSERT INTO public.day_templates (goal_id, day_letter, day_name, slot_order, role_id, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max) VALUES
  -- Day A (Upper)
  ('strength', 'A', 'Upper', 1, 'horizontal_push', 4, 5, 6, 3, 6),
  ('strength', 'A', 'Upper', 2, 'horizontal_pull', 4, 5, 5, 3, 6),
  ('strength', 'A', 'Upper', 3, 'vertical_push', 3, 4, 4, 5, 8),
  ('strength', 'A', 'Upper', 4, 'vertical_pull', 3, 4, 4, 5, 8),
  -- Day B (Lower)
  ('strength', 'B', 'Lower', 1, 'knee_dominant', 4, 5, 6, 3, 6),
  ('strength', 'B', 'Lower', 2, 'hip_dominant', 4, 5, 6, 3, 6),
  ('strength', 'B', 'Lower', 3, 'single_leg_lower', 3, 3, 4, 6, 8),
  ('strength', 'B', 'Lower', 4, 'core_anti_extension', 3, 3, 4, 8, 12);

-- Insert day templates for General Fitness (2 days: Full Body A/B)
INSERT INTO public.day_templates (goal_id, day_letter, day_name, slot_order, role_id, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max) VALUES
  -- Day A
  ('general_fitness', 'A', 'Full Body A', 1, 'knee_dominant', 2, 3, 4, 10, 12),
  ('general_fitness', 'A', 'Full Body A', 2, 'horizontal_push', 2, 3, 3, 10, 12),
  ('general_fitness', 'A', 'Full Body A', 3, 'horizontal_pull', 2, 3, 3, 10, 12),
  ('general_fitness', 'A', 'Full Body A', 4, 'core_anti_extension', 2, 2, 3, 12, 15),
  -- Day B
  ('general_fitness', 'B', 'Full Body B', 1, 'hip_dominant', 2, 3, 4, 10, 12),
  ('general_fitness', 'B', 'Full Body B', 2, 'vertical_push', 2, 3, 3, 10, 12),
  ('general_fitness', 'B', 'Full Body B', 3, 'vertical_pull', 2, 3, 3, 10, 12),
  ('general_fitness', 'B', 'Full Body B', 4, 'calf_isolation', 2, 3, 3, 12, 15);

-- 5. Extend user_profiles
ALTER TABLE public.user_profiles 
  ADD COLUMN IF NOT EXISTS user_level TEXT DEFAULT 'beginner' CHECK (user_level IN ('beginner', 'intermediate', 'advanced')),
  ADD COLUMN IF NOT EXISTS selected_gym_id UUID REFERENCES public.gyms(id),
  ADD COLUMN IF NOT EXISTS current_day_index INTEGER DEFAULT 0;

-- 6. User Workout Plans table
CREATE TABLE public.user_workout_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  gym_id UUID REFERENCES public.gyms(id) NOT NULL,
  goal_id TEXT REFERENCES public.training_goals(id) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_workout_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own workout plans"
ON public.user_workout_plans FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own workout plans"
ON public.user_workout_plans FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workout plans"
ON public.user_workout_plans FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workout plans"
ON public.user_workout_plans FOR DELETE
USING (auth.uid() = user_id);

-- 7. User Workout Exercises table (stores assigned exercises for each plan)
CREATE TABLE public.user_workout_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES public.user_workout_plans(id) ON DELETE CASCADE NOT NULL,
  day_letter TEXT NOT NULL,
  slot_order INTEGER NOT NULL,
  role_id TEXT REFERENCES public.training_roles(id) NOT NULL,
  exercise_id UUID REFERENCES public.exercises(id),
  sets INTEGER NOT NULL,
  rep_min INTEGER DEFAULT 8,
  rep_max INTEGER DEFAULT 12,
  is_fallback BOOLEAN DEFAULT false,
  fallback_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_workout_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own workout exercises"
ON public.user_workout_exercises FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.user_workout_plans 
  WHERE user_workout_plans.id = user_workout_exercises.plan_id 
  AND user_workout_plans.user_id = auth.uid()
));

CREATE POLICY "Users can create their own workout exercises"
ON public.user_workout_exercises FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_workout_plans 
  WHERE user_workout_plans.id = user_workout_exercises.plan_id 
  AND user_workout_plans.user_id = auth.uid()
));

CREATE POLICY "Users can update their own workout exercises"
ON public.user_workout_exercises FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.user_workout_plans 
  WHERE user_workout_plans.id = user_workout_exercises.plan_id 
  AND user_workout_plans.user_id = auth.uid()
));

CREATE POLICY "Users can delete their own workout exercises"
ON public.user_workout_exercises FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.user_workout_plans 
  WHERE user_workout_plans.id = user_workout_exercises.plan_id 
  AND user_workout_plans.user_id = auth.uid()
));