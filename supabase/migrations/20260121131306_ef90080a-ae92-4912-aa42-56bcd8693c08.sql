-- Create role_muscles table for mapping training roles to muscles
CREATE TABLE public.role_muscles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id text NOT NULL,
  muscle text NOT NULL,
  is_primary boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(role_id, muscle)
);

-- Enable RLS
ALTER TABLE public.role_muscles ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Role muscles are publicly readable" 
ON public.role_muscles 
FOR SELECT 
USING (true);

-- Insert all role-muscle mappings based on the document
-- HORIZONTAL_PUSH
INSERT INTO public.role_muscles (role_id, muscle, is_primary) VALUES
('horizontal_push', 'chest_muscles', true),
('horizontal_push', 'front_shoulders', true),
('horizontal_push', 'triceps', true);

-- VERTICAL_PUSH
INSERT INTO public.role_muscles (role_id, muscle, is_primary) VALUES
('vertical_push', 'front_shoulders', true),
('vertical_push', 'side_shoulders', true),
('vertical_push', 'triceps', true),
('vertical_push', 'upper_trapezius', false);

-- HORIZONTAL_PULL
INSERT INTO public.role_muscles (role_id, muscle, is_primary) VALUES
('horizontal_pull', 'middle_back', true),
('horizontal_pull', 'rear_shoulders', true),
('horizontal_pull', 'biceps', true),
('horizontal_pull', 'rhomboid_major', false),
('horizontal_pull', 'rhomboid_minor', false);

-- VERTICAL_PULL
INSERT INTO public.role_muscles (role_id, muscle, is_primary) VALUES
('vertical_pull', 'wide_back_muscles', true),
('vertical_pull', 'biceps', true),
('vertical_pull', 'rear_shoulders', false),
('vertical_pull', 'forearms', false);

-- SQUAT
INSERT INTO public.role_muscles (role_id, muscle, is_primary) VALUES
('squat', 'front_thighs', true),
('squat', 'glutes', true),
('squat', 'back_thighs', false),
('squat', 'core_stabilizers', false);

-- HIP_HINGE
INSERT INTO public.role_muscles (role_id, muscle, is_primary) VALUES
('hip_hinge', 'back_thighs', true),
('hip_hinge', 'glutes', true),
('hip_hinge', 'lower_back', true);

-- LUNGE
INSERT INTO public.role_muscles (role_id, muscle, is_primary) VALUES
('lunge', 'front_thighs', true),
('lunge', 'glutes', true),
('lunge', 'back_thighs', false),
('lunge', 'stabilizing_muscles', false);

-- SINGLE_LEG
INSERT INTO public.role_muscles (role_id, muscle, is_primary) VALUES
('single_leg', 'front_thighs', true),
('single_leg', 'glutes', true),
('single_leg', 'stabilizing_muscles', true);

-- KNEE_FLEXION
INSERT INTO public.role_muscles (role_id, muscle, is_primary) VALUES
('knee_flexion', 'back_thighs', true);

-- KNEE_EXTENSION
INSERT INTO public.role_muscles (role_id, muscle, is_primary) VALUES
('knee_extension', 'front_thighs', true);

-- HIP_ABDUCTION
INSERT INTO public.role_muscles (role_id, muscle, is_primary) VALUES
('hip_abduction', 'side_glutes', true),
('hip_abduction', 'outer_thighs', true);

-- HIP_ADDUCTION
INSERT INTO public.role_muscles (role_id, muscle, is_primary) VALUES
('hip_adduction', 'inner_thighs', true);

-- CALF_WORK
INSERT INTO public.role_muscles (role_id, muscle, is_primary) VALUES
('calf_work', 'calves', true);

-- GLUTE_ISOLATION
INSERT INTO public.role_muscles (role_id, muscle, is_primary) VALUES
('glute_isolation', 'glutes', true),
('glute_isolation', 'side_glutes', false);

-- ANTI_EXTENSION
INSERT INTO public.role_muscles (role_id, muscle, is_primary) VALUES
('anti_extension', 'abs', true),
('anti_extension', 'deep_core_muscles', true);

-- ANTI_ROTATION
INSERT INTO public.role_muscles (role_id, muscle, is_primary) VALUES
('anti_rotation', 'obliques', true),
('anti_rotation', 'deep_core_muscles', true);

-- ANTI_LATERAL_FLEXION
INSERT INTO public.role_muscles (role_id, muscle, is_primary) VALUES
('anti_lateral_flexion', 'obliques', true),
('anti_lateral_flexion', 'core_stabilizers', true);

-- SPINAL_FLEXION
INSERT INTO public.role_muscles (role_id, muscle, is_primary) VALUES
('spinal_flexion', 'abs', true);

-- HIP_FLEXION
INSERT INTO public.role_muscles (role_id, muscle, is_primary) VALUES
('hip_flexion', 'hip_flexors', true),
('hip_flexion', 'abs', false);

-- BICEPS_ISOLATION
INSERT INTO public.role_muscles (role_id, muscle, is_primary) VALUES
('biceps_isolation', 'biceps', true),
('biceps_isolation', 'forearms', false);

-- TRICEPS_ISOLATION
INSERT INTO public.role_muscles (role_id, muscle, is_primary) VALUES
('triceps_isolation', 'triceps', true);

-- SHOULDER_ISOLATION
INSERT INTO public.role_muscles (role_id, muscle, is_primary) VALUES
('shoulder_isolation', 'side_shoulders', true),
('shoulder_isolation', 'rear_shoulders', true),
('shoulder_isolation', 'front_shoulders', false);

-- CYCLICAL_CARDIO
INSERT INTO public.role_muscles (role_id, muscle, is_primary) VALUES
('cyclical_cardio', 'front_thighs', true),
('cyclical_cardio', 'back_thighs', true),
('cyclical_cardio', 'glutes', true),
('cyclical_cardio', 'calves', false);