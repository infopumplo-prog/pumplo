-- Create exercise skip feedback table
CREATE TABLE exercise_skip_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL,
  exercise_name TEXT NOT NULL,
  gym_id UUID REFERENCES gyms(id) ON DELETE SET NULL,
  plan_id UUID REFERENCES user_workout_plans(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  other_reason TEXT,
  day_letter TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for exercise_skip_feedback
ALTER TABLE exercise_skip_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert skip feedback" ON exercise_skip_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own skip feedback" ON exercise_skip_feedback
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all skip feedback" ON exercise_skip_feedback
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Create app feedback table
CREATE TABLE app_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  experience_rating INTEGER,
  satisfaction TEXT,
  improvements TEXT,
  favorite_feature TEXT,
  issues TEXT,
  other_comments TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for app_feedback
ALTER TABLE app_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert app feedback" ON app_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own app feedback" ON app_feedback
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all app feedback" ON app_feedback
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));