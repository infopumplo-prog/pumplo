-- Phase 1: PUMPLO Training System Refactor - Complete Database Schema Changes

-- 1.1 Add columns to exercises table
ALTER TABLE public.exercises 
ADD COLUMN IF NOT EXISTS banned_injuries TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS slot_type TEXT DEFAULT 'main',
ADD COLUMN IF NOT EXISTS is_compound BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS stability_rating INTEGER DEFAULT 5;

-- 1.2 Add columns to user_workout_plans table
ALTER TABLE public.user_workout_plans 
ADD COLUMN IF NOT EXISTS generator_version TEXT DEFAULT '2.0.0',
ADD COLUMN IF NOT EXISTS methodology_version TEXT DEFAULT '2.0.0',
ADD COLUMN IF NOT EXISTS selection_seed TEXT,
ADD COLUMN IF NOT EXISTS inputs_snapshot_json JSONB,
ADD COLUMN IF NOT EXISTS validation_report_json JSONB,
ADD COLUMN IF NOT EXISTS needs_regeneration BOOLEAN DEFAULT false;

-- 1.3 Add columns to user_workout_exercises table
ALTER TABLE public.user_workout_exercises 
ADD COLUMN IF NOT EXISTS selection_score NUMERIC;

-- 1.4 Add columns to training_roles table
ALTER TABLE public.training_roles 
ADD COLUMN IF NOT EXISTS allowed_equipment_categories TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS banned_injury_tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS difficulty_level TEXT DEFAULT 'all',
ADD COLUMN IF NOT EXISTS has_bodyweight_variant BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS phase_type TEXT DEFAULT 'main';

