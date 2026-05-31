-- Remove target_muscles and equipment_type columns from machines table
ALTER TABLE public.machines DROP COLUMN IF EXISTS target_muscles;
ALTER TABLE public.machines DROP COLUMN IF EXISTS equipment_type;