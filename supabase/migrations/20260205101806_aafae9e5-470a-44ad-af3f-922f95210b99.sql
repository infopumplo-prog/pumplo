-- Drop and recreate public_gyms view with pricing column
DROP VIEW IF EXISTS public.public_gyms;

CREATE VIEW public.public_gyms
WITH (security_invoker=on) AS
SELECT 
  id,
  name,
  description,
  latitude,
  longitude,
  address,
  is_published,
  opening_hours,
  cover_photo_url,
  logo_url,
  pricing,
  instagram_handle,
  created_at,
  updated_at
FROM public.gyms
WHERE is_published = true;