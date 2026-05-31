-- ============================================================================
-- MIGRATION: Expand day_templates with slot_category + tag exercises
--
-- 1. Add slot_category, rir_min, rir_max, notes columns to day_templates
-- 2. Delete old 4-slot templates, insert expanded 6-7 slot templates
-- 3. Update training_roles.phase_type to match slot categories
-- 4. Tag exercises with slot_type and is_compound based on primary_role
-- ============================================================================

-- ============================================================================
-- STEP 1: Add missing columns to day_templates
-- ============================================================================
ALTER TABLE public.day_templates
  ADD COLUMN IF NOT EXISTS slot_category TEXT DEFAULT 'secondary',
  ADD COLUMN IF NOT EXISTS rir_min INTEGER,
  ADD COLUMN IF NOT EXISTS rir_max INTEGER,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- ============================================================================
-- STEP 2: Clear old templates and insert expanded ones
-- ============================================================================
DELETE FROM day_templates;

-- --------------------------------------------------------------------------
-- PPL (muscle_gain) — split_type = 'ppl'
-- --------------------------------------------------------------------------

-- Push (A) — 7 slots
INSERT INTO day_templates (goal_id, split_type, day_letter, day_name, slot_order, role_id, slot_category, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max, rir_min, rir_max) VALUES
  ('muscle_gain', 'ppl', 'A', 'Push', 1, 'horizontal_push',          'main',                 3, 4, 5,  6, 10, 1, 3),
  ('muscle_gain', 'ppl', 'A', 'Push', 2, 'vertical_push',            'secondary',             2, 3, 4,  8, 12, 2, 3),
  ('muscle_gain', 'ppl', 'A', 'Push', 3, 'horizontal_push',          'secondary',             2, 3, 3, 10, 15, 2, 3),
  ('muscle_gain', 'ppl', 'A', 'Push', 4, 'elbow_extension',          'isolation',             2, 3, 3, 10, 15, 2, 4),
  ('muscle_gain', 'ppl', 'A', 'Push', 5, 'shoulder_abduction',       'isolation',             2, 3, 3, 12, 15, 2, 4),
  ('muscle_gain', 'ppl', 'A', 'Push', 6, 'anti_extension',           'core_or_compensatory',  2, 2, 3, 12, 20, NULL, NULL),
  ('muscle_gain', 'ppl', 'A', 'Push', 7, 'cyclical_push',            'conditioning',          1, 2, 2, 10, 15, NULL, NULL);

-- Pull (B) — 7 slots
INSERT INTO day_templates (goal_id, split_type, day_letter, day_name, slot_order, role_id, slot_category, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max, rir_min, rir_max) VALUES
  ('muscle_gain', 'ppl', 'B', 'Pull', 1, 'horizontal_pull',          'main',                 3, 4, 5,  6, 10, 1, 3),
  ('muscle_gain', 'ppl', 'B', 'Pull', 2, 'vertical_pull',            'secondary',             2, 3, 4,  8, 12, 2, 3),
  ('muscle_gain', 'ppl', 'B', 'Pull', 3, 'horizontal_pull',          'secondary',             2, 3, 3, 10, 15, 2, 3),
  ('muscle_gain', 'ppl', 'B', 'Pull', 4, 'elbow_flexion',            'isolation',             2, 3, 3, 10, 15, 2, 4),
  ('muscle_gain', 'ppl', 'B', 'Pull', 5, 'shoulder_external_rotation','isolation',             2, 3, 3, 12, 15, 2, 4),
  ('muscle_gain', 'ppl', 'B', 'Pull', 6, 'anti_rotation',            'core_or_compensatory',  2, 2, 3, 12, 20, NULL, NULL),
  ('muscle_gain', 'ppl', 'B', 'Pull', 7, 'cyclical_pull',            'conditioning',          1, 2, 2, 10, 15, NULL, NULL);

