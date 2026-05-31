-- Zmeniť bucket exercise-videos na súkromný
UPDATE storage.buckets
SET public = false
WHERE id = 'exercise-videos';

-- Pridať RLS politiky pre prístup k videám
CREATE POLICY "Authenticated users can view exercise videos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'exercise-videos');

CREATE POLICY "Admins can upload exercise videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'exercise-videos' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'::public.app_role
  )
);

CREATE POLICY "Admins can delete exercise videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'exercise-videos' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'::public.app_role
  )
);