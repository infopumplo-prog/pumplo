-- Drop and recreate the view with SECURITY INVOKER
DROP VIEW IF EXISTS public.public_gyms;

CREATE VIEW public.public_gyms 
WITH (security_invoker = true) AS
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
  created_at,
  updated_at
FROM public.gyms
WHERE is_published = true;

-- Grant access to the view for authenticated and anonymous users
GRANT SELECT ON public.public_gyms TO anon;
GRANT SELECT ON public.public_gyms TO authenticated;