-- Update RPC to accept and store split_type parameter
CREATE OR REPLACE FUNCTION public.generate_workout_plan_atomic(
  p_user_id uuid, 
  p_gym_id uuid, 
  p_goal_id text, 
  p_exercises jsonb, 
  p_inputs_snapshot jsonb, 
  p_training_days text[], 
  p_generator_version text, 
  p_methodology_version text, 
  p_selection_seed text, 
  p_validation_report jsonb DEFAULT NULL::jsonb,
  p_split_type text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_plan_id UUID;
BEGIN
  -- Deactivate existing active plans for this user
  UPDATE public.user_workout_plans 
  SET is_active = false, updated_at = now()
  WHERE user_id = p_user_id AND is_active = true;
  
  -- Create new plan with full snapshot including split_type
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
    split_type,
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
    p_split_type,
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
$function$;