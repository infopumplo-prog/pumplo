-- Trenérská platforma (26. 10. 2026, zadání Adam Kakiš, rozhodnutí David)
-- Trenér (role trainer, i bez posilovny) si pozve klienta odkazem/e-mailem,
-- přiřazuje mu kopie svých šablon jako plány na N týdnů, vidí jeho tréninky,
-- plnění plánu, obtížnost + poznámku po tréninku a dává srdíčka.
-- Klient trénuje v appce dál, co si sám vybere (přiřazený plán je jen nabídka).
-- Bez chatu, bez výživy, bez plateb. Prvních 10 trenérů má platformu zdarma (trainer_access),
-- počet klientů neomezený (David 26. 10.).
-- Opakovatelná: IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS.

-- ───────────────────────── Šablony ─────────────────────────
ALTER TABLE public.custom_plans
  ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS template_visibility text NOT NULL DEFAULT 'private';

DO $$ BEGIN
  ALTER TABLE public.custom_plans
    ADD CONSTRAINT custom_plans_template_visibility_check CHECK (template_visibility IN ('private', 'public'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS custom_plans_public_templates_idx
  ON public.custom_plans (created_at DESC) WHERE is_template AND template_visibility = 'public';

-- ───────────────────────── Vazba trenér ↔ klient ─────────────────────────
CREATE TABLE IF NOT EXISTS public.trainer_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_email text,
  invite_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'ended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  ended_at timestamptz,
  CHECK (client_user_id IS NULL OR client_user_id <> trainer_user_id)
);
-- Kdy naposled odešel e-mail s pozvánkou (edge funkce trainer-invite-email, limit 1× za 10 min).
ALTER TABLE public.trainer_clients ADD COLUMN IF NOT EXISTS invite_email_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS trainer_clients_trainer_idx ON public.trainer_clients (trainer_user_id, status);
CREATE INDEX IF NOT EXISTS trainer_clients_client_idx ON public.trainer_clients (client_user_id, status);
-- Jeden trenér má s jedním klientem nanejvýš jednu živou vazbu.
CREATE UNIQUE INDEX IF NOT EXISTS trainer_clients_one_live_idx
  ON public.trainer_clients (trainer_user_id, client_user_id)
  WHERE client_user_id IS NOT NULL AND status <> 'ended';

-- ───────────────────────── Přiřazené plány ─────────────────────────
CREATE TABLE IF NOT EXISTS public.trainer_plan_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_client_id uuid NOT NULL REFERENCES public.trainer_clients(id) ON DELETE CASCADE,
  trainer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Kopie šablony patřící klientovi (custom_plans.user_id = klient).
  plan_id uuid REFERENCES public.custom_plans(id) ON DELETE SET NULL,
  source_template_id uuid REFERENCES public.custom_plans(id) ON DELETE SET NULL,
  -- Název pro historii, i když klient kopii smaže.
  plan_name text NOT NULL,
  start_date date NOT NULL,
  weeks int NOT NULL CHECK (weeks BETWEEN 1 AND 52),
  sessions_per_week int NOT NULL CHECK (sessions_per_week BETWEEN 1 AND 14),
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

CREATE INDEX IF NOT EXISTS trainer_plan_assignments_link_idx ON public.trainer_plan_assignments (trainer_client_id, start_date DESC);
CREATE INDEX IF NOT EXISTS trainer_plan_assignments_client_idx ON public.trainer_plan_assignments (client_user_id);
CREATE INDEX IF NOT EXISTS trainer_plan_assignments_plan_idx ON public.trainer_plan_assignments (plan_id);

-- ───────────────────────── Zpětná vazba po tréninku ─────────────────────────
ALTER TABLE public.workout_sessions
  ADD COLUMN IF NOT EXISTS client_difficulty smallint,
  ADD COLUMN IF NOT EXISTS client_note text;

DO $$ BEGIN
  ALTER TABLE public.workout_sessions
    ADD CONSTRAINT workout_sessions_client_difficulty_check CHECK (client_difficulty IS NULL OR client_difficulty BETWEEN 1 AND 5);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.workout_sessions
    ADD CONSTRAINT workout_sessions_client_note_len CHECK (client_note IS NULL OR char_length(client_note) <= 1000);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS workout_sessions_custom_plan_idx
  ON public.workout_sessions (custom_plan_id, completed_at) WHERE custom_plan_id IS NOT NULL;

-- ───────────────────────── Srdíčka od trenéra ─────────────────────────
CREATE TABLE IF NOT EXISTS public.trainer_session_reactions (
  session_id uuid NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  trainer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, trainer_user_id)
);