-- 1.5 Create role_aliases table for fallback substitutions
CREATE TABLE IF NOT EXISTS public.role_aliases (
  id TEXT PRIMARY KEY,
  alias_for TEXT NOT NULL REFERENCES public.training_roles(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.role_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Role aliases are publicly readable" ON public.role_aliases;
CREATE POLICY "Role aliases are publicly readable" 
ON public.role_aliases FOR SELECT 
USING (true);

-- 1.6 Create user_exercise_history table for anti-repetition tracking
CREATE TABLE IF NOT EXISTS public.user_exercise_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  exercise_id UUID REFERENCES public.exercises(id) ON DELETE SET NULL,
  role_id TEXT NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  plan_id UUID REFERENCES public.user_workout_plans(id) ON DELETE SET NULL,
  day_letter TEXT
);

ALTER TABLE public.user_exercise_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own exercise history" ON public.user_exercise_history;
CREATE POLICY "Users can view their own exercise history" 
ON public.user_exercise_history FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own exercise history" ON public.user_exercise_history;
CREATE POLICY "Users can insert their own exercise history" 
ON public.user_exercise_history FOR INSERT 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own exercise history" ON public.user_exercise_history;
CREATE POLICY "Users can delete their own exercise history" 
ON public.user_exercise_history FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for efficient history queries
CREATE INDEX IF NOT EXISTS idx_user_exercise_history_user_role 
ON public.user_exercise_history(user_id, role_id, used_at DESC);

-- 1.7 Add new training roles for shoulder health and core
INSERT INTO public.training_roles (id, name, category, description, phase_type, has_bodyweight_variant)
VALUES 
  ('rear_delt_isolation', 'Zadní ramena', 'upper', 'Izolace zadního deltového svalu', 'accessory', true),
  ('upper_back_isolation', 'Horní záda', 'upper', 'Izolace rhomboidů a středního trapézu', 'accessory', true),
  ('anti_lateral_flexion', 'Boční stabilizace', 'core', 'Anti-laterální flexe - šikmé břišní', 'core', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  phase_type = EXCLUDED.phase_type,
  has_bodyweight_variant = EXCLUDED.has_bodyweight_variant;

-- Insert role aliases for fallback substitution using correct role IDs from DB
INSERT INTO public.role_aliases (id, alias_for, priority)
VALUES 
  ('push_general', 'horizontal_push', 1),
  ('chest_press_variant', 'horizontal_push', 2),
  ('pulldown_variant', 'vertical_pull', 1),
  ('pullup_variant', 'vertical_pull', 2),
  ('squat_light', 'squat', 1),
  ('lunge_alias', 'lunge', 1),
  ('hip_hinge_light', 'hinge', 1),
  ('glute_bridge', 'hinge', 2)
ON CONFLICT (id) DO NOTHING;

-- Add role_muscles mappings for new roles
INSERT INTO public.role_muscles (role_id, muscle, is_primary)
VALUES 
  ('rear_delt_isolation', 'rear_shoulders', true),
  ('rear_delt_isolation', 'middle_back', false),
  ('upper_back_isolation', 'rhomboids', true),
  ('upper_back_isolation', 'middle_trapezius', true),
  ('anti_lateral_flexion', 'obliques', true),
  ('anti_lateral_flexion', 'core_stabilizers', true)
ON CONFLICT DO NOTHING;

-- Fix incorrect role_muscles mappings
DELETE FROM public.role_muscles 
WHERE role_id = 'horizontal_push' AND muscle = 'rhomboids';

DELETE FROM public.role_muscles 
WHERE role_id = 'squat' AND muscle = 'back_thighs';

-- Ensure hinge has correct mappings
INSERT INTO public.role_muscles (role_id, muscle, is_primary)
VALUES 
  ('hinge', 'back_thighs', true),
  ('hinge', 'glutes', true),
  ('hinge', 'core_stabilizers', false)
ON CONFLICT DO NOTHING;

-- Create atomic function for workout plan generation
CREATE OR REPLACE FUNCTION public.generate_workout_plan_atomic(
  p_user_id UUID,
  p_gym_id UUID,
  p_goal_id TEXT,
  p_exercises JSONB,
  p_inputs_snapshot JSONB,
  p_training_days TEXT[],
  p_generator_version TEXT,
  p_methodology_version TEXT,
  p_selection_seed TEXT,
  p_validation_report JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_plan_id UUID;
BEGIN
  -- Deactivate existing active plans for this user
  UPDATE public.user_workout_plans 
  SET is_active = false, updated_at = now()
  WHERE user_id = p_user_id AND is_active = true;
  
  -- Create new plan with full snapshot
  INSERT INTO public.user_workout_plans (
    user_id, 
    gym_id, 
    goal_id, 
    is_active, 
    training_days, 
    generator_version, 
    methodology_version,
    selection_seed, 
    inputs_snapshot_json,
    validation_report_json,
    started_at
  ) VALUES (
    p_user_id, 
    p_gym_id, 
    p_goal_id, 
    true,
    p_training_days, 
    p_generator_version, 
    p_methodology_version,
    p_selection_seed, 
    p_inputs_snapshot,
    p_validation_report,
    now()
  ) RETURNING id INTO v_plan_id;
  
  -- Insert exercises from JSONB array
  INSERT INTO public.user_workout_exercises (
    plan_id, 
    day_letter, 
    slot_order, 
    role_id, 
    exercise_id, 
    sets, 
    rep_min, 
    rep_max,
    is_fallback, 
    fallback_reason, 
    selection_score
  )
  SELECT 
    v_plan_id,
    (ex->>'day_letter')::TEXT,
    (ex->>'slot_order')::INTEGER,
    (ex->>'role_id')::TEXT,
    NULLIF(ex->>'exercise_id', '')::UUID,
    (ex->>'sets')::INTEGER,
    (ex->>'rep_min')::INTEGER,
    (ex->>'rep_max')::INTEGER,
    COALESCE((ex->>'is_fallback')::BOOLEAN, false),
    NULLIF(ex->>'fallback_reason', ''),
    (ex->>'selection_score')::NUMERIC
  FROM jsonb_array_elements(p_exercises) AS ex;
  
  RETURN v_plan_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;