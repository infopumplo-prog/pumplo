-- Veřejné tréninky: obálka tréninku (obrázek od trenéra).
-- Trenér nahraje obrázek do gym-assets/workout-covers/<uid>/…; bez obálky appka
-- ukáže obrázek partie (focus). Katalog nově vrací cover_url.

ALTER TABLE custom_plans ADD COLUMN IF NOT EXISTS cover_url text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'custom_plans_cover_url_length') THEN
    ALTER TABLE custom_plans ADD CONSTRAINT custom_plans_cover_url_length
      CHECK (cover_url IS NULL OR char_length(cover_url) <= 1000);
  END IF;
END $$;

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
  cover_url text,
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
      (SELECT up.selected_gym_id FROM user_profiles up WHERE up.user_id = auth.uid() LIMIT 1) AS gym_id
  ),
  rows AS (
    SELECT
      p.id, p.name, p.description, p.goal, p.level, p.focus, p.cover_url, p.share_token, p.published_at,
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

-- Demo obálky (soubory jsou přibalené v appce: public/img/workouts/).
UPDATE custom_plans SET cover_url = '/img/workouts/cover-silovy-zaklad.jpg' WHERE id = 'deadbeef-0000-4000-8000-0000000002a1';
UPDATE custom_plans SET cover_url = '/img/workouts/cover-silova-dvojka.jpg' WHERE id = 'deadbeef-0000-4000-8000-0000000002a2';
UPDATE custom_plans SET cover_url = '/img/workouts/cover-ppl.jpg' WHERE id = 'deadbeef-0000-4000-8000-0000000002b1';
UPDATE custom_plans SET cover_url = '/img/workouts/cover-chest-arms.jpg' WHERE id = 'deadbeef-0000-4000-8000-0000000002b2';
UPDATE custom_plans SET cover_url = '/img/workouts/cover-spaluj.jpg' WHERE id = 'deadbeef-0000-4000-8000-0000000002c1';
UPDATE custom_plans SET cover_url = '/img/workouts/cover-super-booty.jpg' WHERE id = 'deadbeef-0000-4000-8000-0000000002c2';
