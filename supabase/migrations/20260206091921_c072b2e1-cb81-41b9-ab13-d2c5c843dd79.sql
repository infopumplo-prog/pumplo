-- Add equipment categorization to machines table
ALTER TABLE public.machines 
ADD COLUMN equipment_category text DEFAULT 'machine';

ALTER TABLE public.machines 
ADD COLUMN is_cardio boolean DEFAULT false;

-- Add secondary machine reference to exercises table
ALTER TABLE public.exercises 
ADD COLUMN secondary_machine_id uuid REFERENCES machines(id);