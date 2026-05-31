-- ============================================================================
-- COMPLETE MIGRATION: All day_templates for all goal+split combos + avatar
--
-- This replaces:
--   20260315_expand_templates_and_tag_exercises.sql
--   20260318_add_avatar_url.sql
--   20260319_add_muscle_gain_upper_lower_templates.sql
--
-- Run this ONCE in Supabase SQL editor.
-- ============================================================================

-- ============================================================================
-- STEP 1: Add missing columns
-- ============================================================================
ALTER TABLE public.day_templates
  ADD COLUMN IF NOT EXISTS slot_category TEXT DEFAULT 'secondary',
  ADD COLUMN IF NOT EXISTS rir_min INTEGER,
  ADD COLUMN IF NOT EXISTS rir_max INTEGER,
  ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- ============================================================================
-- STEP 2: Avatar storage bucket + policies
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can upload own avatar') THEN
    CREATE POLICY "Users can upload own avatar"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own avatar') THEN
    CREATE POLICY "Users can update own avatar"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Avatars are publicly accessible') THEN
    CREATE POLICY "Avatars are publicly accessible"
    ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'avatars');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own avatar') THEN
    CREATE POLICY "Users can delete own avatar"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Delete ALL old templates and insert complete set
-- NOTE: Rep ranges and RIR in templates are DEFAULTS.
--       The generator overrides them via getRepRangeForGoal() and getRpeForGoal().
-- ============================================================================
DELETE FROM day_templates;

-- ============================================================================
-- MUSCLE_GAIN (Hypertrofie)
-- ============================================================================

-- ---------- muscle_gain + full_body (1-3 dny) ----------
-- Den A: Squat-focused
INSERT INTO day_templates (goal_id, split_type, day_letter, day_name, slot_order, role_id, slot_category, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max, rir_min, rir_max) VALUES
  ('muscle_gain', 'full_body', 'A', 'Celé tělo A', 1, 'squat',              'main',                 3, 4, 5,  6, 10, 1, 3),
  ('muscle_gain', 'full_body', 'A', 'Celé tělo A', 2, 'horizontal_push',    'main',                 2, 3, 4,  6, 10, 1, 3),
  ('muscle_gain', 'full_body', 'A', 'Celé tělo A', 3, 'horizontal_pull',    'secondary',             2, 3, 3,  8, 12, 2, 3),
  ('muscle_gain', 'full_body', 'A', 'Celé tělo A', 4, 'lunge',              'secondary',             2, 2, 3, 10, 12, 2, 4),
  ('muscle_gain', 'full_body', 'A', 'Celé tělo A', 5, 'elbow_flexion',      'isolation',             2, 2, 3, 10, 15, 2, 4),
  ('muscle_gain', 'full_body', 'A', 'Celé tělo A', 6, 'anti_extension',     'core_or_compensatory',  2, 2, 3, 12, 20, NULL, NULL),
  ('muscle_gain', 'full_body', 'A', 'Celé tělo A', 7, 'cyclical_push',      'conditioning',          1, 2, 2, 10, 15, NULL, NULL);

-- Den B: Hinge-focused
INSERT INTO day_templates (goal_id, split_type, day_letter, day_name, slot_order, role_id, slot_category, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max, rir_min, rir_max) VALUES
  ('muscle_gain', 'full_body', 'B', 'Celé tělo B', 1, 'hinge',              'main',                 3, 4, 5,  6, 10, 1, 3),
  ('muscle_gain', 'full_body', 'B', 'Celé tělo B', 2, 'vertical_push',      'main',                 2, 3, 4,  6, 10, 1, 3),
  ('muscle_gain', 'full_body', 'B', 'Celé tělo B', 3, 'vertical_pull',      'secondary',             2, 3, 3,  8, 12, 2, 3),
  ('muscle_gain', 'full_body', 'B', 'Celé tělo B', 4, 'step',               'secondary',             2, 2, 3, 10, 12, 2, 4),
  ('muscle_gain', 'full_body', 'B', 'Celé tělo B', 5, 'elbow_extension',    'isolation',             2, 2, 3, 10, 15, 2, 4),
  ('muscle_gain', 'full_body', 'B', 'Celé tělo B', 6, 'anti_rotation',      'core_or_compensatory',  2, 2, 3, 12, 20, NULL, NULL),
  ('muscle_gain', 'full_body', 'B', 'Celé tělo B', 7, 'cyclical_pull',      'conditioning',          1, 2, 2, 10, 15, NULL, NULL);