-- Legs (C) — 6 slots
INSERT INTO day_templates (goal_id, split_type, day_letter, day_name, slot_order, role_id, slot_category, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max, rir_min, rir_max) VALUES
  ('muscle_gain', 'ppl', 'C', 'Legs', 1, 'squat',                    'main',                 3, 4, 5,  6, 10, 1, 3),
  ('muscle_gain', 'ppl', 'C', 'Legs', 2, 'hinge',                    'main',                 2, 3, 4,  8, 12, 1, 3),
  ('muscle_gain', 'ppl', 'C', 'Legs', 3, 'lunge',                    'secondary',             2, 3, 3, 10, 12, 2, 3),
  ('muscle_gain', 'ppl', 'C', 'Legs', 4, 'step',                     'secondary',             2, 2, 3, 10, 15, 2, 4),
  ('muscle_gain', 'ppl', 'C', 'Legs', 5, 'anti_extension',           'core_or_compensatory',  2, 3, 3, 12, 20, NULL, NULL),
  ('muscle_gain', 'ppl', 'C', 'Legs', 6, 'cyclical_push',            'conditioning',          1, 2, 2, 10, 15, NULL, NULL);

-- --------------------------------------------------------------------------
-- Upper/Lower (fat_loss) — split_type = 'upper_lower'
-- --------------------------------------------------------------------------

-- Horní tělo (A) — 7 slots
INSERT INTO day_templates (goal_id, split_type, day_letter, day_name, slot_order, role_id, slot_category, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max, rir_min, rir_max) VALUES
  ('fat_loss', 'upper_lower', 'A', 'Horní tělo', 1, 'horizontal_push',          'main',                 2, 3, 3, 10, 15, 2, 3),
  ('fat_loss', 'upper_lower', 'A', 'Horní tělo', 2, 'horizontal_pull',          'main',                 2, 3, 3, 10, 15, 2, 3),
  ('fat_loss', 'upper_lower', 'A', 'Horní tělo', 3, 'vertical_push',            'secondary',             2, 2, 3, 10, 15, 2, 3),
  ('fat_loss', 'upper_lower', 'A', 'Horní tělo', 4, 'vertical_pull',            'secondary',             2, 2, 3, 10, 15, 2, 3),
  ('fat_loss', 'upper_lower', 'A', 'Horní tělo', 5, 'elbow_extension',          'isolation',             2, 2, 3, 12, 15, 2, 4),
  ('fat_loss', 'upper_lower', 'A', 'Horní tělo', 6, 'anti_extension',           'core_or_compensatory',  2, 2, 3, 12, 15, NULL, NULL),
  ('fat_loss', 'upper_lower', 'A', 'Horní tělo', 7, 'cyclical_push',            'conditioning',          1, 2, 2, 10, 15, NULL, NULL);

-- Dolní tělo (B) — 6 slots
INSERT INTO day_templates (goal_id, split_type, day_letter, day_name, slot_order, role_id, slot_category, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max, rir_min, rir_max) VALUES
  ('fat_loss', 'upper_lower', 'B', 'Dolní tělo', 1, 'squat',                    'main',                 2, 3, 3, 10, 15, 2, 3),
  ('fat_loss', 'upper_lower', 'B', 'Dolní tělo', 2, 'hinge',                    'main',                 2, 3, 3, 10, 15, 2, 3),
  ('fat_loss', 'upper_lower', 'B', 'Dolní tělo', 3, 'lunge',                    'secondary',             2, 2, 3, 12, 15, 2, 3),
  ('fat_loss', 'upper_lower', 'B', 'Dolní tělo', 4, 'step',                     'secondary',             2, 2, 3, 12, 15, 2, 4),
  ('fat_loss', 'upper_lower', 'B', 'Dolní tělo', 5, 'anti_extension',           'core_or_compensatory',  2, 2, 3, 12, 15, NULL, NULL),
  ('fat_loss', 'upper_lower', 'B', 'Dolní tělo', 6, 'cyclical_pull',            'conditioning',          1, 2, 2, 10, 15, NULL, NULL);

-- --------------------------------------------------------------------------
-- Upper/Lower (strength) — split_type = 'upper_lower'
-- --------------------------------------------------------------------------

