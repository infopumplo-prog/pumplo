-- Veřejné tréninky (katalog) — sekce Tréninky ve spodní liště.
--
-- Pravidla (David, 8. 10. 2026):
-- * Zveřejňovat smí JEN trenér schválený pod posilovnou (gym_trainers.status='approved', is_active).
-- * Majitel posilovny tréninky trenérů nemaže (žádná moderace přes admin).
-- * Trenér bez posilovny = jeho tréninky jsou skryté (nemažou se, jen se nezobrazují).
-- * Tréninky jde lajkovat.
-- * Připraveno na plány podle partie (focus: glutes = „super booty“, chest = „chest day“…).
--
-- is_public + share_token už existují = „kdo má odkaz, ten vidí“.
-- published_at = navíc je v katalogu. Zveřejnění vyžaduje is_public, takže stávající
-- RLS politiky „Public plan days/exercises are viewable by anyone“ pokrývají i katalog.

ALTER TABLE custom_plans
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS goal text,
  ADD COLUMN IF NOT EXISTS level text,
  ADD COLUMN IF NOT EXISTS focus text,
  ADD COLUMN IF NOT EXISTS trainer_id uuid REFERENCES gym_trainers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_plan_id uuid REFERENCES custom_plans(id) ON DELETE SET NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'custom_plans_published_requires_public') THEN
    ALTER TABLE custom_plans ADD CONSTRAINT custom_plans_published_requires_public
      CHECK (published_at IS NULL OR (is_public AND trainer_id IS NOT NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'custom_plans_goal_check') THEN
    ALTER TABLE custom_plans ADD CONSTRAINT custom_plans_goal_check
      CHECK (goal IS NULL OR goal IN ('strength', 'muscle', 'weight_loss', 'endurance', 'general'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'custom_plans_level_check') THEN
    ALTER TABLE custom_plans ADD CONSTRAINT custom_plans_level_check
      CHECK (level IS NULL OR level IN ('beginner', 'intermediate', 'advanced'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'custom_plans_focus_check') THEN
    ALTER TABLE custom_plans ADD CONSTRAINT custom_plans_focus_check
      CHECK (focus IS NULL OR focus IN ('full_body', 'glutes', 'legs', 'chest', 'back', 'arms', 'shoulders', 'core'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'custom_plans_description_length') THEN
    ALTER TABLE custom_plans ADD CONSTRAINT custom_plans_description_length
      CHECK (description IS NULL OR char_length(description) <= 500);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS custom_plans_published_idx
  ON custom_plans (published_at DESC) WHERE published_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS custom_plans_source_plan_idx
  ON custom_plans (source_plan_id) WHERE source_plan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS custom_plans_trainer_idx
  ON custom_plans (trainer_id) WHERE trainer_id IS NOT NULL;

-- Aktivní trenérský záznam přihlášeného uživatele (schválený + aktivní pod existující posilovnou).
CREATE OR REPLACE FUNCTION my_active_trainer_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT gt.id
  FROM gym_trainers gt
  JOIN gyms g ON g.id = gt.gym_id
  WHERE gt.user_id = auth.uid()
    AND gt.status = 'approved'
    AND coalesce(gt.is_active, true)
  ORDER BY gt.created_at
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION my_active_trainer_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION my_active_trainer_id() TO authenticated;

-- Strážce zveřejnění: z appky (auth.uid() je vyplněné) smí plán do katalogu dát jen trenér
-- a jen pod svým vlastním trenérským záznamem. trainer_id se doplní sám.
-- Přímé SQL / service role (auth.uid() je NULL) projde — seed dat, údržba.
CREATE OR REPLACE FUNCTION custom_plans_guard_publish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_trainer uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  -- Kopie z katalogu nesmí převzít zveřejnění ani autorství.
  IF TG_OP = 'INSERT' AND NEW.published_at IS NULL THEN
    NEW.trainer_id := NULL;
    RETURN NEW;
  END IF;

  IF NEW.published_at IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.published_at IS NULL OR NEW.trainer_id IS DISTINCT FROM OLD.trainer_id) THEN
    v_trainer := my_active_trainer_id();
    IF v_trainer IS NULL THEN
      RAISE EXCEPTION 'only_trainers_can_publish' USING ERRCODE = '42501';
    END IF;
    NEW.trainer_id := v_trainer;
    NEW.is_public := true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS custom_plans_guard_publish ON custom_plans;
CREATE TRIGGER custom_plans_guard_publish
  BEFORE INSERT OR UPDATE OF published_at, trainer_id ON custom_plans
  FOR EACH ROW EXECUTE FUNCTION custom_plans_guard_publish();

-- Lajky
CREATE TABLE IF NOT EXISTS workout_likes (
  plan_id uuid NOT NULL REFERENCES custom_plans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_id, user_id)
);

ALTER TABLE workout_likes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workout_likes' AND policyname = 'Users see own likes') THEN
    CREATE POLICY "Users see own likes" ON workout_likes FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workout_likes' AND policyname = 'Users like published plans') THEN
    CREATE POLICY "Users like published plans" ON workout_likes FOR INSERT WITH CHECK (
      auth.uid() = user_id
      AND EXISTS (SELECT 1 FROM custom_plans p WHERE p.id = plan_id AND p.published_at IS NOT NULL)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workout_likes' AND policyname = 'Users remove own likes') THEN
    CREATE POLICY "Users remove own likes" ON workout_likes FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Katalog. Viditelný jen plán trenéra, který je schválený a aktivní pod existující posilovnou.
-- Ukázková posilovna (demo pro obchod) je vidět jen adminům a jejím členům.
DROP FUNCTION IF EXISTS list_public_workouts(uuid, boolean, text, text, int);
DROP FUNCTION IF EXISTS list_public_workouts(uuid, text, text, text, text, int);
CREATE OR REPLACE FUNCTION list_public_workouts(
  p_gym_id uuid DEFAULT NULL,
  p_goal text DEFAULT NULL,
  p_focus text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_sort text DEFAULT 'popular',
  p_limit int DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  goal text,
  level text,
  focus text,
  share_token uuid,
  published_at timestamptz,
  is_own boolean,
  trainer_name text,
  trainer_photo_url text,
  trainer_gym_name text,
  day_count int,
  exercise_count int,
  save_count int,
  like_count int,
  liked_by_me boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH viewer AS (
    SELECT
      auth.uid() AS uid,
      coalesce(has_role(auth.uid(), 'admin'::app_role), false) AS is_admin,
      (SELECT up.selected_gym_id FROM user_profiles up WHERE up.user_id = auth.uid()) AS gym_id
  ),
  rows AS (
    SELECT
      p.id, p.name, p.description, p.goal, p.level, p.focus, p.share_token, p.published_at,
      p.user_id = v.uid AS is_own,
      gt.name AS trainer_name,
      gt.photo_url AS trainer_photo_url,
      g.name AS trainer_gym_name,
      (SELECT count(*)::int FROM custom_plan_days d WHERE d.plan_id = p.id) AS day_count,
      (SELECT count(*)::int FROM custom_plan_exercises e
         JOIN custom_plan_days d ON d.id = e.day_id WHERE d.plan_id = p.id) AS exercise_count,
      (SELECT count(*)::int FROM custom_plans c WHERE c.source_plan_id = p.id) AS save_count,
      (SELECT count(*)::int FROM workout_likes l WHERE l.plan_id = p.id) AS like_count,
      EXISTS (SELECT 1 FROM workout_likes l WHERE l.plan_id = p.id AND l.user_id = v.uid) AS liked_by_me
    FROM custom_plans p
    CROSS JOIN viewer v
    JOIN gym_trainers gt ON gt.id = p.trainer_id
    JOIN gyms g ON g.id = gt.gym_id
    WHERE v.uid IS NOT NULL
      AND p.published_at IS NOT NULL
      AND p.is_public
      AND gt.status = 'approved'
      AND coalesce(gt.is_active, true)
      AND (g.id <> 'deadbeef-0000-4000-8000-000000000001'::uuid OR v.is_admin OR v.gym_id = g.id)
      AND (p_gym_id IS NULL OR g.id = p_gym_id)
      AND (p_goal IS NULL OR p.goal = p_goal)
      AND (p_focus IS NULL OR p.focus = p_focus)
      AND (p_search IS NULL OR p.name ILIKE '%' || p_search || '%'
           OR p.description ILIKE '%' || p_search || '%' OR gt.name ILIKE '%' || p_search || '%')
  )
  SELECT * FROM rows
  ORDER BY
    CASE WHEN p_sort = 'newest' THEN 0 ELSE like_count + save_count END DESC,
    published_at DESC
  LIMIT least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

REVOKE ALL ON FUNCTION list_public_workouts(uuid, text, text, text, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION list_public_workouts(uuid, text, text, text, text, int) TO authenticated;
