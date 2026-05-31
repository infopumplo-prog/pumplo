-- Create gym_photos table for gallery images
CREATE TABLE public.gym_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for fast lookups by gym
CREATE INDEX idx_gym_photos_gym_id ON public.gym_photos(gym_id);

-- Enable Row Level Security
ALTER TABLE public.gym_photos ENABLE ROW LEVEL SECURITY;

-- Anyone can view photos of published gyms or their own gym
CREATE POLICY "Anyone can view photos of published gyms"
  ON public.gym_photos FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.gyms 
    WHERE gyms.id = gym_photos.gym_id 
    AND (gyms.is_published = true OR gyms.owner_id = auth.uid())
  ));

-- Business user can insert photos to their own gym
CREATE POLICY "Gym owners can insert photos"
  ON public.gym_photos FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.gyms 
    WHERE gyms.id = gym_photos.gym_id 
    AND gyms.owner_id = auth.uid()
  ));

-- Business user can delete photos from their own gym
CREATE POLICY "Gym owners can delete photos"
  ON public.gym_photos FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.gyms 
    WHERE gyms.id = gym_photos.gym_id 
    AND gyms.owner_id = auth.uid()
  ));

-- Business user can update photos of their own gym
CREATE POLICY "Gym owners can update photos"
  ON public.gym_photos FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.gyms 
    WHERE gyms.id = gym_photos.gym_id 
    AND gyms.owner_id = auth.uid()
  ));

-- Admin can manage all photos
CREATE POLICY "Admins can manage all photos"
  ON public.gym_photos FOR ALL
  USING (has_role(auth.uid(), 'admin'));