-- ---------- muscle_gain + upper_lower (4 dny) ----------
-- Horní tělo (A)
INSERT INTO day_templates (goal_id, split_type, day_letter, day_name, slot_order, role_id, slot_category, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max, rir_min, rir_max) VALUES
  ('muscle_gain', 'upper_lower', 'A', 'Horní tělo', 1, 'horizontal_push',          'main',                 3, 4, 5,  4, 8, 1, 3),
  ('muscle_gain', 'upper_lower', 'A', 'Horní tělo', 2, 'horizontal_pull',          'main',                 3, 4, 5,  4, 8, 1, 3),
  ('muscle_gain', 'upper_lower', 'A', 'Horní tělo', 3, 'vertical_push',            'secondary',             2, 3, 4,  6, 12, 2, 3),
  ('muscle_gain', 'upper_lower', 'A', 'Horní tělo', 4, 'vertical_pull',            'secondary',             2, 3, 4,  6, 12, 2, 3),
  ('muscle_gain', 'upper_lower', 'A', 'Horní tělo', 5, 'elbow_extension',          'isolation',             2, 3, 3,  8, 15, 2, 4),
  ('muscle_gain', 'upper_lower', 'A', 'Horní tělo', 6, 'shoulder_abduction',       'isolation',             2, 3, 3,  8, 15, 2, 4),
  ('muscle_gain', 'upper_lower', 'A', 'Horní tělo', 7, 'anti_extension',           'core_or_compensatory',  2, 2, 3, 12, 20, NULL, NULL);

-- Dolní tělo (B) — combines squat + hinge patterns
INSERT INTO day_templates (goal_id, split_type, day_letter, day_name, slot_order, role_id, slot_category, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max, rir_min, rir_max) VALUES
  ('muscle_gain', 'upper_lower', 'B', 'Dolní tělo', 1, 'squat',                    'main',                 3, 4, 5,  4, 8, 1, 3),
  ('muscle_gain', 'upper_lower', 'B', 'Dolní tělo', 2, 'hinge',                    'main',                 3, 4, 5,  4, 8, 1, 3),
  ('muscle_gain', 'upper_lower', 'B', 'Dolní tělo', 3, 'lunge',                    'secondary',             2, 3, 3,  6, 12, 2, 3),
  ('muscle_gain', 'upper_lower', 'B', 'Dolní tělo', 4, 'elbow_flexion',            'isolation',             2, 3, 3,  8, 15, 2, 4),
  ('muscle_gain', 'upper_lower', 'B', 'Dolní tělo', 5, 'shoulder_external_rotation','isolation',             2, 3, 3,  8, 15, 2, 4),
  ('muscle_gain', 'upper_lower', 'B', 'Dolní tělo', 6, 'anti_rotation',            'core_or_compensatory',  2, 2, 3, 12, 20, NULL, NULL),
  ('muscle_gain', 'upper_lower', 'B', 'Dolní tělo', 7, 'cyclical_push',            'conditioning',          1, 2, 2, 10, 15, NULL, NULL);

-- ---------- muscle_gain + ppl (5+ dní) ----------
-- Push (A)
INSERT INTO day_templates (goal_id, split_type, day_letter, day_name, slot_order, role_id, slot_category, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max, rir_min, rir_max) VALUES
  ('muscle_gain', 'ppl', 'A', 'Push', 1, 'horizontal_push',          'main',                 3, 4, 5,  4, 8, 1, 2),
  ('muscle_gain', 'ppl', 'A', 'Push', 2, 'vertical_push',            'secondary',             2, 3, 4,  6, 12, 1, 2),
  ('muscle_gain', 'ppl', 'A', 'Push', 3, 'horizontal_push',          'secondary',             2, 3, 3,  6, 12, 1, 2),
  ('muscle_gain', 'ppl', 'A', 'Push', 4, 'elbow_extension',          'isolation',             2, 3, 3,  8, 15, 0, 2),
  ('muscle_gain', 'ppl', 'A', 'Push', 5, 'shoulder_abduction',       'isolation',             2, 3, 3,  8, 15, 0, 2),
  ('muscle_gain', 'ppl', 'A', 'Push', 6, 'anti_extension',           'core_or_compensatory',  2, 2, 3, 12, 20, NULL, NULL),
  ('muscle_gain', 'ppl', 'A', 'Push', 7, 'cyclical_push',            'conditioning',          1, 2, 2, 10, 15, NULL, NULL);

-- Pull (B)
INSERT INTO day_templates (goal_id, split_type, day_letter, day_name, slot_order, role_id, slot_category, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max, rir_min, rir_max) VALUES
  ('muscle_gain', 'ppl', 'B', 'Pull', 1, 'horizontal_pull',          'main',                 3, 4, 5,  4, 8, 1, 2),
  ('muscle_gain', 'ppl', 'B', 'Pull', 2, 'vertical_pull',            'secondary',             2, 3, 4,  6, 12, 1, 2),
  ('muscle_gain', 'ppl', 'B', 'Pull', 3, 'horizontal_pull',          'secondary',             2, 3, 3,  6, 12, 1, 2),
  ('muscle_gain', 'ppl', 'B', 'Pull', 4, 'elbow_flexion',            'isolation',             2, 3, 3,  8, 15, 0, 2),
  ('muscle_gain', 'ppl', 'B', 'Pull', 5, 'shoulder_external_rotation','isolation',             2, 3, 3,  8, 15, 0, 2),
  ('muscle_gain', 'ppl', 'B', 'Pull', 6, 'anti_rotation',            'core_or_compensatory',  2, 2, 3, 12, 20, NULL, NULL),
  ('muscle_gain', 'ppl', 'B', 'Pull', 7, 'cyclical_pull',            'conditioning',          1, 2, 2, 10, 15, NULL, NULL);

