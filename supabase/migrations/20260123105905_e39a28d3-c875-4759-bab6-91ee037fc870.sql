-- Admins can manage all gym images (upload, delete, update)
CREATE POLICY "Admins can manage all gym images"
ON storage.objects
FOR ALL
USING (
  bucket_id = 'gym-images' 
  AND public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  bucket_id = 'gym-images' 
  AND public.has_role(auth.uid(), 'admin')
);