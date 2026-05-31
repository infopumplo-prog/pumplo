-- Drop the old unique constraint that doesn't include split_type
ALTER TABLE day_templates DROP CONSTRAINT IF EXISTS day_templates_goal_id_day_letter_slot_order_key;

-- Create new unique constraint including split_type
ALTER TABLE day_templates ADD CONSTRAINT day_templates_goal_split_day_slot_key 
  UNIQUE (goal_id, split_type, day_letter, slot_order);