-- Legs (C)
INSERT INTO day_templates (goal_id, split_type, day_letter, day_name, slot_order, role_id, slot_category, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max, rir_min, rir_max) VALUES
  ('muscle_gain', 'ppl', 'C', 'Legs', 1, 'squat',                    'main',                 3, 4, 5,  4, 8, 1, 2),
  ('muscle_gain', 'ppl', 'C', 'Legs', 2, 'hinge',                    'main',                 2, 3, 4,  6, 12, 1, 2),
  ('muscle_gain', 'ppl', 'C', 'Legs', 3, 'lunge',                    'secondary',             2, 3, 3,  6, 12, 1, 2),
  ('muscle_gain', 'ppl', 'C', 'Legs', 4, 'step',                     'isolation',             2, 2, 3,  8, 15, 0, 2),
  ('muscle_gain', 'ppl', 'C', 'Legs', 5, 'anti_extension',           'core_or_compensatory',  2, 3, 3, 12, 20, NULL, NULL),
  ('muscle_gain', 'ppl', 'C', 'Legs', 6, 'cyclical_push',            'conditioning',          1, 2, 2, 10, 15, NULL, NULL);

-- ============================================================================
-- FAT_LOSS (Hubnutí)
-- ============================================================================

-- ---------- fat_loss + full_body (1-3 dny) ----------
INSERT INTO day_templates (goal_id, split_type, day_letter, day_name, slot_order, role_id, slot_category, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max, rir_min, rir_max) VALUES
  ('fat_loss', 'full_body', 'A', 'Celé tělo A', 1, 'squat',              'main',                 2, 3, 3, 10, 15, 2, 3),
  ('fat_loss', 'full_body', 'A', 'Celé tělo A', 2, 'horizontal_push',    'main',                 2, 3, 3, 10, 15, 2, 3),
  ('fat_loss', 'full_body', 'A', 'Celé tělo A', 3, 'horizontal_pull',    'secondary',             2, 2, 3, 10, 15, 2, 3),
  ('fat_loss', 'full_body', 'A', 'Celé tělo A', 4, 'lunge',              'secondary',             2, 2, 3, 12, 15, 2, 4),
  ('fat_loss', 'full_body', 'A', 'Celé tělo A', 5, 'elbow_flexion',      'isolation',             2, 2, 3, 12, 15, 2, 4),
  ('fat_loss', 'full_body', 'A', 'Celé tělo A', 6, 'anti_extension',     'core_or_compensatory',  2, 2, 3, 12, 15, NULL, NULL),
  ('fat_loss', 'full_body', 'A', 'Celé tělo A', 7, 'cyclical_push',      'conditioning',          1, 2, 2, 10, 15, NULL, NULL);

INSERT INTO day_templates (goal_id, split_type, day_letter, day_name, slot_order, role_id, slot_category, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max, rir_min, rir_max) VALUES
  ('fat_loss', 'full_body', 'B', 'Celé tělo B', 1, 'hinge',              'main',                 2, 3, 3, 10, 15, 2, 3),
  ('fat_loss', 'full_body', 'B', 'Celé tělo B', 2, 'vertical_push',      'main',                 2, 3, 3, 10, 15, 2, 3),
  ('fat_loss', 'full_body', 'B', 'Celé tělo B', 3, 'vertical_pull',      'secondary',             2, 2, 3, 10, 15, 2, 3),
  ('fat_loss', 'full_body', 'B', 'Celé tělo B', 4, 'step',               'secondary',             2, 2, 3, 12, 15, 2, 4),
  ('fat_loss', 'full_body', 'B', 'Celé tělo B', 5, 'elbow_extension',    'isolation',             2, 2, 3, 12, 15, 2, 4),
  ('fat_loss', 'full_body', 'B', 'Celé tělo B', 6, 'anti_rotation',      'core_or_compensatory',  2, 2, 3, 12, 15, NULL, NULL),
  ('fat_loss', 'full_body', 'B', 'Celé tělo B', 7, 'cyclical_pull',      'conditioning',          1, 2, 2, 10, 15, NULL, NULL);

-- ---------- fat_loss + upper_lower (4 dny) ----------
INSERT INTO day_templates (goal_id, split_type, day_letter, day_name, slot_order, role_id, slot_category, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max, rir_min, rir_max) VALUES
  ('fat_loss', 'upper_lower', 'A', 'Horní tělo', 1, 'horizontal_push',          'main',                 2, 3, 3, 10, 15, 2, 3),
  ('fat_loss', 'upper_lower', 'A', 'Horní tělo', 2, 'horizontal_pull',          'main',                 2, 3, 3, 10, 15, 2, 3),
  ('fat_loss', 'upper_lower', 'A', 'Horní tělo', 3, 'vertical_push',            'secondary',             2, 2, 3, 10, 15, 2, 3),
  ('fat_loss', 'upper_lower', 'A', 'Horní tělo', 4, 'vertical_pull',            'secondary',             2, 2, 3, 10, 15, 2, 3),
  ('fat_loss', 'upper_lower', 'A', 'Horní tělo', 5, 'elbow_extension',          'isolation',             2, 2, 3, 12, 15, 2, 4),
  ('fat_loss', 'upper_lower', 'A', 'Horní tělo', 6, 'anti_extension',           'core_or_compensatory',  2, 2, 3, 12, 15, NULL, NULL),
  ('fat_loss', 'upper_lower', 'A', 'Horní tělo', 7, 'cyclical_push',            'conditioning',          1, 2, 2, 10, 15, NULL, NULL);

