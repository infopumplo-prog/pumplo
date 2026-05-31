-- Add split_type column to day_templates
ALTER TABLE public.day_templates ADD COLUMN split_type TEXT;

-- Migrate data - map goal_id to split_type
UPDATE public.day_templates SET split_type = 'full_body' WHERE goal_id = 'general_fitness';
UPDATE public.day_templates SET split_type = 'upper_lower' WHERE goal_id IN ('fat_loss', 'strength');
UPDATE public.day_templates SET split_type = 'ppl' WHERE goal_id = 'muscle_gain';

-- Create index for faster lookups by split_type
CREATE INDEX idx_day_templates_split_type ON public.day_templates(split_type);