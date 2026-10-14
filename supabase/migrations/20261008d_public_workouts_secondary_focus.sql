-- Veřejné tréninky, kolo 4 (David 8. 10.): jedna hlavní partie + další (sekundární) partie.
-- Filtr partie v katalogu najde hlavní i sekundární shodu; hlavní shody jdou první.

ALTER TABLE custom_plans ADD COLUMN IF NOT EXISTS secondary_focuses text[] NOT NULL DEFAULT '{}';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'custom_plans_secondary_focuses_check') THEN
    ALTER TABLE custom_plans ADD CONSTRAINT custom_plans_secondary_focuses_check
      CHECK (
        secondary_focuses <@ ARRAY['full_body', 'glutes', 'legs', 'chest', 'back', 'arms', 'shoulders', 'core', 'cardio']::text[]
        AND cardinality(secondary_focuses) <= 8
        AND (focus IS NULL OR NOT focus = ANY (secondary_focuses))
      );
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
  name_en text,
  description text,
  description_en text,
  goal text,
  level text,
  focus text,
  secondary_focuses text[],
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
      p.id, p.name, p.name_en, p.description, p.description_en, p.goal, p.level, p.focus, p.secondary_focuses,
      p.cover_url, p.share_token, p.published_at,
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
      AND (p_focus IS NULL OR p.focus = p_focus OR p_focus = ANY (p.secondary_focuses))
      AND (p_search IS NULL
           OR p.name ILIKE '%' || p_search || '%' OR p.name_en ILIKE '%' || p_search || '%'
           OR p.description ILIKE '%' || p_search || '%' OR p.description_en ILIKE '%' || p_search || '%'
           OR gt.name ILIKE '%' || p_search || '%')
  )
  SELECT * FROM rows
  WHERE p_sort IS DISTINCT FROM 'liked' OR liked_by_me
  ORDER BY
    (p_focus IS NOT NULL AND focus = p_focus) DESC,
    CASE WHEN p_sort = 'newest' THEN 0 ELSE like_count + save_count END DESC,
    published_at DESC
  LIMIT least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

REVOKE ALL ON FUNCTION list_public_workouts(uuid, text, text, text, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION list_public_workouts(uuid, text, text, text, text, int) TO authenticated;

-- Demo: další partie.
UPDATE custom_plans SET secondary_focuses = ARRAY['legs', 'back'] WHERE id = 'deadbeef-0000-4000-8000-0000000002a1';
UPDATE custom_plans SET secondary_focuses = ARRAY['chest', 'back', 'legs'] WHERE id = 'deadbeef-0000-4000-8000-0000000002a2';
UPDATE custom_plans SET secondary_focuses = ARRAY['chest', 'back', 'legs', 'shoulders'] WHERE id = 'deadbeef-0000-4000-8000-0000000002b1';
UPDATE custom_plans SET secondary_focuses = ARRAY['arms'] WHERE id = 'deadbeef-0000-4000-8000-0000000002b2';
UPDATE custom_plans SET secondary_focuses = ARRAY['full_body', 'legs'] WHERE id = 'deadbeef-0000-4000-8000-0000000002c1';
UPDATE custom_plans SET secondary_focuses = ARRAY['legs'] WHERE id = 'deadbeef-0000-4000-8000-0000000002c2';
