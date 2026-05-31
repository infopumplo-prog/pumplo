
-- 1. Cooldown fáze pro stretche/mobilitu (ne-kardio cviky bez primary_role)
UPDATE exercises 
SET allowed_phase = 'cooldown' 
WHERE primary_role IS NULL 
  AND allowed_phase = 'warmup' 
  AND category != 'cardio';

-- 2. RLS pro day_templates (admin CRUD)
CREATE POLICY "Admins can insert day_templates" ON public.day_templates 
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update day_templates" ON public.day_templates 
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete day_templates" ON public.day_templates 
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. RLS pro training_roles (admin CRUD)
CREATE POLICY "Admins can insert training_roles" ON public.training_roles 
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update training_roles" ON public.training_roles 
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete training_roles" ON public.training_roles 
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. RLS pro role_muscles (admin CRUD)
CREATE POLICY "Admins can insert role_muscles" ON public.role_muscles 
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update role_muscles" ON public.role_muscles 
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete role_muscles" ON public.role_muscles 
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