-- ───────────────────────── Pomocné funkce ─────────────────────────
-- Prvních N trenérů zdarma (pořadí podle prvního použití platformy). Jedno místo pro změnu.
DROP FUNCTION IF EXISTS public.trainer_free_client_limit();
CREATE OR REPLACE FUNCTION public.trainer_free_trainer_limit()
RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT 10 $$;

-- Přístup trenéra k platformě: founder_free = jeden z prvních 10, paid = ručně/po zaplacení,
-- waitlist = čeká na placený tarif (platby zatím nejsou). Zapisuje jen trainer_claim_access / admin.
CREATE TABLE IF NOT EXISTS public.trainer_access (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tier text NOT NULL CHECK (tier IN ('founder_free', 'paid', 'waitlist')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Jen pro přihlášeného (bez parametru), ať nejde zjišťovat role cizích lidí.
DROP FUNCTION IF EXISTS public.is_trainer(uuid);
CREATE OR REPLACE FUNCTION public.is_trainer()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'trainer'::app_role)
$$;

-- Je p_client aktivní klient přihlášeného trenéra?
CREATE OR REPLACE FUNCTION public.is_my_active_client(p_client uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM trainer_clients
    WHERE trainer_user_id = auth.uid() AND client_user_id = p_client AND status = 'active'
  )
$$;

-- Plán = kopie, kterou přihlášený trenér přiřadil svému aktivnímu klientovi.
CREATE OR REPLACE FUNCTION public.trainer_manages_plan(p_plan uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM trainer_plan_assignments a
    JOIN trainer_clients c ON c.id = a.trainer_client_id
    WHERE a.plan_id = p_plan AND a.trainer_user_id = auth.uid() AND c.status = 'active'
  )
$$;

-- Veřejná šablona viditelná pro trenéry.
CREATE OR REPLACE FUNCTION public.is_public_template(p_plan uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM custom_plans WHERE id = p_plan AND is_template AND template_visibility = 'public'
  )
$$;

-- Zobrazované jméno trenéra: profil v posilovně → jméno v appce → začátek e-mailu.
CREATE OR REPLACE FUNCTION public.trainer_display_name(p_user uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT gt.name FROM gym_trainers gt WHERE gt.user_id = p_user AND gt.is_active ORDER BY gt.created_at LIMIT 1),
    (SELECT NULLIF(trim(concat_ws(' ', up.first_name, up.last_name)), '') FROM user_profiles up WHERE up.user_id = p_user LIMIT 1),
    (SELECT split_part(u.email, '@', 1) FROM auth.users u WHERE u.id = p_user),
    'Trenér'
  )
$$;

-- ───────────────────────── RLS ─────────────────────────
ALTER TABLE public.trainer_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_plan_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_session_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trainer_access_read_own" ON public.trainer_access;
CREATE POLICY "trainer_access_read_own" ON public.trainer_access FOR SELECT
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "trainer_access_admin" ON public.trainer_access;
CREATE POLICY "trainer_access_admin" ON public.trainer_access FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Zápisy do vazeb a přiřazení jdou jen přes RPC níž (kontrola limitu, kopie plánu).
DROP POLICY IF EXISTS "trainer_clients_read" ON public.trainer_clients;
CREATE POLICY "trainer_clients_read" ON public.trainer_clients FOR SELECT
  USING (trainer_user_id = auth.uid() OR client_user_id = auth.uid());

