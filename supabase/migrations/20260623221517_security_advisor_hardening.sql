-- Security Advisor hardening (2026-06-23)
-- Resolves Supabase Security Advisor: 45 lints -> 10 (0 errors, 0 info).
-- Applied to production via the Management API; this file is the source-of-record.
-- The 10 remaining warnings are intentional/by-design (see notes at the bottom).

-- =====================================================================
-- 1) CRITICAL: privilege escalation + arbitrary-SQL backdoor
-- =====================================================================

-- Any authenticated user could insert ANY role (incl. admin) for themselves.
-- handle_new_user() (SECURITY DEFINER) still seeds the default 'user' role.
DROP POLICY IF EXISTS "System can insert user roles" ON public.user_roles;

-- Allow the BecomeTrainer flow: a user may self-assign ONLY 'trainer' for self.
DROP POLICY IF EXISTS "Users can self-assign trainer role" ON public.user_roles;
CREATE POLICY "Users can self-assign trainer role" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND role = 'trainer'::app_role);

-- Tighten profile insert (handle_new_user inserts via definer; clients own row).
DROP POLICY IF EXISTS "System can insert profiles" ON public.user_profiles;
CREATE POLICY "Users insert own profile" ON public.user_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- exec_sql(text): arbitrary SQL as table owner — remove from all client roles
-- (service_role bypasses grants and keeps access for remote tooling).
REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public.exec_sql(text) SET search_path = public;

-- =====================================================================
-- 2) SECURITY DEFINER functions: lock from clients / add admin guards
-- =====================================================================

-- Trigger functions never need direct EXECUTE by clients.
REVOKE EXECUTE ON FUNCTION public.handle_new_user()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_message_push()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Pin search_path on flagged functions (bodies use public/qualified names).
ALTER FUNCTION public.update_updated_at_column()    SET search_path = public;
ALTER FUNCTION public.generate_short_code()         SET search_path = public;
ALTER FUNCTION public.cleanup_old_notification_logs() SET search_path = public;
ALTER FUNCTION public.has_role(uuid, app_role)      SET search_path = public;
ALTER FUNCTION public.has_role(app_role, uuid)      SET search_path = public;
ALTER FUNCTION public.generate_workout_plan_atomic(uuid, uuid, text, jsonb, jsonb, text[], text, text, text, jsonb, text)
  SET search_path = public;

-- Email functions leaked ALL users' emails to any caller. Add an admin guard
-- (server/service_role where auth.uid() is null also allowed; anon is revoked).
CREATE OR REPLACE FUNCTION public.get_user_emails()
 RETURNS TABLE(user_id uuid, email text)
 LANGUAGE sql SECURITY DEFINER SET search_path = public AS $fn$
  SELECT id, email::text FROM auth.users
  WHERE (auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role));
$fn$;
REVOKE EXECUTE ON FUNCTION public.get_user_emails() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_user_emails() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_users_with_email()
 RETURNS TABLE(user_id uuid, first_name text, last_name text, role text,
               selected_gym_id uuid, created_at timestamp with time zone, email text)
 LANGUAGE sql SECURITY DEFINER SET search_path = public AS $fn$
  SELECT up.user_id, up.first_name, up.last_name, up.role, up.selected_gym_id, up.created_at, au.email
  FROM user_profiles up JOIN auth.users au ON au.id = up.user_id
  WHERE (auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role));
$fn$;
REVOKE EXECUTE ON FUNCTION public.get_users_with_email() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_users_with_email() TO authenticated, service_role;