-- Horní tělo (A) — 7 slots
INSERT INTO day_templates (goal_id, split_type, day_letter, day_name, slot_order, role_id, slot_category, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max, rir_min, rir_max) VALUES
  ('strength', 'upper_lower', 'A', 'Horní tělo', 1, 'horizontal_push',          'main',                 3, 4, 5, 3, 6, 0, 2),
  ('strength', 'upper_lower', 'A', 'Horní tělo', 2, 'horizontal_pull',          'main',                 3, 4, 5, 3, 6, 0, 2),
  ('strength', 'upper_lower', 'A', 'Horní tělo', 3, 'vertical_push',            'secondary',             2, 3, 4, 5, 8, 1, 3),
  ('strength', 'upper_lower', 'A', 'Horní tělo', 4, 'vertical_pull',            'secondary',             2, 3, 4, 5, 8, 1, 3),
  ('strength', 'upper_lower', 'A', 'Horní tělo', 5, 'elbow_extension',          'isolation',             2, 3, 3, 8, 12, 2, 4),
  ('strength', 'upper_lower', 'A', 'Horní tělo', 6, 'anti_extension',           'core_or_compensatory',  2, 2, 3, 8, 12, NULL, NULL),
  ('strength', 'upper_lower', 'A', 'Horní tělo', 7, 'cyclical_push',            'conditioning',          1, 2, 2, 8, 12, NULL, NULL);

-- Dolní tělo (B) — 6 slots
INSERT INTO day_templates (goal_id, split_type, day_letter, day_name, slot_order, role_id, slot_category, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max, rir_min, rir_max) VALUES
  ('strength', 'upper_lower', 'B', 'Dolní tělo', 1, 'squat',                    'main',                 3, 4, 5, 3, 6, 0, 2),
  ('strength', 'upper_lower', 'B', 'Dolní tělo', 2, 'hinge',                    'main',                 3, 4, 5, 3, 6, 0, 2),
  ('strength', 'upper_lower', 'B', 'Dolní tělo', 3, 'lunge',                    'secondary',             2, 3, 3, 6, 8, 1, 3),
  ('strength', 'upper_lower', 'B', 'Dolní tělo', 4, 'step',                     'secondary',             2, 2, 3, 6, 8, 2, 3),
  ('strength', 'upper_lower', 'B', 'Dolní tělo', 5, 'anti_extension',           'core_or_compensatory',  2, 2, 3, 8, 12, NULL, NULL),
  ('strength', 'upper_lower', 'B', 'Dolní tělo', 6, 'cyclical_pull',            'conditioning',          1, 2, 2, 8, 12, NULL, NULL);

-- --------------------------------------------------------------------------
-- Full Body (general_fitness) — split_type = 'full_body'
-- --------------------------------------------------------------------------

-- Celé tělo A — 7 slots
INSERT INTO day_templates (goal_id, split_type, day_letter, day_name, slot_order, role_id, slot_category, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max, rir_min, rir_max) VALUES
  ('general_fitness', 'full_body', 'A', 'Celé tělo A', 1, 'squat',              'main',                 2, 3, 3, 10, 12, 2, 3),
  ('general_fitness', 'full_body', 'A', 'Celé tělo A', 2, 'horizontal_push',    'main',                 2, 3, 3, 10, 12, 2, 3),
  ('general_fitness', 'full_body', 'A', 'Celé tělo A', 3, 'horizontal_pull',    'secondary',             2, 3, 3, 10, 12, 2, 3),
  ('general_fitness', 'full_body', 'A', 'Celé tělo A', 4, 'lunge',              'secondary',             2, 2, 3, 10, 12, 2, 4),
  ('general_fitness', 'full_body', 'A', 'Celé tělo A', 5, 'elbow_flexion',      'isolation',             2, 2, 3, 10, 15, 2, 4),
  ('general_fitness', 'full_body', 'A', 'Celé tělo A', 6, 'anti_extension',     'core_or_compensatory',  2, 2, 3, 12, 15, NULL, NULL),
  ('general_fitness', 'full_body', 'A', 'Celé tělo A', 7, 'cyclical_push',      'conditioning',          1, 2, 2, 10, 12, NULL, NULL);