INSERT INTO day_templates (goal_id, split_type, day_letter, day_name, slot_order, role_id, slot_category, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max, rir_min, rir_max) VALUES
  ('fat_loss', 'upper_lower', 'B', 'Dolní tělo', 1, 'squat',                    'main',                 2, 3, 3, 10, 15, 2, 3),
  ('fat_loss', 'upper_lower', 'B', 'Dolní tělo', 2, 'hinge',                    'main',                 2, 3, 3, 10, 15, 2, 3),
  ('fat_loss', 'upper_lower', 'B', 'Dolní tělo', 3, 'lunge',                    'secondary',             2, 2, 3, 12, 15, 2, 3),
  ('fat_loss', 'upper_lower', 'B', 'Dolní tělo', 4, 'step',                     'secondary',             2, 2, 3, 12, 15, 2, 4),
  ('fat_loss', 'upper_lower', 'B', 'Dolní tělo', 5, 'anti_extension',           'core_or_compensatory',  2, 2, 3, 12, 15, NULL, NULL),
  ('fat_loss', 'upper_lower', 'B', 'Dolní tělo', 6, 'cyclical_pull',            'conditioning',          1, 2, 2, 10, 15, NULL, NULL);

-- ---------- fat_loss + ppl (5+ dní) ----------
INSERT INTO day_templates (goal_id, split_type, day_letter, day_name, slot_order, role_id, slot_category, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max, rir_min, rir_max) VALUES
  ('fat_loss', 'ppl', 'A', 'Push', 1, 'horizontal_push',          'main',                 2, 3, 3, 10, 15, 2, 3),
  ('fat_loss', 'ppl', 'A', 'Push', 2, 'vertical_push',            'secondary',             2, 3, 3, 10, 15, 2, 3),
  ('fat_loss', 'ppl', 'A', 'Push', 3, 'horizontal_push',          'secondary',             2, 2, 3, 10, 15, 2, 3),
  ('fat_loss', 'ppl', 'A', 'Push', 4, 'elbow_extension',          'isolation',             2, 2, 3, 12, 15, 2, 4),
  ('fat_loss', 'ppl', 'A', 'Push', 5, 'shoulder_abduction',       'isolation',             2, 2, 3, 12, 15, 2, 4),
  ('fat_loss', 'ppl', 'A', 'Push', 6, 'anti_extension',           'core_or_compensatory',  2, 2, 3, 12, 15, NULL, NULL),
  ('fat_loss', 'ppl', 'A', 'Push', 7, 'cyclical_push',            'conditioning',          1, 2, 2, 10, 15, NULL, NULL);

INSERT INTO day_templates (goal_id, split_type, day_letter, day_name, slot_order, role_id, slot_category, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max, rir_min, rir_max) VALUES
  ('fat_loss', 'ppl', 'B', 'Pull', 1, 'horizontal_pull',          'main',                 2, 3, 3, 10, 15, 2, 3),
  ('fat_loss', 'ppl', 'B', 'Pull', 2, 'vertical_pull',            'secondary',             2, 3, 3, 10, 15, 2, 3),
  ('fat_loss', 'ppl', 'B', 'Pull', 3, 'horizontal_pull',          'secondary',             2, 2, 3, 10, 15, 2, 3),
  ('fat_loss', 'ppl', 'B', 'Pull', 4, 'elbow_flexion',            'isolation',             2, 2, 3, 12, 15, 2, 4),
  ('fat_loss', 'ppl', 'B', 'Pull', 5, 'shoulder_external_rotation','isolation',             2, 2, 3, 12, 15, 2, 4),
  ('fat_loss', 'ppl', 'B', 'Pull', 6, 'anti_rotation',            'core_or_compensatory',  2, 2, 3, 12, 15, NULL, NULL),
  ('fat_loss', 'ppl', 'B', 'Pull', 7, 'cyclical_pull',            'conditioning',          1, 2, 2, 10, 15, NULL, NULL);

INSERT INTO day_templates (goal_id, split_type, day_letter, day_name, slot_order, role_id, slot_category, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max, rir_min, rir_max) VALUES
  ('fat_loss', 'ppl', 'C', 'Legs', 1, 'squat',                    'main',                 2, 3, 3, 10, 15, 2, 3),
  ('fat_loss', 'ppl', 'C', 'Legs', 2, 'hinge',                    'main',                 2, 3, 3, 10, 15, 2, 3),
  ('fat_loss', 'ppl', 'C', 'Legs', 3, 'lunge',                    'secondary',             2, 2, 3, 12, 15, 2, 3),
  ('fat_loss', 'ppl', 'C', 'Legs', 4, 'step',                     'secondary',             2, 2, 3, 12, 15, 2, 4),
  ('fat_loss', 'ppl', 'C', 'Legs', 5, 'anti_extension',           'core_or_compensatory',  2, 2, 3, 12, 15, NULL, NULL),
  ('fat_loss', 'ppl', 'C', 'Legs', 6, 'cyclical_push',            'conditioning',          1, 2, 2, 10, 15, NULL, NULL);

-- ============================================================================
-- STRENGTH (Síla)
-- ============================================================================