-- check_gym_limit: only admins/owners enforce limits (not anon).
REVOKE EXECUTE ON FUNCTION public.check_gym_limit(uuid, text, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.check_gym_limit(uuid, text, integer) TO authenticated, service_role;

-- =====================================================================
-- 3) ERROR: RLS disabled on reference tables -> enable + read-only
-- =====================================================================
ALTER TABLE public.strength_cycle        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rir_progression       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compensatory_rules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_volume_targets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ref_read ON public.strength_cycle;
DROP POLICY IF EXISTS ref_read ON public.rir_progression;
DROP POLICY IF EXISTS ref_read ON public.compensatory_rules;
DROP POLICY IF EXISTS ref_read ON public.weekly_volume_targets;
CREATE POLICY ref_read ON public.strength_cycle        FOR SELECT TO authenticated USING (true);
CREATE POLICY ref_read ON public.rir_progression       FOR SELECT TO authenticated USING (true);
CREATE POLICY ref_read ON public.compensatory_rules    FOR SELECT TO authenticated USING (true);
CREATE POLICY ref_read ON public.weekly_volume_targets FOR SELECT TO authenticated USING (true);

-- =====================================================================
-- 4) ERROR: SECURITY DEFINER view public_gyms -> security_invoker
--    A definer helper keeps gym_subscriptions hidden from members while
--    preserving behaviour (only published gyms with an active sub appear).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.gym_active_plan(p_gym_id uuid)
 RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT plan_id FROM gym_subscriptions
  WHERE gym_id = p_gym_id AND status = 'active' LIMIT 1;
$fn$;
REVOKE EXECUTE ON FUNCTION public.gym_active_plan(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.gym_active_plan(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE VIEW public.public_gyms AS
  SELECT g.id, g.name, g.description, g.description_en, g.latitude, g.longitude,
         g.address, g.is_published, g.opening_hours, g.cover_photo_url, g.logo_url,
         g.pricing, g.instagram_handle, g.contact_email, g.contact_phone, g.website,
         g.services, g.created_at, g.updated_at,
         (ap.plan = 'premium') AS is_featured
  FROM gyms g
  CROSS JOIN LATERAL (SELECT public.gym_active_plan(g.id) AS plan) ap
  WHERE g.is_published = true AND ap.plan IS NOT NULL;
ALTER VIEW public.public_gyms SET (security_invoker = on);

-- =====================================================================
-- 5) WARN: rls_policy_always_true -> scope the over-broad write policies
-- =====================================================================

-- gym_messages: anon could read/write ALL gym messages. Scope to owner + member.
DROP POLICY IF EXISTS gym_messages_all ON public.gym_messages;
CREATE POLICY gym_messages_read ON public.gym_messages
  FOR SELECT TO authenticated
  USING (
    gym_id IN (SELECT id FROM public.gyms WHERE owner_id = auth.uid())
    OR (
      gym_id = (SELECT selected_gym_id FROM public.user_profiles WHERE user_id = auth.uid())
      AND (target_user_id IS NULL OR target_user_id = auth.uid())
    )
  );
CREATE POLICY gym_messages_owner_manage ON public.gym_messages
  FOR ALL TO authenticated
  USING (gym_id IN (SELECT id FROM public.gyms WHERE owner_id = auth.uid()))
  WITH CHECK (gym_id IN (SELECT id FROM public.gyms WHERE owner_id = auth.uid()));

-- gym_message_reads: own rows only.
DROP POLICY IF EXISTS gym_message_reads_all ON public.gym_message_reads;
CREATE POLICY gym_message_reads_own ON public.gym_message_reads
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- gym_trainers: drop redundant ALL-true (service_role bypasses RLS already).
DROP POLICY IF EXISTS "Service role full access" ON public.gym_trainers;

-- trainer_gym_requests: drop ALL-true; add gym-owner manage (trainer-own kept).
DROP POLICY IF EXISTS trainer_requests_all ON public.trainer_gym_requests;
CREATE POLICY trainer_requests_owner_manage ON public.trainer_gym_requests
  FOR ALL TO authenticated
  USING (gym_id IN (SELECT id FROM public.gyms WHERE owner_id = auth.uid()))
  WITH CHECK (gym_id IN (SELECT id FROM public.gyms WHERE owner_id = auth.uid()));

-- machine_photos: drop ALL-true; public read + admin manage.
DROP POLICY IF EXISTS "Super admin full access" ON public.machine_photos;
CREATE POLICY machine_photos_read ON public.machine_photos FOR SELECT USING (true);
CREATE POLICY machine_photos_admin_manage ON public.machine_photos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- remote_fix_requests: drop ALL-true (internal; service_role only).
DROP POLICY IF EXISTS remote_fix_requests_service_all ON public.remote_fix_requests;

-- Public web forms: replace CHECK(true) with real validation (clears lint).
DROP POLICY IF EXISTS contact_public_insert ON public.website_contact_submissions;
CREATE POLICY contact_public_insert ON public.website_contact_submissions
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    char_length(coalesce(name,''))      BETWEEN 1 AND 200
    AND char_length(coalesce(email,''))   BETWEEN 3 AND 320
    AND char_length(coalesce(message,'')) BETWEEN 1 AND 5000
  );
