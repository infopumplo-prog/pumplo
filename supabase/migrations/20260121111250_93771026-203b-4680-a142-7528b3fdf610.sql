-- Drop the old check constraint
ALTER TABLE training_roles DROP CONSTRAINT IF EXISTS training_roles_category_check;

-- Add new check constraint with more categories
ALTER TABLE training_roles ADD CONSTRAINT training_roles_category_check 
  CHECK (category = ANY (ARRAY['upper', 'lower', 'core', 'cardio', 'compound']));

-- First delete user_workout_exercises that reference old roles
DELETE FROM user_workout_exercises;

-- Delete day_templates that reference old roles  
DELETE FROM day_templates;

-- Delete existing training roles
DELETE FROM training_roles;

-- Insert new training roles
INSERT INTO training_roles (id, name, category) VALUES
  ('horizontal_push', 'Horizontálny tlak', 'upper'),
  ('horizontal_pull', 'Horizontálny ťah', 'upper'),
  ('vertical_push', 'Vertikálny tlak', 'upper'),
  ('vertical_pull', 'Vertikálny ťah', 'upper'),
  ('elbow_flexion', 'Flexia lakťa', 'upper'),
  ('elbow_extension', 'Extenzia lakťa', 'upper'),
  ('shoulder_abduction', 'Abdukcia ramena', 'upper'),
  ('shoulder_adduction', 'Addukcia ramena', 'upper'),
  ('shoulder_external_rotation', 'Vonkajšia rotácia ramena', 'upper'),
  ('shoulder_internal_rotation', 'Vnútorná rotácia ramena', 'upper'),
  ('squat', 'Drep', 'lower'),
  ('hinge', 'Hip hinge', 'lower'),
  ('lunge', 'Výpad', 'lower'),
  ('step', 'Krok', 'lower'),
  ('jump', 'Skok', 'lower'),
  ('anti_extension', 'Anti-extenzia', 'core'),
  ('anti_flexion', 'Anti-flexia', 'core'),
  ('anti_rotation', 'Anti-rotácia', 'core'),
  ('rotation', 'Rotácia', 'core'),
  ('lateral_flexion', 'Laterálna flexia', 'core'),
  ('cyclical_pull', 'Cyklický ťah', 'cardio'),
  ('cyclical_push', 'Cyklický tlak', 'cardio'),
  ('full_body_pull', 'Celotelesný ťah', 'compound');