-- ---------- strength + full_body (1-3 dny) ----------
INSERT INTO day_templates (goal_id, split_type, day_letter, day_name, slot_order, role_id, slot_category, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max, rir_min, rir_max) VALUES
  ('strength', 'full_body', 'A', 'Celé tělo A', 1, 'squat',              'main',                 3, 4, 5,  3, 6, 0, 2),
  ('strength', 'full_body', 'A', 'Celé tělo A', 2, 'horizontal_push',    'main',                 3, 4, 5,  3, 6, 0, 2),
  ('strength', 'full_body', 'A', 'Celé tělo A', 3, 'horizontal_pull',    'secondary',             2, 3, 4,  5, 8, 1, 3),
  ('strength', 'full_body', 'A', 'Celé tělo A', 4, 'lunge',              'secondary',             2, 2, 3,  6, 8, 2, 3),
  ('strength', 'full_body', 'A', 'Celé tělo A', 5, 'elbow_flexion',      'isolation',             2, 2, 3,  8, 12, 2, 4),
  ('strength', 'full_body', 'A', 'Celé tělo A', 6, 'anti_extension',     'core_or_compensatory',  2, 2, 3,  8, 12, NULL, NULL),
  ('strength', 'full_body', 'A', 'Celé tělo A', 7, 'cyclical_push',      'conditioning',          1, 2, 2,  8, 12, NULL, NULL);

INSERT INTO day_templates (goal_id, split_type, day_letter, day_name, slot_order, role_id, slot_category, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max, rir_min, rir_max) VALUES
  ('strength', 'full_body', 'B', 'Celé tělo B', 1, 'hinge',              'main',                 3, 4, 5,  3, 6, 0, 2),
  ('strength', 'full_body', 'B', 'Celé tělo B', 2, 'vertical_push',      'main',                 3, 4, 5,  3, 6, 0, 2),
  ('strength', 'full_body', 'B', 'Celé tělo B', 3, 'vertical_pull',      'secondary',             2, 3, 4,  5, 8, 1, 3),
  ('strength', 'full_body', 'B', 'Celé tělo B', 4, 'step',               'secondary',             2, 2, 3,  6, 8, 2, 3),
  ('strength', 'full_body', 'B', 'Celé tělo B', 5, 'elbow_extension',    'isolation',             2, 2, 3,  8, 12, 2, 4),
  ('strength', 'full_body', 'B', 'Celé tělo B', 6, 'anti_rotation',      'core_or_compensatory',  2, 2, 3,  8, 12, NULL, NULL),
  ('strength', 'full_body', 'B', 'Celé tělo B', 7, 'cyclical_pull',      'conditioning',          1, 2, 2,  8, 12, NULL, NULL);

-- ---------- strength + upper_lower (4 dny) ----------
INSERT INTO day_templates (goal_id, split_type, day_letter, day_name, slot_order, role_id, slot_category, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max, rir_min, rir_max) VALUES
  ('strength', 'upper_lower', 'A', 'Horní tělo', 1, 'horizontal_push',          'main',                 3, 4, 5, 3, 6, 0, 2),
  ('strength', 'upper_lower', 'A', 'Horní tělo', 2, 'horizontal_pull',          'main',                 3, 4, 5, 3, 6, 0, 2),
  ('strength', 'upper_lower', 'A', 'Horní tělo', 3, 'vertical_push',            'secondary',             2, 3, 4, 5, 8, 1, 3),
  ('strength', 'upper_lower', 'A', 'Horní tělo', 4, 'vertical_pull',            'secondary',             2, 3, 4, 5, 8, 1, 3),
  ('strength', 'upper_lower', 'A', 'Horní tělo', 5, 'elbow_extension',          'isolation',             2, 3, 3, 8, 12, 2, 4),
  ('strength', 'upper_lower', 'A', 'Horní tělo', 6, 'anti_extension',           'core_or_compensatory',  2, 2, 3, 8, 12, NULL, NULL),
  ('strength', 'upper_lower', 'A', 'Horní tělo', 7, 'cyclical_push',            'conditioning',          1, 2, 2, 8, 12, NULL, NULL);

INSERT INTO day_templates (goal_id, split_type, day_letter, day_name, slot_order, role_id, slot_category, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max, rir_min, rir_max) VALUES
  ('strength', 'upper_lower', 'B', 'Dolní tělo', 1, 'squat',                    'main',                 3, 4, 5, 3, 6, 0, 2),
  ('strength', 'upper_lower', 'B', 'Dolní tělo', 2, 'hinge',                    'main',                 3, 4, 5, 3, 6, 0, 2),
  ('strength', 'upper_lower', 'B', 'Dolní tělo', 3, 'lunge',                    'secondary',             2, 3, 3, 6, 8, 1, 3),
  ('strength', 'upper_lower', 'B', 'Dolní tělo', 4, 'step',                     'secondary',             2, 2, 3, 6, 8, 2, 3),
  ('strength', 'upper_lower', 'B', 'Dolní tělo', 5, 'anti_extension',           'core_or_compensatory',  2, 2, 3, 8, 12, NULL, NULL),
  ('strength', 'upper_lower', 'B', 'Dolní tělo', 6, 'cyclical_pull',            'conditioning',          1, 2, 2, 8, 12, NULL, NULL);