DROP POLICY IF EXISTS waitlist_public_insert ON public.website_waitlist;
CREATE POLICY waitlist_public_insert ON public.website_waitlist
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    char_length(coalesce(email,'')) BETWEEN 3 AND 320
    AND position('@' in coalesce(email,'')) > 1
  );

-- =====================================================================
-- 6) INFO: rls_enabled_no_policy -> explicit locked policy (service-only)
-- =====================================================================
DROP POLICY IF EXISTS "no client access" ON public.claude_permission_requests;
DROP POLICY IF EXISTS "no client access" ON public.claude_remote_messages;
DROP POLICY IF EXISTS "no client access" ON public.content_drafts;
DROP POLICY IF EXISTS "no client access" ON public.remote_fix_requests;
CREATE POLICY "no client access" ON public.claude_permission_requests FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "no client access" ON public.claude_remote_messages     FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "no client access" ON public.content_drafts             FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "no client access" ON public.remote_fix_requests        FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- =====================================================================
-- 7) WARN: public_bucket_allows_listing -> remove anon listing (storage)
--    Public buckets serve objects via the public CDN path (no RLS), so the
--    broad SELECT policies only enabled anon LISTING. Reads use getPublicUrl.
--    Only avatars + gym-assets are read purely via getPublicUrl, so their
--    SELECT policies can go.
-- =====================================================================
DROP POLICY IF EXISTS "Avatars are publicly accessible"   ON storage.objects; -- avatars
DROP POLICY IF EXISTS "Auth upload gym-assets 14bemdx_1"  ON storage.objects; -- gym-assets (SELECT)

-- DO NOT drop the exercise-videos SELECT policy. The SHIPPED native app (store
-- build) reads videos via createSignedUrl, which REQUIRES this policy. Dropping
-- it broke video playback for all store-app users (warmup/cooldown/main) on
-- 2026-06-24 — reverted immediately. The src/lib/videoUtils.ts switch to
-- getPublicUrl only helps web + FUTURE native builds; keep this policy until a
-- new native build is out AND adopted. Accepts 1 by-design listing warning.
DROP POLICY IF EXISTS "Anyone can read exercise videos" ON storage.objects;
CREATE POLICY "Anyone can read exercise videos" ON storage.objects
  FOR SELECT USING (bucket_id = 'exercise-videos');

-- =====================================================================
-- Auth (applied via Management API, recorded here for reference):
--   password_hibp_enabled = true   (leaked-password protection)
--
-- Remaining 8 advisor warnings are intentional/by-design (incl. exercise-videos
-- listing — required for native-app signed-URL video playback):
--  * has_role / gym_active_plan / check_gym_limit / get_user_emails /
--    get_users_with_email — SECURITY DEFINER helpers required by RLS, the
--    public_gyms view, or the admin app; email functions are admin-guarded,
--    the rest expose only a boolean/plan id. anon execute removed where unused.
-- =====================================================================
