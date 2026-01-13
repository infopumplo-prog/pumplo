-- Pridať equipment_type stĺpec do exercises tabuľky
-- Podľa dokumentu PUMPLO každý cvik má mať jeden hlavný typ vybavenia

ALTER TABLE exercises ADD COLUMN IF NOT EXISTS equipment_type TEXT DEFAULT 'bodyweight';

-- Aktualizovať equipment_type z existujúceho equipment array
-- Priorita: machine > cable > barbell > dumbbell > bodyweight
UPDATE exercises SET equipment_type = 
  CASE 
    WHEN requires_machine = true AND machine_id IS NOT NULL THEN 'machine'
    WHEN 'cable' = ANY(equipment) THEN 'cable'
    WHEN 'barbell' = ANY(equipment) THEN 'barbell'
    WHEN 'dumbbell' = ANY(equipment) THEN 'dumbbell'
    WHEN 'kettlebell' = ANY(equipment) THEN 'kettlebell'
    WHEN 'machine' = ANY(equipment) THEN 'machine'
    WHEN 'bodyweight' = ANY(equipment) OR equipment = '{}' OR equipment IS NULL THEN 'bodyweight'
    ELSE 'other'
  END;