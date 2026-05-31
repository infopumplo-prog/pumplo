-- ============================================
-- Add is_verified and is_featured to public_gyms view
-- So member app can display verified badge
-- ============================================

DROP VIEW IF EXISTS public.public_gyms;

CREATE VIEW public.public_gyms AS
SELECT
  g.id,
  g.name,
  g.description,
  g.latitude,
  g.longitude,
  g.address,
  g.is_published,
  g.opening_hours,
  g.cover_photo_url,
  g.logo_url,
  g.pricing,
  g.instagram_handle,
  g.contact_email,
  g.contact_phone,
  g.website,
  g.services,
  g.created_at,
  g.updated_at,
  g.is_featured,
  g.is_verified
FROM public.gyms g
INNER JOIN public.gym_subscriptions gs
  ON gs.gym_id = g.id AND gs.status = 'active'
WHERE g.is_published = true;

GRANT SELECT ON public.public_gyms TO anon;
GRANT SELECT ON public.public_gyms TO authenticated;
