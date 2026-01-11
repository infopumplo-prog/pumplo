-- Create a secure view for public gym data that excludes owner_id
CREATE OR REPLACE VIEW public.public_gyms AS
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