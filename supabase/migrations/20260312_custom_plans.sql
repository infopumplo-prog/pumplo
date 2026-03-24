-- Custom training plans
CREATE TABLE custom_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE custom_plan_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES custom_plans(id) ON DELETE CASCADE,
  day_number int NOT NULL,
  name text
);

CREATE TABLE custom_plan_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id uuid NOT NULL REFERENCES custom_plan_days(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  sets int NOT NULL DEFAULT 3,
  reps int NOT NULL DEFAULT 10,
  weight_kg numeric,
  order_index int NOT NULL DEFAULT 0
);

-- RLS policies
ALTER TABLE custom_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_plan_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_plan_exercises ENABLE ROW LEVEL SECURITY;

-- custom_plans: users can CRUD their own plans
CREATE POLICY "Users can view own plans" ON custom_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own plans" ON custom_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own plans" ON custom_plans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own plans" ON custom_plans FOR DELETE USING (auth.uid() = user_id);

-- custom_plan_days: users can CRUD days of their own plans
CREATE POLICY "Users can view own plan days" ON custom_plan_days FOR SELECT
  USING (EXISTS (SELECT 1 FROM custom_plans WHERE id = plan_id AND user_id = auth.uid()));
CREATE POLICY "Users can create own plan days" ON custom_plan_days FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM custom_plans WHERE id = plan_id AND user_id = auth.uid()));
CREATE POLICY "Users can update own plan days" ON custom_plan_days FOR UPDATE
  USING (EXISTS (SELECT 1 FROM custom_plans WHERE id = plan_id AND user_id = auth.uid()));
CREATE POLICY "Users can delete own plan days" ON custom_plan_days FOR DELETE
  USING (EXISTS (SELECT 1 FROM custom_plans WHERE id = plan_id AND user_id = auth.uid()));

-- custom_plan_exercises: users can CRUD exercises of their own plans
CREATE POLICY "Users can view own plan exercises" ON custom_plan_exercises FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM custom_plan_days d
    JOIN custom_plans p ON p.id = d.plan_id
    WHERE d.id = day_id AND p.user_id = auth.uid()
  ));
CREATE POLICY "Users can create own plan exercises" ON custom_plan_exercises FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM custom_plan_days d
    JOIN custom_plans p ON p.id = d.plan_id
    WHERE d.id = day_id AND p.user_id = auth.uid()
  ));
CREATE POLICY "Users can update own plan exercises" ON custom_plan_exercises FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM custom_plan_days d
    JOIN custom_plans p ON p.id = d.plan_id
    WHERE d.id = day_id AND p.user_id = auth.uid()
  ));
CREATE POLICY "Users can delete own plan exercises" ON custom_plan_exercises FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM custom_plan_days d
    JOIN custom_plans p ON p.id = d.plan_id
    WHERE d.id = day_id AND p.user_id = auth.uid()
  ));
