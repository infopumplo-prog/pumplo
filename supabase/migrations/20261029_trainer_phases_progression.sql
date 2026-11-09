-- Trenérská platforma — fáze plánu a progresivní přetížení (29. 10. 2026, feedback Adam Kakiš)
-- • custom_plans.duration_weeks: výchozí délka plánu (předvyplní se při přiřazení klientovi)
-- • custom_plan_phases: fáze po týdnech (např. 1–4 doma, 5–8 posilovna); den patří do fáze
--   (custom_plan_days.phase_id; NULL = den platí po celou dobu plánu)
-- • custom_plan_exercise_progressions: od týdne X jiné série/opakování/váha u cviku
--   (NULL = beze změny); platí poslední pravidlo s from_week <= aktuální týden
-- • trainer_assign_plan kopíruje fáze i progrese
-- Opakovatelná: IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS.

ALTER TABLE public.custom_plans ADD COLUMN IF NOT EXISTS duration_weeks int;
DO $$ BEGIN
  ALTER TABLE public.custom_plans
    ADD CONSTRAINT custom_plans_duration_weeks_check CHECK (duration_weeks IS NULL OR duration_weeks BETWEEN 1 AND 52);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.custom_plan_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.custom_plans(id) ON DELETE CASCADE,
  order_index int NOT NULL DEFAULT 0,
  name text NOT NULL,
  name_en text,
  start_week int NOT NULL CHECK (start_week BETWEEN 1 AND 52),
  end_week int NOT NULL CHECK (end_week BETWEEN 1 AND 52),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_week >= start_week)
);
CREATE INDEX IF NOT EXISTS custom_plan_phases_plan_idx ON public.custom_plan_phases (plan_id, order_index);

ALTER TABLE public.custom_plan_days
  ADD COLUMN IF NOT EXISTS phase_id uuid REFERENCES public.custom_plan_phases(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS custom_plan_days_phase_idx ON public.custom_plan_days (phase_id) WHERE phase_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.custom_plan_exercise_progressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_exercise_id uuid NOT NULL REFERENCES public.custom_plan_exercises(id) ON DELETE CASCADE,
  from_week int NOT NULL CHECK (from_week BETWEEN 1 AND 52),
  sets int CHECK (sets IS NULL OR sets BETWEEN 1 AND 20),
  reps int CHECK (reps IS NULL OR reps BETWEEN 1 AND 200),
  weight_kg numeric CHECK (weight_kg IS NULL OR weight_kg BETWEEN 0 AND 1000),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_exercise_id, from_week)
);
CREATE INDEX IF NOT EXISTS custom_plan_exercise_progressions_ex_idx ON public.custom_plan_exercise_progressions (plan_exercise_id, from_week);

-- ───────────────────────── Pomocné funkce (RLS) ─────────────────────────
-- Smí přihlášený číst plán? vlastník, veřejný/zveřejněný plán, trenér přiřazené kopie, trenér u veřejné šablony.
CREATE OR REPLACE FUNCTION public.can_read_custom_plan(p_plan uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM custom_plans p WHERE p.id = p_plan AND (
      p.user_id = auth.uid() OR p.is_public OR p.published_at IS NOT NULL
      OR public.trainer_manages_plan(p.id)
      OR (p.is_template AND p.template_visibility = 'public' AND public.is_trainer())
    )
  )
$$;

-- Smí přihlášený plán upravovat? vlastník nebo trenér přiřazené kopie.
CREATE OR REPLACE FUNCTION public.can_write_custom_plan(p_plan uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM custom_plans p WHERE p.id = p_plan AND p.user_id = auth.uid())
      OR public.trainer_manages_plan(p_plan)
$$;

