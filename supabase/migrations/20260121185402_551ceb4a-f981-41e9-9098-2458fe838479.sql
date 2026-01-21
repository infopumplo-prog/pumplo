-- Seed day_templates with real split names for all training goals

-- Clear existing templates (if any)
DELETE FROM day_templates;

-- MUSCLE_GAIN: PPL Split (3 days: Push, Pull, Legs)
INSERT INTO day_templates (goal_id, day_letter, day_name, slot_order, role_id, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max) VALUES
  -- Day A: Push
  ('muscle_gain', 'A', 'Push', 1, 'horizontal_push', 2, 3, 4, 8, 12),
  ('muscle_gain', 'A', 'Push', 2, 'vertical_push', 2, 3, 4, 8, 12),
  ('muscle_gain', 'A', 'Push', 3, 'elbow_extension', 2, 3, 3, 10, 15),
  ('muscle_gain', 'A', 'Push', 4, 'shoulder_abduction', 2, 3, 3, 12, 15),
  -- Day B: Pull
  ('muscle_gain', 'B', 'Pull', 1, 'horizontal_pull', 2, 3, 4, 8, 12),
  ('muscle_gain', 'B', 'Pull', 2, 'vertical_pull', 2, 3, 4, 8, 12),
  ('muscle_gain', 'B', 'Pull', 3, 'elbow_flexion', 2, 3, 3, 10, 15),
  ('muscle_gain', 'B', 'Pull', 4, 'shoulder_external_rotation', 2, 3, 3, 12, 15),
  -- Day C: Legs
  ('muscle_gain', 'C', 'Legs', 1, 'squat', 2, 3, 4, 8, 12),
  ('muscle_gain', 'C', 'Legs', 2, 'hinge', 2, 3, 4, 8, 12),
  ('muscle_gain', 'C', 'Legs', 3, 'lunge', 2, 2, 3, 10, 12),
  ('muscle_gain', 'C', 'Legs', 4, 'anti_extension', 2, 3, 3, 12, 20),

-- FAT_LOSS: Upper/Lower Split (2 days)
  -- Day A: Horní tělo
  ('fat_loss', 'A', 'Horní tělo', 1, 'horizontal_push', 2, 3, 3, 10, 15),
  ('fat_loss', 'A', 'Horní tělo', 2, 'horizontal_pull', 2, 3, 3, 10, 15),
  ('fat_loss', 'A', 'Horní tělo', 3, 'vertical_push', 2, 2, 3, 10, 15),
  ('fat_loss', 'A', 'Horní tělo', 4, 'vertical_pull', 2, 2, 3, 10, 15),
  -- Day B: Dolní tělo
  ('fat_loss', 'B', 'Dolní tělo', 1, 'squat', 2, 3, 3, 10, 15),
  ('fat_loss', 'B', 'Dolní tělo', 2, 'hinge', 2, 3, 3, 10, 15),
  ('fat_loss', 'B', 'Dolní tělo', 3, 'lunge', 2, 2, 3, 12, 15),
  ('fat_loss', 'B', 'Dolní tělo', 4, 'anti_extension', 2, 2, 3, 12, 15),

-- STRENGTH: Upper/Lower Split (2 days, lower reps)
  -- Day A: Horní tělo
  ('strength', 'A', 'Horní tělo', 1, 'horizontal_push', 3, 4, 5, 4, 6),
  ('strength', 'A', 'Horní tělo', 2, 'horizontal_pull', 3, 4, 5, 4, 6),
  ('strength', 'A', 'Horní tělo', 3, 'vertical_push', 2, 3, 4, 5, 8),
  ('strength', 'A', 'Horní tělo', 4, 'vertical_pull', 2, 3, 4, 5, 8),
  -- Day B: Dolní tělo
  ('strength', 'B', 'Dolní tělo', 1, 'squat', 3, 4, 5, 4, 6),
  ('strength', 'B', 'Dolní tělo', 2, 'hinge', 3, 4, 5, 4, 6),
  ('strength', 'B', 'Dolní tělo', 3, 'lunge', 2, 3, 3, 6, 8),
  ('strength', 'B', 'Dolní tělo', 4, 'anti_extension', 2, 2, 3, 8, 12),

-- GENERAL_FITNESS: Full Body (2 days rotating)
  -- Day A: Celé tělo A
  ('general_fitness', 'A', 'Celé tělo A', 1, 'squat', 2, 3, 3, 10, 12),
  ('general_fitness', 'A', 'Celé tělo A', 2, 'horizontal_push', 2, 3, 3, 10, 12),
  ('general_fitness', 'A', 'Celé tělo A', 3, 'horizontal_pull', 2, 3, 3, 10, 12),
  ('general_fitness', 'A', 'Celé tělo A', 4, 'anti_extension', 2, 2, 3, 12, 15),
  -- Day B: Celé tělo B
  ('general_fitness', 'B', 'Celé tělo B', 1, 'hinge', 2, 3, 3, 10, 12),
  ('general_fitness', 'B', 'Celé tělo B', 2, 'vertical_push', 2, 3, 3, 10, 12),
  ('general_fitness', 'B', 'Celé tělo B', 3, 'vertical_pull', 2, 3, 3, 10, 12),
  ('general_fitness', 'B', 'Celé tělo B', 4, 'lunge', 2, 2, 3, 10, 12);