-- Add photo columns to gyms table
ALTER TABLE public.gyms 
ADD COLUMN IF NOT EXISTS cover_photo_url TEXT,
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Create storage bucket for gym images
INSERT INTO storage.buckets (id, name, public)
VALUES ('gym-images', 'gym-images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for gym images bucket
CREATE POLICY "Anyone can view gym images"
ON storage.objects FOR SELECT
USING (bucket_id = 'gym-images');

CREATE POLICY "Gym owners can upload their gym images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'gym-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Gym owners can update their gym images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'gym-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Gym owners can delete their gym images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'gym-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);