CREATE OR REPLACE FUNCTION public.plan_of_plan_exercise(p_plan_exercise uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.plan_id FROM custom_plan_exercises e JOIN custom_plan_days d ON d.id = e.day_id WHERE e.id = p_plan_exercise
$$;

REVOKE ALL ON FUNCTION public.can_read_custom_plan(uuid), public.can_write_custom_plan(uuid),
  public.plan_of_plan_exercise(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_custom_plan(uuid), public.can_write_custom_plan(uuid),
  public.plan_of_plan_exercise(uuid) TO anon, authenticated;

-- ───────────────────────── RLS ─────────────────────────
ALTER TABLE public.custom_plan_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_plan_exercise_progressions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plan_phases_read" ON public.custom_plan_phases;
CREATE POLICY "plan_phases_read" ON public.custom_plan_phases FOR SELECT
  USING (public.can_read_custom_plan(plan_id));
DROP POLICY IF EXISTS "plan_phases_write" ON public.custom_plan_phases;
CREATE POLICY "plan_phases_write" ON public.custom_plan_phases FOR ALL
  USING (public.can_write_custom_plan(plan_id)) WITH CHECK (public.can_write_custom_plan(plan_id));

DROP POLICY IF EXISTS "plan_progressions_read" ON public.custom_plan_exercise_progressions;
CREATE POLICY "plan_progressions_read" ON public.custom_plan_exercise_progressions FOR SELECT
  USING (public.can_read_custom_plan(public.plan_of_plan_exercise(plan_exercise_id)));
DROP POLICY IF EXISTS "plan_progressions_write" ON public.custom_plan_exercise_progressions;
CREATE POLICY "plan_progressions_write" ON public.custom_plan_exercise_progressions FOR ALL
  USING (public.can_write_custom_plan(public.plan_of_plan_exercise(plan_exercise_id)))
  WITH CHECK (public.can_write_custom_plan(public.plan_of_plan_exercise(plan_exercise_id)));

-- Den smí ukazovat jen na fázi téhož plánu.
CREATE OR REPLACE FUNCTION public.custom_plan_days_phase_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.phase_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM custom_plan_phases ph WHERE ph.id = NEW.phase_id AND ph.plan_id = NEW.plan_id
  ) THEN
    RAISE EXCEPTION 'phase_not_in_plan' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS custom_plan_days_phase_guard ON public.custom_plan_days;
CREATE TRIGGER custom_plan_days_phase_guard BEFORE INSERT OR UPDATE OF phase_id, plan_id ON public.custom_plan_days
  FOR EACH ROW EXECUTE FUNCTION public.custom_plan_days_phase_guard();

GRANT SELECT ON public.custom_plan_phases, public.custom_plan_exercise_progressions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_plan_phases, public.custom_plan_exercise_progressions TO authenticated;

-- ───────────────────────── Přiřazení: kopie s fázemi a progresí ─────────────────────────
-- p_weeks NULL → délka ze šablony (duration_weeks), jinak konec fází, jinak 4.
CREATE OR REPLACE FUNCTION public.trainer_assign_plan(
  p_link uuid, p_template uuid, p_start date, p_weeks int, p_sessions_per_week int, p_name text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_link trainer_clients;
  v_tpl custom_plans;
  v_plan uuid;
  v_weeks int;
  v_phase record;
  v_day record;
  v_ex record;
  v_new_phase uuid;
  v_new_day uuid;
  v_new_ex uuid;
  v_assignment uuid;
  v_phase_map jsonb := '{}'::jsonb;
BEGIN
  SELECT * INTO v_link FROM trainer_clients WHERE id = p_link AND trainer_user_id = v_uid AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'client_not_active' USING ERRCODE = '42501'; END IF;
  IF public.trainer_claim_access() NOT IN ('founder_free', 'paid') THEN
    RAISE EXCEPTION 'trainer_access_required' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_tpl FROM custom_plans WHERE id = p_template
    AND (user_id = v_uid OR (is_template AND template_visibility = 'public'));
  IF NOT FOUND THEN RAISE EXCEPTION 'template_not_found' USING ERRCODE = 'P0002'; END IF;
  IF p_start IS NULL OR p_sessions_per_week IS NULL THEN
    RAISE EXCEPTION 'missing_params' USING ERRCODE = '22023';
  END IF;
  v_weeks := COALESCE(p_weeks, v_tpl.duration_weeks,
                      (SELECT max(end_week) FROM custom_plan_phases WHERE plan_id = v_tpl.id), 4);

  INSERT INTO custom_plans (user_id, name, rest_duration_seconds, description, goal, level, focus,
                            source_plan_id, cover_url, name_en, description_en, secondary_focuses, duration_weeks)
    VALUES (v_link.client_user_id, COALESCE(NULLIF(trim(p_name), ''), v_tpl.name), v_tpl.rest_duration_seconds,
            v_tpl.description, v_tpl.goal, v_tpl.level, v_tpl.focus, v_tpl.id, v_tpl.cover_url,
            v_tpl.name_en, v_tpl.description_en, v_tpl.secondary_focuses, v_weeks)
    RETURNING id INTO v_plan;

  FOR v_phase IN SELECT * FROM custom_plan_phases WHERE plan_id = v_tpl.id ORDER BY order_index, start_week LOOP
    INSERT INTO custom_plan_phases (plan_id, order_index, name, name_en, start_week, end_week, notes)
      VALUES (v_plan, v_phase.order_index, v_phase.name, v_phase.name_en, v_phase.start_week, v_phase.end_week, v_phase.notes)
      RETURNING id INTO v_new_phase;
    v_phase_map := v_phase_map || jsonb_build_object(v_phase.id::text, v_new_phase::text);
  END LOOP;

  FOR v_day IN SELECT * FROM custom_plan_days WHERE plan_id = v_tpl.id ORDER BY day_number LOOP
    INSERT INTO custom_plan_days (plan_id, day_number, name, name_en, phase_id)
      VALUES (v_plan, v_day.day_number, v_day.name, v_day.name_en,
              CASE WHEN v_day.phase_id IS NULL THEN NULL ELSE (v_phase_map ->> v_day.phase_id::text)::uuid END)
      RETURNING id INTO v_new_day;
    FOR v_ex IN SELECT * FROM custom_plan_exercises WHERE day_id = v_day.id ORDER BY order_index LOOP
      INSERT INTO custom_plan_exercises (day_id, exercise_id, sets, reps, weight_kg, order_index, rest_seconds,
                                         rest_per_set, reps_per_set, weight_per_set, notes, set_types)
        VALUES (v_new_day, v_ex.exercise_id, v_ex.sets, v_ex.reps, v_ex.weight_kg, v_ex.order_index, v_ex.rest_seconds,
                v_ex.rest_per_set, v_ex.reps_per_set, v_ex.weight_per_set, v_ex.notes, v_ex.set_types)
        RETURNING id INTO v_new_ex;
      INSERT INTO custom_plan_exercise_progressions (plan_exercise_id, from_week, sets, reps, weight_kg, notes)
        SELECT v_new_ex, pr.from_week, pr.sets, pr.reps, pr.weight_kg, pr.notes
        FROM custom_plan_exercise_progressions pr WHERE pr.plan_exercise_id = v_ex.id;
    END LOOP;
  END LOOP;

  INSERT INTO trainer_plan_assignments (trainer_client_id, trainer_user_id, client_user_id, plan_id,
                                        source_template_id, plan_name, start_date, weeks, sessions_per_week)
    VALUES (v_link.id, v_uid, v_link.client_user_id, v_plan, v_tpl.id,
            COALESCE(NULLIF(trim(p_name), ''), v_tpl.name), p_start, v_weeks, p_sessions_per_week)
    RETURNING id INTO v_assignment;
  RETURN v_assignment;
END $$;

REVOKE ALL ON FUNCTION public.trainer_assign_plan(uuid, uuid, date, int, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trainer_assign_plan(uuid, uuid, date, int, int, text) TO authenticated;
