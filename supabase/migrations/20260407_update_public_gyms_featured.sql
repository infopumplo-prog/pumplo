-- ============================================
-- Add missing columns to gyms table & update public_gyms view
-- Only show gyms with active subscription on map
-- ============================================

-- 1. Add missing columns to gyms table
ALTER TABLE public.gyms
ADD COLUMN IF NOT EXISTS contact_email TEXT,
ADD COLUMN IF NOT EXISTS contact_phone TEXT,
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS services TEXT[] DEFAULT '{}';

-- 2. Recreate public_gyms view — only gyms with active subscription
DROP VIEW IF EXISTS public.public_gyms;

-- NOTE: no security_invoker — view must bypass RLS on gym_subscriptions
-- so regular members can see published gyms with active subscriptions
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
  g.updated_at
FROM public.gyms g
INNER JOIN public.gym_subscriptions gs
  ON gs.gym_id = g.id AND gs.status = 'active'
WHERE g.is_published = true;

-- 3. Grant access
GRANT SELECT ON public.public_gyms TO anon;
GRANT SELECT ON public.public_gyms TO authenticated;
