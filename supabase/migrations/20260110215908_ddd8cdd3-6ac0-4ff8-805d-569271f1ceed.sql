-- Populate equipment array based on exercise names and requires_machine flag
-- Equipment types from machines table: machine, cardio, bodyweight, resistance_bands, functional, plate_loaded, cable, free_weights, accessory

-- Barbell exercises
UPDATE exercises SET equipment = ARRAY['barbell', 'free_weights']
WHERE (name ILIKE '%barbell%' OR name ILIKE '%bench press%' OR name ILIKE '%deadlift%' OR name ILIKE '%squat%' OR name ILIKE '%row%')
  AND name NOT ILIKE '%dumbbell%' 
  AND name NOT ILIKE '%machine%'
  AND name NOT ILIKE '%cable%'
  AND (equipment = '{}' OR equipment IS NULL);

-- Dumbbell exercises  
UPDATE exercises SET equipment = ARRAY['dumbbell', 'free_weights']
WHERE name ILIKE '%dumbbell%'
  AND (equipment = '{}' OR equipment IS NULL);

-- Cable exercises
UPDATE exercises SET equipment = ARRAY['cable']
WHERE name ILIKE '%cable%'
  AND (equipment = '{}' OR equipment IS NULL);

-- Kettlebell exercises
UPDATE exercises SET equipment = ARRAY['kettlebell', 'free_weights']
WHERE name ILIKE '%kettlebell%'
  AND (equipment = '{}' OR equipment IS NULL);

-- Band/resistance band exercises
UPDATE exercises SET equipment = ARRAY['resistance_bands']
WHERE (name ILIKE '%band%' OR name ILIKE '%resistance%')
  AND name NOT ILIKE '%dumbbell%'
  AND (equipment = '{}' OR equipment IS NULL);

-- Machine exercises (based on requires_machine flag or name)
UPDATE exercises SET equipment = ARRAY['machine']
WHERE (requires_machine = true OR name ILIKE '%machine%')
  AND name NOT ILIKE '%cable%'
  AND name NOT ILIKE '%smith%'
  AND (equipment = '{}' OR equipment IS NULL);

-- Smith machine
UPDATE exercises SET equipment = ARRAY['barbell', 'machine']
WHERE name ILIKE '%smith%'
  AND (equipment = '{}' OR equipment IS NULL);

-- Plate loaded exercises
UPDATE exercises SET equipment = ARRAY['plate_loaded', 'free_weights']
WHERE name ILIKE '%plate%'
  AND (equipment = '{}' OR equipment IS NULL);

-- Pull-up bar exercises
UPDATE exercises SET equipment = ARRAY['bodyweight', 'functional']
WHERE (name ILIKE '%pull up%' OR name ILIKE '%pullup%' OR name ILIKE '%chin up%' OR name ILIKE '%chinup%')
  AND (equipment = '{}' OR equipment IS NULL);

-- Dip exercises
UPDATE exercises SET equipment = ARRAY['bodyweight', 'functional']
WHERE name ILIKE '%dip%'
  AND name NOT ILIKE '%dumbbell%'
  AND (equipment = '{}' OR equipment IS NULL);

-- Default: bodyweight for remaining exercises without equipment
UPDATE exercises SET equipment = ARRAY['bodyweight']
WHERE (equipment = '{}' OR equipment IS NULL)
  AND requires_machine = false;