-- ---------- strength + ppl (5+ dní) ----------
INSERT INTO day_templates (goal_id, split_type, day_letter, day_name, slot_order, role_id, slot_category, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max, rir_min, rir_max) VALUES
  ('strength', 'ppl', 'A', 'Push', 1, 'horizontal_push',          'main',                 3, 4, 5,  3, 6, 0, 2),
  ('strength', 'ppl', 'A', 'Push', 2, 'vertical_push',            'secondary',             2, 3, 4,  5, 8, 1, 3),
  ('strength', 'ppl', 'A', 'Push', 3, 'horizontal_push',          'secondary',             2, 3, 3,  5, 8, 1, 3),
  ('strength', 'ppl', 'A', 'Push', 4, 'elbow_extension',          'isolation',             2, 3, 3,  8, 12, 2, 4),
  ('strength', 'ppl', 'A', 'Push', 5, 'shoulder_abduction',       'isolation',             2, 3, 3,  8, 12, 2, 4),
  ('strength', 'ppl', 'A', 'Push', 6, 'anti_extension',           'core_or_compensatory',  2, 2, 3,  8, 12, NULL, NULL),
  ('strength', 'ppl', 'A', 'Push', 7, 'cyclical_push',            'conditioning',          1, 2, 2,  8, 12, NULL, NULL);

INSERT INTO day_templates (goal_id, split_type, day_letter, day_name, slot_order, role_id, slot_category, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max, rir_min, rir_max) VALUES
  ('strength', 'ppl', 'B', 'Pull', 1, 'horizontal_pull',          'main',                 3, 4, 5,  3, 6, 0, 2),
  ('strength', 'ppl', 'B', 'Pull', 2, 'vertical_pull',            'secondary',             2, 3, 4,  5, 8, 1, 3),
  ('strength', 'ppl', 'B', 'Pull', 3, 'horizontal_pull',          'secondary',             2, 3, 3,  5, 8, 1, 3),
  ('strength', 'ppl', 'B', 'Pull', 4, 'elbow_flexion',            'isolation',             2, 3, 3,  8, 12, 2, 4),
  ('strength', 'ppl', 'B', 'Pull', 5, 'shoulder_external_rotation','isolation',             2, 3, 3,  8, 12, 2, 4),
  ('strength', 'ppl', 'B', 'Pull', 6, 'anti_rotation',            'core_or_compensatory',  2, 2, 3,  8, 12, NULL, NULL),
  ('strength', 'ppl', 'B', 'Pull', 7, 'cyclical_pull',            'conditioning',          1, 2, 2,  8, 12, NULL, NULL);

INSERT INTO day_templates (goal_id, split_type, day_letter, day_name, slot_order, role_id, slot_category, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max, rir_min, rir_max) VALUES
  ('strength', 'ppl', 'C', 'Legs', 1, 'squat',                    'main',                 3, 4, 5,  3, 6, 0, 2),
  ('strength', 'ppl', 'C', 'Legs', 2, 'hinge',                    'main',                 3, 4, 5,  3, 6, 0, 2),
  ('strength', 'ppl', 'C', 'Legs', 3, 'lunge',                    'secondary',             2, 3, 3,  6, 8, 1, 3),
  ('strength', 'ppl', 'C', 'Legs', 4, 'step',                     'secondary',             2, 2, 3,  6, 8, 2, 3),
  ('strength', 'ppl', 'C', 'Legs', 5, 'anti_extension',           'core_or_compensatory',  2, 2, 3,  8, 12, NULL, NULL),
  ('strength', 'ppl', 'C', 'Legs', 6, 'cyclical_push',            'conditioning',          1, 2, 2,  8, 12, NULL, NULL);

-- ============================================================================
-- GENERAL_FITNESS (Kondice / Obecná fitness)
-- ============================================================================

-- ---------- general_fitness + full_body (1-3 dny) ----------
INSERT INTO day_templates (goal_id, split_type, day_letter, day_name, slot_order, role_id, slot_category, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max, rir_min, rir_max) VALUES
  ('general_fitness', 'full_body', 'A', 'Celé tělo A', 1, 'squat',              'main',                 2, 3, 3, 10, 12, 2, 3),
  ('general_fitness', 'full_body', 'A', 'Celé tělo A', 2, 'horizontal_push',    'main',                 2, 3, 3, 10, 12, 2, 3),
  ('general_fitness', 'full_body', 'A', 'Celé tělo A', 3, 'horizontal_pull',    'secondary',             2, 3, 3, 10, 12, 2, 3),
  ('general_fitness', 'full_body', 'A', 'Celé tělo A', 4, 'lunge',              'secondary',             2, 2, 3, 10, 12, 2, 4),
  ('general_fitness', 'full_body', 'A', 'Celé tělo A', 5, 'elbow_flexion',      'isolation',             2, 2, 3, 10, 15, 2, 4),
  ('general_fitness', 'full_body', 'A', 'Celé tělo A', 6, 'anti_extension',     'core_or_compensatory',  2, 2, 3, 12, 15, NULL, NULL),
  ('general_fitness', 'full_body', 'A', 'Celé tělo A', 7, 'cyclical_push',      'conditioning',          1, 2, 2, 10, 12, NULL, NULL);