DROP POLICY IF EXISTS "trainer_plan_assignments_read" ON public.trainer_plan_assignments;
CREATE POLICY "trainer_plan_assignments_read" ON public.trainer_plan_assignments FOR SELECT
  USING (trainer_user_id = auth.uid() OR client_user_id = auth.uid());

DROP POLICY IF EXISTS "trainer_reactions_read" ON public.trainer_session_reactions;
CREATE POLICY "trainer_reactions_read" ON public.trainer_session_reactions FOR SELECT
  USING (
    trainer_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM workout_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "trainer_reactions_insert" ON public.trainer_session_reactions;
CREATE POLICY "trainer_reactions_insert" ON public.trainer_session_reactions FOR INSERT
  WITH CHECK (
    trainer_user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM workout_sessions s WHERE s.id = session_id AND public.is_my_active_client(s.user_id))
  );
DROP POLICY IF EXISTS "trainer_reactions_delete" ON public.trainer_session_reactions;
CREATE POLICY "trainer_reactions_delete" ON public.trainer_session_reactions FOR DELETE
  USING (trainer_user_id = auth.uid());

-- Trenér čte tréninky (a série) svých aktivních klientů.
DROP POLICY IF EXISTS "Trainers read active clients sessions" ON public.workout_sessions;
CREATE POLICY "Trainers read active clients sessions" ON public.workout_sessions FOR SELECT
  USING (public.is_my_active_client(user_id));
DROP POLICY IF EXISTS "Trainers read active clients sets" ON public.workout_session_sets;
CREATE POLICY "Trainers read active clients sets" ON public.workout_session_sets FOR SELECT
  USING (EXISTS (SELECT 1 FROM workout_sessions s WHERE s.id = session_id AND public.is_my_active_client(s.user_id)));

-- Trenér čte a upravuje kopie, které přiřadil aktivním klientům; trenéři čtou veřejné šablony.
DROP POLICY IF EXISTS "Trainers read managed or public template plans" ON public.custom_plans;
CREATE POLICY "Trainers read managed or public template plans" ON public.custom_plans FOR SELECT
  USING (public.trainer_manages_plan(id) OR (is_template AND template_visibility = 'public' AND public.is_trainer()));
DROP POLICY IF EXISTS "Trainers update managed plans" ON public.custom_plans;
CREATE POLICY "Trainers update managed plans" ON public.custom_plans FOR UPDATE
  USING (public.trainer_manages_plan(id)) WITH CHECK (public.trainer_manages_plan(id));

-- Trenér smí u klientovy kopie měnit jen obsah (název, popis, pauzy…), ne vlastnictví ani zveřejnění.
CREATE OR REPLACE FUNCTION public.custom_plans_guard_foreign_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> OLD.user_id AND (
       NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.is_template IS DISTINCT FROM OLD.is_template
    OR NEW.template_visibility IS DISTINCT FROM OLD.template_visibility
    OR NEW.is_public IS DISTINCT FROM OLD.is_public
    OR NEW.share_token IS DISTINCT FROM OLD.share_token
    OR NEW.published_at IS DISTINCT FROM OLD.published_at
    OR NEW.source_plan_id IS DISTINCT FROM OLD.source_plan_id
    OR NEW.trainer_id IS DISTINCT FROM OLD.trainer_id
  ) AND NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'plan_owner_fields_locked' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS custom_plans_guard_foreign_update ON public.custom_plans;
CREATE TRIGGER custom_plans_guard_foreign_update BEFORE UPDATE ON public.custom_plans
  FOR EACH ROW EXECUTE FUNCTION public.custom_plans_guard_foreign_update();

