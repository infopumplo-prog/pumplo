-- Volba „Tréninky od trenérů“ na konci dotazníku (David 17. 10. 2026): počítá se
-- i skrytá posilovna Pumplo (is_published = false), kde publikují Adam a Benda.
-- Dřív podmínka g.is_published tým Pumplo vyřadila → volba by zůstala zašedlá.
-- Opakovatelné (CREATE OR REPLACE). Návrat: stejná funkce s „AND g.is_published“.

CREATE OR REPLACE FUNCTION public.onboarding_social_proof()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        AND (g.is_published OR g.id = 'f0f0f0f0-0000-4000-8000-000000000001'::uuid)
        AND g.id <> 'deadbeef-0000-4000-8000-000000000001'::uuid
    ),
    'goal_share', coalesce((
      SELECT jsonb_object_agg(primary_goal, round(n::numeric / NULLIF(total, 0), 3))
      FROM (SELECT primary_goal, count(*) AS n, sum(count(*)) OVER () AS total FROM members GROUP BY primary_goal) g
    ), '{}'::jsonb)
  );
$function$;