INSERT INTO day_templates (goal_id, split_type, day_letter, day_name, slot_order, role_id, slot_category, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max, rir_min, rir_max) VALUES
  ('general_fitness', 'full_body', 'B', 'Celé tělo B', 1, 'hinge',              'main',                 2, 3, 3, 10, 12, 2, 3),
  ('general_fitness', 'full_body', 'B', 'Celé tělo B', 2, 'vertical_push',      'main',                 2, 3, 3, 10, 12, 2, 3),
  ('general_fitness', 'full_body', 'B', 'Celé tělo B', 3, 'vertical_pull',      'secondary',             2, 3, 3, 10, 12, 2, 3),
  ('general_fitness', 'full_body', 'B', 'Celé tělo B', 4, 'step',               'secondary',             2, 2, 3, 10, 12, 2, 4),
  ('general_fitness', 'full_body', 'B', 'Celé tělo B', 5, 'elbow_extension',    'isolation',             2, 2, 3, 10, 15, 2, 4),
  ('general_fitness', 'full_body', 'B', 'Celé tělo B', 6, 'anti_rotation',      'core_or_compensatory',  2, 2, 3, 12, 15, NULL, NULL),
  ('general_fitness', 'full_body', 'B', 'Celé tělo B', 7, 'cyclical_pull',      'conditioning',          1, 2, 2, 10, 12, NULL, NULL);

-- ---------- general_fitness + upper_lower (4 dny) ----------
INSERT INTO day_templates (goal_id, split_type, day_letter, day_name, slot_order, role_id, slot_category, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max, rir_min, rir_max) VALUES
  ('general_fitness', 'upper_lower', 'A', 'Horní tělo', 1, 'horizontal_push',          'main',                 2, 3, 3, 10, 12, 2, 3),
  ('general_fitness', 'upper_lower', 'A', 'Horní tělo', 2, 'horizontal_pull',          'main',                 2, 3, 3, 10, 12, 2, 3),
  ('general_fitness', 'upper_lower', 'A', 'Horní tělo', 3, 'vertical_push',            'secondary',             2, 2, 3, 10, 12, 2, 3),
  ('general_fitness', 'upper_lower', 'A', 'Horní tělo', 4, 'vertical_pull',            'secondary',             2, 2, 3, 10, 12, 2, 3),
  ('general_fitness', 'upper_lower', 'A', 'Horní tělo', 5, 'elbow_extension',          'isolation',             2, 2, 3, 10, 15, 2, 4),
  ('general_fitness', 'upper_lower', 'A', 'Horní tělo', 6, 'anti_extension',           'core_or_compensatory',  2, 2, 3, 12, 15, NULL, NULL),
  ('general_fitness', 'upper_lower', 'A', 'Horní tělo', 7, 'cyclical_push',            'conditioning',          1, 2, 2, 10, 12, NULL, NULL);

INSERT INTO day_templates (goal_id, split_type, day_letter, day_name, slot_order, role_id, slot_category, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max, rir_min, rir_max) VALUES
  ('general_fitness', 'upper_lower', 'B', 'Dolní tělo', 1, 'squat',                    'main',                 2, 3, 3, 10, 12, 2, 3),
  ('general_fitness', 'upper_lower', 'B', 'Dolní tělo', 2, 'hinge',                    'main',                 2, 3, 3, 10, 12, 2, 3),
  ('general_fitness', 'upper_lower', 'B', 'Dolní tělo', 3, 'lunge',                    'secondary',             2, 2, 3, 10, 12, 2, 3),
  ('general_fitness', 'upper_lower', 'B', 'Dolní tělo', 4, 'step',                     'secondary',             2, 2, 3, 10, 12, 2, 4),
  ('general_fitness', 'upper_lower', 'B', 'Dolní tělo', 5, 'elbow_flexion',            'isolation',             2, 2, 3, 10, 15, 2, 4),
  ('general_fitness', 'upper_lower', 'B', 'Dolní tělo', 6, 'anti_rotation',            'core_or_compensatory',  2, 2, 3, 12, 15, NULL, NULL),
  ('general_fitness', 'upper_lower', 'B', 'Dolní tělo', 7, 'cyclical_pull',            'conditioning',          1, 2, 2, 10, 12, NULL, NULL);

-- ---------- general_fitness + ppl (5+ dní) ----------
INSERT INTO day_templates (goal_id, split_type, day_letter, day_name, slot_order, role_id, slot_category, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max, rir_min, rir_max) VALUES
  ('general_fitness', 'ppl', 'A', 'Push', 1, 'horizontal_push',          'main',                 2, 3, 3, 10, 12, 2, 3),
  ('general_fitness', 'ppl', 'A', 'Push', 2, 'vertical_push',            'secondary',             2, 3, 3, 10, 12, 2, 3),
  ('general_fitness', 'ppl', 'A', 'Push', 3, 'horizontal_push',          'secondary',             2, 2, 3, 10, 12, 2, 3),
  ('general_fitness', 'ppl', 'A', 'Push', 4, 'elbow_extension',          'isolation',             2, 2, 3, 10, 15, 2, 4),
  ('general_fitness', 'ppl', 'A', 'Push', 5, 'shoulder_abduction',       'isolation',             2, 2, 3, 10, 15, 2, 4),
  ('general_fitness', 'ppl', 'A', 'Push', 6, 'anti_extension',           'core_or_compensatory',  2, 2, 3, 12, 15, NULL, NULL),
  ('general_fitness', 'ppl', 'A', 'Push', 7, 'cyclical_push',            'conditioning',          1, 2, 2, 10, 12, NULL, NULL);