DROP POLICY IF EXISTS "Trainers read managed or public template days" ON public.custom_plan_days;
CREATE POLICY "Trainers read managed or public template days" ON public.custom_plan_days FOR SELECT
  USING (public.trainer_manages_plan(plan_id) OR (public.is_public_template(plan_id) AND public.is_trainer()));
DROP POLICY IF EXISTS "Trainers write managed plan days" ON public.custom_plan_days;
CREATE POLICY "Trainers write managed plan days" ON public.custom_plan_days FOR ALL
  USING (public.trainer_manages_plan(plan_id)) WITH CHECK (public.trainer_manages_plan(plan_id));

DROP POLICY IF EXISTS "Trainers read managed or public template exercises" ON public.custom_plan_exercises;
CREATE POLICY "Trainers read managed or public template exercises" ON public.custom_plan_exercises FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM custom_plan_days d WHERE d.id = day_id
      AND (public.trainer_manages_plan(d.plan_id) OR (public.is_public_template(d.plan_id) AND public.is_trainer()))
  ));
DROP POLICY IF EXISTS "Trainers write managed plan exercises" ON public.custom_plan_exercises;
CREATE POLICY "Trainers write managed plan exercises" ON public.custom_plan_exercises FOR ALL
  USING (EXISTS (SELECT 1 FROM custom_plan_days d WHERE d.id = day_id AND public.trainer_manages_plan(d.plan_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM custom_plan_days d WHERE d.id = day_id AND public.trainer_manages_plan(d.plan_id)));

-- Vlastní cviky (exercises.owner_id) v plánech, které člověk smí číst
-- (klient vidí trenérovy vlastní cviky ve své kopii a naopak).
DROP POLICY IF EXISTS "exercises_read_in_readable_plans" ON public.exercises;
CREATE POLICY "exercises_read_in_readable_plans" ON public.exercises FOR SELECT
  USING (owner_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM custom_plan_exercises cpe
    JOIN custom_plan_days d ON d.id = cpe.day_id
    JOIN custom_plans p ON p.id = d.plan_id
    WHERE cpe.exercise_id = exercises.id
      -- Cvik musí patřit vlastníkovi plánu nebo trenérovi, který plán přiřadil — jinak by šlo
      -- vložit cizí exercise_id do vlastního plánu a cizí soukromý cvik si tak přečíst.
      AND (exercises.owner_id = p.user_id
           OR exercises.owner_id IN (SELECT a.trainer_user_id FROM trainer_plan_assignments a WHERE a.plan_id = p.id))
      AND (p.user_id = auth.uid() OR public.trainer_manages_plan(p.id)
           OR (p.is_template AND p.template_visibility = 'public' AND public.is_trainer()))
  ));

-- ───────────────────────── RPC: přístup trenéra ─────────────────────────
-- Zaregistruje trenéra do platformy (idempotentní): dokud je volné místo z prvních N → founder_free,
-- jinak waitlist. Zámek proti souběhu dvou trenérů o poslední místo.
CREATE OR REPLACE FUNCTION public.trainer_claim_access()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tier text;
BEGIN
  IF v_uid IS NULL OR NOT public.is_trainer() THEN
    RAISE EXCEPTION 'not_trainer' USING ERRCODE = '42501';
  END IF;
  SELECT tier INTO v_tier FROM trainer_access WHERE user_id = v_uid;
  IF FOUND THEN RETURN v_tier; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('trainer_access_claim'));
  SELECT tier INTO v_tier FROM trainer_access WHERE user_id = v_uid;
  IF FOUND THEN RETURN v_tier; END IF;
  v_tier := CASE WHEN (SELECT count(*) FROM trainer_access WHERE tier = 'founder_free') < public.trainer_free_trainer_limit()
                 THEN 'founder_free' ELSE 'waitlist' END;
  INSERT INTO trainer_access (user_id, tier) VALUES (v_uid, v_tier);
  RETURN v_tier;
END $$;

