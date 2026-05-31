-- Admin can view all gyms (not just published)
CREATE POLICY "Admins can view all gyms" ON gyms
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can insert gyms with any owner_id
CREATE POLICY "Admins can insert gyms" ON gyms
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admin can update all gyms
CREATE POLICY "Admins can update all gyms" ON gyms
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can delete all gyms
CREATE POLICY "Admins can delete all gyms" ON gyms
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can view all gym machines
CREATE POLICY "Admins can view all gym machines" ON gym_machines
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can insert gym machines for any gym
CREATE POLICY "Admins can insert gym machines" ON gym_machines
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admin can update gym machines for any gym
CREATE POLICY "Admins can update gym machines" ON gym_machines
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can delete gym machines from any gym
CREATE POLICY "Admins can delete gym machines" ON gym_machines
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));