INSERT INTO day_templates (goal_id, split_type, day_letter, day_name, slot_order, role_id, slot_category, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max, rir_min, rir_max) VALUES
  ('general_fitness', 'ppl', 'B', 'Pull', 1, 'horizontal_pull',          'main',                 2, 3, 3, 10, 12, 2, 3),
  ('general_fitness', 'ppl', 'B', 'Pull', 2, 'vertical_pull',            'secondary',             2, 3, 3, 10, 12, 2, 3),
  ('general_fitness', 'ppl', 'B', 'Pull', 3, 'horizontal_pull',          'secondary',             2, 2, 3, 10, 12, 2, 3),
  ('general_fitness', 'ppl', 'B', 'Pull', 4, 'elbow_flexion',            'isolation',             2, 2, 3, 10, 15, 2, 4),
  ('general_fitness', 'ppl', 'B', 'Pull', 5, 'shoulder_external_rotation','isolation',             2, 2, 3, 10, 15, 2, 4),
  ('general_fitness', 'ppl', 'B', 'Pull', 6, 'anti_rotation',            'core_or_compensatory',  2, 2, 3, 12, 15, NULL, NULL),
  ('general_fitness', 'ppl', 'B', 'Pull', 7, 'cyclical_pull',            'conditioning',          1, 2, 2, 10, 12, NULL, NULL);

INSERT INTO day_templates (goal_id, split_type, day_letter, day_name, slot_order, role_id, slot_category, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max, rir_min, rir_max) VALUES
  ('general_fitness', 'ppl', 'C', 'Legs', 1, 'squat',                    'main',                 2, 3, 3, 10, 12, 2, 3),
  ('general_fitness', 'ppl', 'C', 'Legs', 2, 'hinge',                    'main',                 2, 3, 3, 10, 12, 2, 3),
  ('general_fitness', 'ppl', 'C', 'Legs', 3, 'lunge',                    'secondary',             2, 2, 3, 10, 12, 2, 3),
  ('general_fitness', 'ppl', 'C', 'Legs', 4, 'step',                     'secondary',             2, 2, 3, 10, 12, 2, 4),
  ('general_fitness', 'ppl', 'C', 'Legs', 5, 'anti_extension',           'core_or_compensatory',  2, 2, 3, 12, 15, NULL, NULL),
  ('general_fitness', 'ppl', 'C', 'Legs', 6, 'cyclical_push',            'conditioning',          1, 2, 2, 10, 12, NULL, NULL);

-- ============================================================================
-- STEP 4: Update training_roles.phase_type
-- ============================================================================
UPDATE public.training_roles SET phase_type = 'main'
WHERE id IN ('horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull', 'squat', 'hinge');

UPDATE public.training_roles SET phase_type = 'secondary'
WHERE id IN ('lunge', 'step', 'jump', 'shoulder_abduction', 'shoulder_adduction');

UPDATE public.training_roles SET phase_type = 'accessory'
WHERE id IN (
  'elbow_flexion', 'elbow_extension',
  'shoulder_external_rotation', 'shoulder_internal_rotation',
  'rear_delt_isolation', 'upper_back_isolation',
  'biceps_isolation', 'triceps_isolation'
);

UPDATE public.training_roles SET phase_type = 'core'
WHERE id IN ('anti_extension', 'anti_flexion', 'anti_rotation', 'rotation', 'lateral_flexion', 'anti_lateral_flexion');

UPDATE public.training_roles SET phase_type = 'secondary'
WHERE id IN ('cyclical_push', 'cyclical_pull', 'full_body_pull');

-- ============================================================================
-- STEP 5: Tag exercises based on primary_role
-- ============================================================================
UPDATE public.exercises SET is_compound = true, slot_type = 'main'
WHERE primary_role IN ('horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull', 'squat', 'hinge');

UPDATE public.exercises SET is_compound = true, slot_type = 'secondary'
WHERE primary_role IN ('lunge', 'step', 'jump');

UPDATE public.exercises SET is_compound = false, slot_type = 'isolation'
WHERE primary_role IN (
  'elbow_flexion', 'elbow_extension',
  'shoulder_abduction', 'shoulder_adduction',
  'shoulder_external_rotation', 'shoulder_internal_rotation',
  'rear_delt_isolation', 'upper_back_isolation',
  'biceps_isolation', 'triceps_isolation'
);

UPDATE public.exercises SET is_compound = false, slot_type = 'core'
WHERE primary_role IN ('anti_extension', 'anti_flexion', 'anti_rotation', 'rotation', 'lateral_flexion', 'anti_lateral_flexion');

UPDATE public.exercises SET is_compound = false, slot_type = 'conditioning'
WHERE primary_role IN ('cyclical_push', 'cyclical_pull', 'full_body_pull')
   OR category = 'cardio';
