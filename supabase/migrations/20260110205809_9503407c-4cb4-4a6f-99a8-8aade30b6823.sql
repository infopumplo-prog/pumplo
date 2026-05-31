-- Drop the unique constraint on owner_id to allow multiple gyms per owner
ALTER TABLE public.gyms DROP CONSTRAINT IF EXISTS gyms_owner_id_key;