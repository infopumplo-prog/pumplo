-- Add pricing column to gyms table
ALTER TABLE public.gyms 
ADD COLUMN IF NOT EXISTS pricing jsonb DEFAULT NULL;

-- Add comment explaining the structure
COMMENT ON COLUMN public.gyms.pricing IS 'Structured pricing data with single_entries and memberships arrays';