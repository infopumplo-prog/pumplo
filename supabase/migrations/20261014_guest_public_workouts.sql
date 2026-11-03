-- Režim „Vyzkoušet bez registrace“ (feedback 13. 10.): katalog veřejných tréninků musí jít
-- načíst i bez účtu (role anon). Funkce je stejná jako v 20261008d, jen:
--   * pryč podmínka `v.uid IS NOT NULL` (host = auth.uid() NULL),
--   * is_own přes coalesce (pro hosta false, ne NULL),
--   * GRANT EXECUTE i pro anon.
-- Host vidí jen to, co je stejně veřejné (is_public + published_at, schválený trenér),
-- demo posilovna zůstává skrytá. liked_by_me je pro hosta vždy false.
-- Opakovatelné: CREATE OR REPLACE se stejnou signaturou i návratovým typem.

CREATE OR REPLACE FUNCTION public.list_public_workouts(
  p_gym_id uuid DEFAULT NULL::uuid,
  p_goal text DEFAULT NULL::text,
  p_focus text DEFAULT NULL::text,
  p_search text DEFAULT NULL::text,
  p_sort text DEFAULT 'popular'::text,
  p_limit integer DEFAULT 50
)
RETURNS TABLE(id uuid, name text, name_en text, description text, description_en text, goal text, level text, focus text, secondary_focuses text[], cover_url text, share_token uuid, published_at timestamp with time zone, is_own boolean, trainer_name text, trainer_photo_url text, trainer_gym_name text, day_count integer, exercise_count integer, save_count integer, like_count integer, liked_by_me boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      coalesce(p.user_id = v.uid, false) AS is_own,
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
    WHERE p.published_at IS NOT NULL
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
$function$;

REVOKE ALL ON FUNCTION public.list_public_workouts(uuid, text, text, text, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_workouts(uuid, text, text, text, text, int) TO anon, authenticated;

-- ROLLBACK (vrátit katalog jen pro přihlášené):
-- REVOKE EXECUTE ON FUNCTION public.list_public_workouts(uuid, text, text, text, text, int) FROM anon;
-- a znovu spustit CREATE OR REPLACE z 20261008d_public_workouts_secondary_focus.sql
-- (s podmínkou `WHERE v.uid IS NOT NULL` a `p.user_id = v.uid AS is_own`).