-- Stav pro UI: můj tarif (bez zápisu) a kolik míst zdarma zbývá.
CREATE OR REPLACE FUNCTION public.trainer_access_status()
RETURNS TABLE (tier text, free_limit int, free_taken int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (SELECT a.tier FROM trainer_access a WHERE a.user_id = auth.uid()),
         public.trainer_free_trainer_limit(),
         (SELECT count(*)::int FROM trainer_access a WHERE a.tier = 'founder_free')
$$;

-- ───────────────────────── RPC: pozvánky ─────────────────────────
-- Pozve klienta (e-mail volitelný — odkaz jde poslat i přes WhatsApp). Počet klientů neomezený;
-- trenér musí mít přístup (founder_free/paid).
-- Vrací vazbu s tokenem; stejný e-mail u živé pozvánky vrátí existující.
CREATE OR REPLACE FUNCTION public.trainer_invite_client(p_email text DEFAULT NULL)
RETURNS public.trainer_clients LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text := NULLIF(lower(trim(p_email)), '');
  v_row trainer_clients;
BEGIN
  IF v_uid IS NULL OR NOT public.is_trainer() THEN
    RAISE EXCEPTION 'not_trainer' USING ERRCODE = '42501';
  END IF;
  IF public.trainer_claim_access() NOT IN ('founder_free', 'paid') THEN
    RAISE EXCEPTION 'trainer_access_required' USING ERRCODE = 'P0001';
  END IF;
  IF v_email IS NOT NULL AND v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'invalid_email' USING ERRCODE = '22023';
  END IF;

  IF v_email IS NOT NULL THEN
    SELECT * INTO v_row FROM trainer_clients
      WHERE trainer_user_id = v_uid AND status <> 'ended'
        AND (invite_email = v_email
             OR client_user_id = (SELECT id FROM auth.users WHERE lower(email) = v_email LIMIT 1))
      ORDER BY created_at LIMIT 1;
    IF FOUND THEN RETURN v_row; END IF;
  END IF;

  INSERT INTO trainer_clients (trainer_user_id, invite_email)
    VALUES (v_uid, v_email) RETURNING * INTO v_row;
  RETURN v_row;
END $$;

-- Pro stránku pozvánky před přihlášením: jen jméno trenéra a jestli pozvánka platí.
CREATE OR REPLACE FUNCTION public.trainer_invite_info(p_token uuid)
RETURNS TABLE (trainer_name text, trainer_photo text, is_valid boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.trainer_display_name(c.trainer_user_id),
         (SELECT gt.photo_url FROM gym_trainers gt WHERE gt.user_id = c.trainer_user_id AND gt.is_active ORDER BY gt.created_at LIMIT 1),
         c.status = 'invited'
  FROM trainer_clients c WHERE c.invite_token = p_token
$$;

-- Klient přijme pozvánku (po registraci automaticky z appky).
CREATE OR REPLACE FUNCTION public.trainer_accept_invite(p_token uuid)
RETURNS TABLE (link_id uuid, trainer_name text, status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row trainer_clients;
  v_live trainer_clients;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_row FROM trainer_clients c WHERE c.invite_token = p_token FOR UPDATE;
  IF NOT FOUND OR v_row.status = 'ended' THEN
    RAISE EXCEPTION 'invite_invalid' USING ERRCODE = 'P0002';
  END IF;
  IF v_row.trainer_user_id = v_uid THEN
    RAISE EXCEPTION 'own_invite' USING ERRCODE = '22023';
  END IF;
  -- Už přijatá: stejný klient = idempotentní OK, jiný člověk = odkaz je použitý.
  IF v_row.client_user_id IS NOT NULL THEN
    IF v_row.client_user_id <> v_uid THEN
      RAISE EXCEPTION 'invite_used' USING ERRCODE = '22023';
    END IF;
    RETURN QUERY SELECT v_row.id, public.trainer_display_name(v_row.trainer_user_id), v_row.status;
    RETURN;
  END IF;
  -- Klient už u trenéra je (jiná pozvánka) → tuhle pozvánku zrušit, vrátit živou vazbu.
  SELECT * INTO v_live FROM trainer_clients c
    WHERE c.trainer_user_id = v_row.trainer_user_id AND c.client_user_id = v_uid AND c.status <> 'ended' LIMIT 1;
  IF FOUND THEN
    DELETE FROM trainer_clients c WHERE c.id = v_row.id;
    RETURN QUERY SELECT v_live.id, public.trainer_display_name(v_live.trainer_user_id), v_live.status;
    RETURN;
  END IF;

  UPDATE trainer_clients c SET client_user_id = v_uid, status = 'active', accepted_at = now()
    WHERE c.id = v_row.id RETURNING * INTO v_row;
  RETURN QUERY SELECT v_row.id, public.trainer_display_name(v_row.trainer_user_id), v_row.status;
END $$;

-- Ukončit spolupráci: trenér i klient. Pozvánka bez klienta se smaže (uvolní místo).
CREATE OR REPLACE FUNCTION public.trainer_end_client(p_link uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row trainer_clients;
BEGIN
  SELECT * INTO v_row FROM trainer_clients WHERE id = p_link
    AND (trainer_user_id = auth.uid() OR client_user_id = auth.uid());
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  IF v_row.client_user_id IS NULL THEN
    DELETE FROM trainer_clients WHERE id = p_link;
  ELSE
    UPDATE trainer_clients SET status = 'ended', ended_at = now() WHERE id = p_link AND status <> 'ended';
    UPDATE trainer_plan_assignments SET ended_at = COALESCE(ended_at, now()) WHERE trainer_client_id = p_link;
  END IF;
END $$;

-- ───────────────────────── RPC: přiřazení plánu ─────────────────────────
-- Zkopíruje šablonu (vlastní nebo veřejnou) klientovi a založí přiřazení.
CREATE OR REPLACE FUNCTION public.trainer_assign_plan(
  p_link uuid, p_template uuid, p_start date, p_weeks int, p_sessions_per_week int, p_name text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_link trainer_clients;
  v_tpl custom_plans;
  v_plan uuid;
  v_day record;
  v_new_day uuid;
  v_assignment uuid;
BEGIN
  SELECT * INTO v_link FROM trainer_clients WHERE id = p_link AND trainer_user_id = v_uid AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'client_not_active' USING ERRCODE = '42501'; END IF;
  IF public.trainer_claim_access() NOT IN ('founder_free', 'paid') THEN
    RAISE EXCEPTION 'trainer_access_required' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_tpl FROM custom_plans WHERE id = p_template
    AND (user_id = v_uid OR (is_template AND template_visibility = 'public'));
  IF NOT FOUND THEN RAISE EXCEPTION 'template_not_found' USING ERRCODE = 'P0002'; END IF;
  IF p_start IS NULL OR p_weeks IS NULL OR p_sessions_per_week IS NULL THEN
    RAISE EXCEPTION 'missing_params' USING ERRCODE = '22023';
  END IF;

  INSERT INTO custom_plans (user_id, name, rest_duration_seconds, description, goal, level, focus,
                            source_plan_id, cover_url, name_en, description_en, secondary_focuses)
    VALUES (v_link.client_user_id, COALESCE(NULLIF(trim(p_name), ''), v_tpl.name), v_tpl.rest_duration_seconds,
            v_tpl.description, v_tpl.goal, v_tpl.level, v_tpl.focus, v_tpl.id, v_tpl.cover_url,
            v_tpl.name_en, v_tpl.description_en, v_tpl.secondary_focuses)
    RETURNING id INTO v_plan;

  FOR v_day IN SELECT * FROM custom_plan_days WHERE plan_id = v_tpl.id ORDER BY day_number LOOP
    INSERT INTO custom_plan_days (plan_id, day_number, name, name_en)
      VALUES (v_plan, v_day.day_number, v_day.name, v_day.name_en) RETURNING id INTO v_new_day;
    INSERT INTO custom_plan_exercises (day_id, exercise_id, sets, reps, weight_kg, order_index, rest_seconds,
                                       rest_per_set, reps_per_set, weight_per_set, notes, set_types)
      SELECT v_new_day, exercise_id, sets, reps, weight_kg, order_index, rest_seconds,
             rest_per_set, reps_per_set, weight_per_set, notes, set_types
      FROM custom_plan_exercises WHERE day_id = v_day.id;
  END LOOP;

  INSERT INTO trainer_plan_assignments (trainer_client_id, trainer_user_id, client_user_id, plan_id,
                                        source_template_id, plan_name, start_date, weeks, sessions_per_week)
    VALUES (v_link.id, v_uid, v_link.client_user_id, v_plan, v_tpl.id,
            COALESCE(NULLIF(trim(p_name), ''), v_tpl.name), p_start, p_weeks, p_sessions_per_week)
    RETURNING id INTO v_assignment;
  RETURN v_assignment;
END $$;

-- Ukončit/zrušit přiřazení (plán u klienta zůstává, jen přestane být „od trenéra“ aktivní).
CREATE OR REPLACE FUNCTION public.trainer_end_assignment(p_assignment uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE trainer_plan_assignments SET ended_at = now()
    WHERE id = p_assignment AND trainer_user_id = auth.uid() AND ended_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
END $$;

-- ───────────────────────── RPC: přehledy ─────────────────────────
-- Plnění přiřazení: odcvičené tréninky z kopie plánu od start_date / (týdny × tréninky týdně).
CREATE OR REPLACE FUNCTION public.trainer_assignment_progress(p_assignment uuid)
RETURNS TABLE (done_sessions int, target_sessions int, progress_pct int, end_date date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.done, t.target, LEAST(100, (100 * d.done / NULLIF(t.target, 0)))::int, a.start_date + a.weeks * 7
  FROM trainer_plan_assignments a
  CROSS JOIN LATERAL (SELECT (a.weeks * a.sessions_per_week)::int AS target) t
  CROSS JOIN LATERAL (
    SELECT count(*)::int AS done FROM workout_sessions s
    WHERE s.user_id = a.client_user_id AND s.custom_plan_id = a.plan_id
      AND s.completed_at IS NOT NULL AND s.completed_at >= a.start_date::timestamptz
  ) d
  WHERE a.id = p_assignment AND (a.trainer_user_id = auth.uid() OR a.client_user_id = auth.uid())
$$;

-- Seznam klientů pro trenérskou nástěnku (jeden dotaz, ať je PWA svižná).
CREATE OR REPLACE FUNCTION public.trainer_clients_overview()
RETURNS TABLE (
  link_id uuid, client_user_id uuid, status text, invite_email text, invite_token uuid,
  created_at timestamptz, accepted_at timestamptz,
  client_name text, client_email text, client_avatar text,
  sessions_7d int, sessions_total int, last_session_at timestamptz,
  assignment_id uuid, plan_id uuid, plan_name text, start_date date, weeks int, sessions_per_week int,
  done_sessions int, target_sessions int, progress_pct int, end_date date, next_start_date date
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.client_user_id, c.status, c.invite_email, c.invite_token, c.created_at, c.accepted_at,
         NULLIF(trim(concat_ws(' ', up.first_name, up.last_name)), ''), u.email::text, up.avatar_url,
         COALESCE(st.s7, 0), COALESCE(st.total, 0), st.last_at,
         cur.id, cur.plan_id, cur.plan_name, cur.start_date, cur.weeks, cur.sessions_per_week,
         pr.done_sessions, pr.target_sessions, pr.progress_pct, pr.end_date,
         (SELECT min(n.start_date) FROM trainer_plan_assignments n
           WHERE n.trainer_client_id = c.id AND n.ended_at IS NULL
             AND n.start_date > COALESCE(cur.start_date, current_date))
  FROM trainer_clients c
  LEFT JOIN LATERAL (SELECT * FROM user_profiles p WHERE p.user_id = c.client_user_id LIMIT 1) up ON true
  LEFT JOIN auth.users u ON u.id = c.client_user_id
  LEFT JOIN LATERAL (
    SELECT count(*) FILTER (WHERE s.completed_at >= now() - interval '7 days')::int AS s7,
           count(*)::int AS total, max(s.completed_at) AS last_at
    FROM workout_sessions s
    WHERE c.status = 'active' AND s.user_id = c.client_user_id AND s.completed_at IS NOT NULL
      AND s.completed_at >= c.accepted_at
  ) st ON true
  -- Aktuální přiřazení: běžící dnes, jinak poslední skončené; budoucí = next_start_date.
  LEFT JOIN LATERAL (
    SELECT a.* FROM trainer_plan_assignments a
    WHERE a.trainer_client_id = c.id AND a.ended_at IS NULL AND a.start_date <= current_date
    ORDER BY (a.start_date + a.weeks * 7 > current_date) DESC, a.start_date DESC
    LIMIT 1
  ) cur ON true
  LEFT JOIN LATERAL (SELECT * FROM public.trainer_assignment_progress(cur.id)) pr ON cur.id IS NOT NULL
  WHERE c.trainer_user_id = auth.uid() AND c.status <> 'ended'
  ORDER BY c.status = 'active' DESC, COALESCE(c.accepted_at, c.created_at) DESC
$$;

-- Moji trenéři (pro klienta v appce).
CREATE OR REPLACE FUNCTION public.my_trainers()
RETURNS TABLE (link_id uuid, trainer_user_id uuid, trainer_name text, trainer_photo text, accepted_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.trainer_user_id, public.trainer_display_name(c.trainer_user_id),
         (SELECT gt.photo_url FROM gym_trainers gt WHERE gt.user_id = c.trainer_user_id AND gt.is_active ORDER BY gt.created_at LIMIT 1),
         c.accepted_at
  FROM trainer_clients c WHERE c.client_user_id = auth.uid() AND c.status = 'active'
  ORDER BY c.accepted_at
$$;

REVOKE ALL ON FUNCTION public.trainer_claim_access(), public.trainer_access_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trainer_claim_access(), public.trainer_access_status() TO authenticated;
GRANT SELECT ON public.trainer_access TO authenticated;
REVOKE ALL ON FUNCTION public.trainer_invite_client(text), public.trainer_accept_invite(uuid),
  public.trainer_end_client(uuid), public.trainer_assign_plan(uuid, uuid, date, int, int, text),
  public.trainer_end_assignment(uuid), public.trainer_clients_overview(), public.my_trainers(),
  public.trainer_assignment_progress(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trainer_invite_client(text), public.trainer_accept_invite(uuid),
  public.trainer_end_client(uuid), public.trainer_assign_plan(uuid, uuid, date, int, int, text),
  public.trainer_end_assignment(uuid), public.trainer_clients_overview(), public.my_trainers(),
  public.trainer_assignment_progress(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trainer_invite_info(uuid) TO anon, authenticated;
-- Pomocné funkce: trainer_display_name jen interně (volají ji SECURITY DEFINER funkce jako vlastník),
-- RLS helpery potřebují EXECUTE i pro anon (politiky na custom_plans/exercises se vyhodnocují i u veřejných plánů).
REVOKE ALL ON FUNCTION public.trainer_display_name(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_trainer(), public.is_my_active_client(uuid), public.trainer_manages_plan(uuid),
  public.is_public_template(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_trainer(), public.is_my_active_client(uuid), public.trainer_manages_plan(uuid),
  public.is_public_template(uuid) TO anon, authenticated;
GRANT SELECT ON public.trainer_clients, public.trainer_plan_assignments TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.trainer_session_reactions TO authenticated;
