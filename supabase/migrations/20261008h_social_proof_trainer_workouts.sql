-- Onboarding 2.0: volba „Hotový plán od trenéra“ se nabídne, jen když v katalogu nějaký trénink je
-- (David 8. 10. 2026). Počítají se jen tréninky, které uvidí běžný nový uživatel: zveřejněné,
-- trenér schválený a aktivní, posilovna publikovaná, mimo ukázkovou demo posilovnu.
CREATE OR REPLACE FUNCTION onboarding_social_proof()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH members AS (
    SELECT primary_goal
    FROM user_profiles
    WHERE onboarding_completed
      AND selected_gym_id IS DISTINCT FROM 'deadbeef-0000-4000-8000-000000000001'::uuid
      AND primary_goal IS NOT NULL
  )
  SELECT jsonb_build_object(
    'exercises_with_video', (SELECT count(*) FROM exercises WHERE owner_id IS NULL AND video_path IS NOT NULL),
    'gyms', (SELECT count(*) FROM gyms WHERE is_published),
    'members', (SELECT count(*) FROM members),
    'trainer_workouts', (
      SELECT count(*)
      FROM custom_plans p
      JOIN gym_trainers gt ON gt.id = p.trainer_id
      JOIN gyms g ON g.id = gt.gym_id
      WHERE p.published_at IS NOT NULL AND p.is_public
        AND gt.status = 'approved' AND coalesce(gt.is_active, true)
        AND g.is_published
        AND g.id <> 'deadbeef-0000-4000-8000-000000000001'::uuid
    ),
    'goal_share', coalesce((
      SELECT jsonb_object_agg(primary_goal, round(n::numeric / NULLIF(total, 0), 3))
      FROM (SELECT primary_goal, count(*) AS n, sum(count(*)) OVER () AS total FROM members GROUP BY primary_goal) g
    ), '{}'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION onboarding_social_proof() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION onboarding_social_proof() TO anon, authenticated;
