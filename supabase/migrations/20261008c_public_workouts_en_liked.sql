-- Veřejné tréninky, kolo 3 (David 8. 10.):
-- * partie = skutečné partie těla jako kategorie cviků v appce, přibylo Kardio
-- * řazení „Liked“ = jen tréninky, které jsem olajkoval
-- * anglické verze názvu a popisu (appka v angličtině nemá ukazovat češtinu)

ALTER TABLE custom_plans DROP CONSTRAINT IF EXISTS custom_plans_focus_check;
ALTER TABLE custom_plans ADD CONSTRAINT custom_plans_focus_check
  CHECK (focus IS NULL OR focus IN ('full_body', 'glutes', 'legs', 'chest', 'back', 'arms', 'shoulders', 'core', 'cardio'));

ALTER TABLE custom_plans
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS description_en text;
ALTER TABLE custom_plan_days ADD COLUMN IF NOT EXISTS name_en text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'custom_plans_description_en_length') THEN
    ALTER TABLE custom_plans ADD CONSTRAINT custom_plans_description_en_length
      CHECK (description_en IS NULL OR char_length(description_en) <= 500);
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
      p.id, p.name, p.name_en, p.description, p.description_en, p.goal, p.level, p.focus, p.cover_url,
      p.share_token, p.published_at,
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
      AND (p_search IS NULL
           OR p.name ILIKE '%' || p_search || '%' OR p.name_en ILIKE '%' || p_search || '%'
           OR p.description ILIKE '%' || p_search || '%' OR p.description_en ILIKE '%' || p_search || '%'
           OR gt.name ILIKE '%' || p_search || '%')
  )
  SELECT * FROM rows
  WHERE p_sort IS DISTINCT FROM 'liked' OR liked_by_me
  ORDER BY
    CASE WHEN p_sort = 'newest' THEN 0 ELSE like_count + save_count END DESC,
    published_at DESC
  LIMIT least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

REVOKE ALL ON FUNCTION list_public_workouts(uuid, text, text, text, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION list_public_workouts(uuid, text, text, text, text, int) TO authenticated;

-- Demo: partie podle skutečných partií + anglické texty.
UPDATE custom_plans SET focus = 'cardio' WHERE id = 'deadbeef-0000-4000-8000-0000000002c1';
UPDATE custom_plans SET name_en = 'Strength Base 5×5',
  description_en = 'The strength classic: three compound lifts per session, five sets of five. Add 2.5 kg every week. Best 3× a week, alternate days A and B.'
  WHERE id = 'deadbeef-0000-4000-8000-0000000002a1';
UPDATE custom_plans SET name_en = 'Strength Split: Upper / Lower',
  description_en = 'For advanced lifters: heavy triples on the main lifts plus accessories for weak points. 4× a week, upper and lower body.'
  WHERE id = 'deadbeef-0000-4000-8000-0000000002a2';
UPDATE custom_plans SET name_en = 'Push / Pull / Legs — Volume',
  description_en = 'Three days with enough volume for every muscle. 8–12 reps, last set close to failure. Repeat twice a week.'
  WHERE id = 'deadbeef-0000-4000-8000-0000000002b1';
UPDATE custom_plans SET name_en = 'Chest & Arms Day',
  description_en = 'Chest, biceps and triceps in one session. Controlled lowering and full range of motion — pump guaranteed.'
  WHERE id = 'deadbeef-0000-4000-8000-0000000002b2';
UPDATE custom_plans SET name_en = 'Burn & Build — Full Body',
  description_en = 'Fat-loss circuit: cardio warm-up, then full-body exercises with short rests. Beginner friendly, 2–3× a week.'
  WHERE id = 'deadbeef-0000-4000-8000-0000000002c1';
UPDATE custom_plans SET name_en = 'Super Booty',
  description_en = 'Glutes and hamstrings. Hip thrusts, lunges and cables — firms, shapes and gets the blood pumping.'
  WHERE id = 'deadbeef-0000-4000-8000-0000000002c2';

UPDATE custom_plan_days d SET name_en = v.en
FROM (VALUES ('Den A', 'Day A'), ('Den B', 'Day B'), ('Horní polovina', 'Upper body'), ('Spodní polovina', 'Lower body'),
             ('Push', 'Push'), ('Pull', 'Pull'), ('Legs', 'Legs'), ('Chest & Arms', 'Chest & Arms'),
             ('Okruh 1', 'Circuit 1'), ('Okruh 2', 'Circuit 2'), ('Super booty', 'Super booty')) AS v(cs, en)
WHERE d.name = v.cs AND d.plan_id::text LIKE 'deadbeef-0000-4000-8000-0000000002%';
