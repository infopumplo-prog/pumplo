-- Restrict all reference data tables to authenticated users only.
-- Previously USING (true) allowed unauthenticated access (anyone could scrape exercises, machines etc.)
-- subscription_plans stays public (pricing page).

-- machines
DROP POLICY IF EXISTS "Anyone can view machines" ON public.machines;
CREATE POLICY "Authenticated users can view machines"
ON public.machines FOR SELECT
USING (auth.uid() IS NOT NULL);

-- exercises
DROP POLICY IF EXISTS "Anyone can view exercises" ON public.exercises;
CREATE POLICY "Authenticated users can view exercises"
ON public.exercises FOR SELECT
USING (auth.uid() IS NOT NULL);

-- training_roles
DROP POLICY IF EXISTS "Training roles are publicly readable" ON public.training_roles;
CREATE POLICY "Authenticated users can view training roles"
ON public.training_roles FOR SELECT
USING (auth.uid() IS NOT NULL);

-- training_goals
DROP POLICY IF EXISTS "Training goals are publicly readable" ON public.training_goals;
CREATE POLICY "Authenticated users can view training goals"
ON public.training_goals FOR SELECT
USING (auth.uid() IS NOT NULL);

-- day_templates
DROP POLICY IF EXISTS "Day templates are publicly readable" ON public.day_templates;
CREATE POLICY "Authenticated users can view day templates"
ON public.day_templates FOR SELECT
USING (auth.uid() IS NOT NULL);

-- role_muscles
DROP POLICY IF EXISTS "Role muscles are publicly readable" ON public.role_muscles;
CREATE POLICY "Authenticated users can view role muscles"
ON public.role_muscles FOR SELECT
USING (auth.uid() IS NOT NULL);

-- role_aliases
DROP POLICY IF EXISTS "Role aliases are publicly readable" ON public.role_aliases;
CREATE POLICY "Authenticated users can view role aliases"
ON public.role_aliases FOR SELECT
USING (auth.uid() IS NOT NULL);
