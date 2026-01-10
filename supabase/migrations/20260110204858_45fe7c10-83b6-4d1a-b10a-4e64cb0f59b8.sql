-- Add gym license count column to user_profiles
ALTER TABLE public.user_profiles 
ADD COLUMN gym_license_count integer DEFAULT 0;

-- Add RLS policy for admins to update profiles (needed to set license count)
CREATE POLICY "Admins can update all profiles" 
ON public.user_profiles 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));