-- Celé tělo B — 7 slots
INSERT INTO day_templates (goal_id, split_type, day_letter, day_name, slot_order, role_id, slot_category, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max, rir_min, rir_max) VALUES
  ('general_fitness', 'full_body', 'B', 'Celé tělo B', 1, 'hinge',              'main',                 2, 3, 3, 10, 12, 2, 3),
  ('general_fitness', 'full_body', 'B', 'Celé tělo B', 2, 'vertical_push',      'main',                 2, 3, 3, 10, 12, 2, 3),
  ('general_fitness', 'full_body', 'B', 'Celé tělo B', 3, 'vertical_pull',      'secondary',             2, 3, 3, 10, 12, 2, 3),
  ('general_fitness', 'full_body', 'B', 'Celé tělo B', 4, 'step',               'secondary',             2, 2, 3, 10, 12, 2, 4),
  ('general_fitness', 'full_body', 'B', 'Celé tělo B', 5, 'elbow_extension',    'isolation',             2, 2, 3, 10, 15, 2, 4),
  ('general_fitness', 'full_body', 'B', 'Celé tělo B', 6, 'anti_rotation',      'core_or_compensatory',  2, 2, 3, 12, 15, NULL, NULL),
  ('general_fitness', 'full_body', 'B', 'Celé tělo B', 7, 'cyclical_pull',      'conditioning',          1, 2, 2, 10, 12, NULL, NULL);

-- ============================================================================
-- STEP 3: Update training_roles.phase_type based on training hierarchy
-- ============================================================================
-- Main compounds
UPDATE public.training_roles SET phase_type = 'main'
WHERE id IN ('horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull', 'squat', 'hinge');

-- Secondary compounds
UPDATE public.training_roles SET phase_type = 'secondary'
WHERE id IN ('lunge', 'step', 'jump', 'shoulder_abduction', 'shoulder_adduction');

-- Isolation
UPDATE public.training_roles SET phase_type = 'accessory'
WHERE id IN (
  'elbow_flexion', 'elbow_extension',
  'shoulder_external_rotation', 'shoulder_internal_rotation',
  'rear_delt_isolation', 'upper_back_isolation',
  'biceps_isolation', 'triceps_isolation'
);

-- Core
UPDATE public.training_roles SET phase_type = 'core'
WHERE id IN ('anti_extension', 'anti_flexion', 'anti_rotation', 'rotation', 'lateral_flexion', 'anti_lateral_flexion');

-- Conditioning
UPDATE public.training_roles SET phase_type = 'secondary'
WHERE id IN ('cyclical_push', 'cyclical_pull', 'full_body_pull');

-- ============================================================================
-- STEP 4: Tag exercises based on primary_role
-- ============================================================================

-- Mark compound exercises (multi-joint movements)
UPDATE public.exercises SET is_compound = true, slot_type = 'main'
WHERE primary_role IN ('horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull', 'squat', 'hinge');

-- Mark secondary compound exercises
UPDATE public.exercises SET is_compound = true, slot_type = 'secondary'
WHERE primary_role IN ('lunge', 'step', 'jump');

-- Mark isolation exercises
UPDATE public.exercises SET is_compound = false, slot_type = 'isolation'
WHERE primary_role IN (
  'elbow_flexion', 'elbow_extension',
  'shoulder_abduction', 'shoulder_adduction',
  'shoulder_external_rotation', 'shoulder_internal_rotation',
  'rear_delt_isolation', 'upper_back_isolation',
  'biceps_isolation', 'triceps_isolation'
);

-- Mark core exercises
UPDATE public.exercises SET is_compound = false, slot_type = 'core'
WHERE primary_role IN ('anti_extension', 'anti_flexion', 'anti_rotation', 'rotation', 'lateral_flexion', 'anti_lateral_flexion');

-- Mark conditioning exercises
UPDATE public.exercises SET is_compound = false, slot_type = 'conditioning'
WHERE primary_role IN ('cyclical_push', 'cyclical_pull', 'full_body_pull')
   OR category = 'cardio';
