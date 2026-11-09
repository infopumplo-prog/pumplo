-- Trenérská platforma — check-iny, fotky a váhy (30. 10. 2026, 2. feedback Adam Kakiš)
-- • trainer_checkin_forms: vlastní formulář trenéra (pole v JSON: číslo/škála/text/volba/fotky)
-- • trainer_clients.checkin_form_id + checkin_weekday: kterým formulářem a kdy se klient hlásí
-- • trainer_checkins: vyplněný check-in klienta (snímek formuláře + odpovědi), 1× za týden a vazbu
-- • trainer_checkin_photos + bucket checkin-photos (soukromý): fotky z check-inu
-- • body_weight_entries: denní váhy (ručně / z check-inu / ze Zdraví — Apple Health, Health Connect)
--   trenér je vidí jen se souhlasem klienta (trainer_clients.client_shares_weight)
-- Opakovatelná: IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS.

-- ───────────────────────── Formuláře ─────────────────────────
CREATE TABLE IF NOT EXISTS public.trainer_checkin_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  -- [{ "id": "weight", "type": "number|scale|text|choice|photos|weight", "label": "...", "unit": "cm",
  --    "min": 1, "max": 5, "options": ["..."], "required": true, "max_photos": 4 }]
  fields jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(fields) = 'array' AND jsonb_array_length(fields) <= 40),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trainer_checkin_forms_trainer_idx ON public.trainer_checkin_forms (trainer_user_id);

ALTER TABLE public.trainer_clients
  ADD COLUMN IF NOT EXISTS checkin_form_id uuid REFERENCES public.trainer_checkin_forms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS checkin_weekday smallint,
  ADD COLUMN IF NOT EXISTS client_shares_weight boolean NOT NULL DEFAULT false;
DO $$ BEGIN
  ALTER TABLE public.trainer_clients
    ADD CONSTRAINT trainer_clients_checkin_weekday_check CHECK (checkin_weekday IS NULL OR checkin_weekday BETWEEN 1 AND 7);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ───────────────────────── Check-iny ─────────────────────────
CREATE TABLE IF NOT EXISTS public.trainer_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_client_id uuid NOT NULL REFERENCES public.trainer_clients(id) ON DELETE CASCADE,
  trainer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  form_id uuid REFERENCES public.trainer_checkin_forms(id) ON DELETE SET NULL,
  form_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- pondělí týdne (Europe/Prague)
  week_start date NOT NULL CHECK (extract(isodow FROM week_start) = 1),
  answers jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(answers) = 'object'),
  weight_kg numeric(5,1) CHECK (weight_kg IS NULL OR weight_kg BETWEEN 25 AND 400),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  trainer_seen_at timestamptz,
  trainer_note text CHECK (trainer_note IS NULL OR char_length(trainer_note) <= 2000),
  UNIQUE (trainer_client_id, week_start)
);
CREATE INDEX IF NOT EXISTS trainer_checkins_trainer_idx ON public.trainer_checkins (trainer_user_id, week_start DESC);
CREATE INDEX IF NOT EXISTS trainer_checkins_client_idx ON public.trainer_checkins (client_user_id, week_start DESC);

CREATE TABLE IF NOT EXISTS public.trainer_checkin_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkin_id uuid NOT NULL REFERENCES public.trainer_checkins(id) ON DELETE CASCADE,
  field_id text NOT NULL,
  -- checkin-photos/<client_user_id>/<checkin_id>/<soubor>
  storage_path text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trainer_checkin_photos_checkin_idx ON public.trainer_checkin_photos (checkin_id);

-- ───────────────────────── Váhy ─────────────────────────
CREATE TABLE IF NOT EXISTS public.body_weight_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  measured_at timestamptz NOT NULL,
  weight_kg numeric(5,1) NOT NULL CHECK (weight_kg BETWEEN 25 AND 400),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'checkin', 'apple_health', 'health_connect')),
  -- ID záznamu ve Zdraví → opakovaný import nezdvojí
  external_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS body_weight_entries_external_idx
  ON public.body_weight_entries (user_id, source, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS body_weight_entries_user_idx ON public.body_weight_entries (user_id, measured_at DESC);

-- ───────────────────────── Pomocné funkce ─────────────────────────
-- Trenér smí vidět váhy klienta jen se souhlasem klienta.
CREATE OR REPLACE FUNCTION public.trainer_sees_weights_of(p_client uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM trainer_clients
    WHERE trainer_user_id = auth.uid() AND client_user_id = p_client AND status = 'active' AND client_shares_weight
  )
$$;

-- Klientova aktivní vazba k trenérovi (pro zápis check-inu).
CREATE OR REPLACE FUNCTION public.is_my_active_trainer_link(p_link uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM trainer_clients WHERE id = p_link AND client_user_id = auth.uid() AND status = 'active')
$$;

REVOKE ALL ON FUNCTION public.trainer_sees_weights_of(uuid), public.is_my_active_trainer_link(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trainer_sees_weights_of(uuid), public.is_my_active_trainer_link(uuid) TO authenticated;

-- ───────────────────────── RLS ─────────────────────────
ALTER TABLE public.trainer_checkin_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_checkin_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.body_weight_entries ENABLE ROW LEVEL SECURITY;

-- Formuláře: trenér spravuje své; klient čte formulář přiřazený své aktivní vazbě.
DROP POLICY IF EXISTS "checkin_forms_trainer" ON public.trainer_checkin_forms;
CREATE POLICY "checkin_forms_trainer" ON public.trainer_checkin_forms FOR ALL
  USING (trainer_user_id = auth.uid()) WITH CHECK (trainer_user_id = auth.uid() AND public.is_trainer());
DROP POLICY IF EXISTS "checkin_forms_client_read" ON public.trainer_checkin_forms;
CREATE POLICY "checkin_forms_client_read" ON public.trainer_checkin_forms FOR SELECT
  USING (EXISTS (SELECT 1 FROM trainer_clients c WHERE c.checkin_form_id = trainer_checkin_forms.id
                 AND c.client_user_id = auth.uid() AND c.status = 'active'));

-- Check-iny: klient zapisuje/upravuje vlastní k aktivní vazbě; trenér čte své a smí jen označit „viděno“ + poznámku.
DROP POLICY IF EXISTS "checkins_client_read" ON public.trainer_checkins;
CREATE POLICY "checkins_client_read" ON public.trainer_checkins FOR SELECT USING (client_user_id = auth.uid());
DROP POLICY IF EXISTS "checkins_client_insert" ON public.trainer_checkins;
CREATE POLICY "checkins_client_insert" ON public.trainer_checkins FOR INSERT
  WITH CHECK (client_user_id = auth.uid() AND public.is_my_active_trainer_link(trainer_client_id)
              AND trainer_user_id = (SELECT c.trainer_user_id FROM trainer_clients c WHERE c.id = trainer_client_id));
DROP POLICY IF EXISTS "checkins_client_update" ON public.trainer_checkins;
CREATE POLICY "checkins_client_update" ON public.trainer_checkins FOR UPDATE
  USING (client_user_id = auth.uid() AND public.is_my_active_trainer_link(trainer_client_id))
  WITH CHECK (client_user_id = auth.uid() AND public.is_my_active_trainer_link(trainer_client_id));
DROP POLICY IF EXISTS "checkins_trainer_read" ON public.trainer_checkins;
CREATE POLICY "checkins_trainer_read" ON public.trainer_checkins FOR SELECT
  USING (trainer_user_id = auth.uid() AND public.is_my_active_client(client_user_id));
DROP POLICY IF EXISTS "checkins_trainer_update" ON public.trainer_checkins;
CREATE POLICY "checkins_trainer_update" ON public.trainer_checkins FOR UPDATE
  USING (trainer_user_id = auth.uid() AND public.is_my_active_client(client_user_id))
  WITH CHECK (trainer_user_id = auth.uid() AND public.is_my_active_client(client_user_id));

-- Kdo co smí v check-inu měnit: klient obsah, trenér jen trainer_seen_at a trainer_note.
CREATE OR REPLACE FUNCTION public.trainer_checkins_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.trainer_client_id <> OLD.trainer_client_id OR NEW.client_user_id <> OLD.client_user_id
     OR NEW.trainer_user_id <> OLD.trainer_user_id OR NEW.week_start <> OLD.week_start THEN
    RAISE EXCEPTION 'checkin_identity_locked' USING ERRCODE = '42501';
  END IF;
  IF auth.uid() = OLD.trainer_user_id AND (
       NEW.answers IS DISTINCT FROM OLD.answers OR NEW.weight_kg IS DISTINCT FROM OLD.weight_kg
    OR NEW.form_snapshot IS DISTINCT FROM OLD.form_snapshot OR NEW.form_id IS DISTINCT FROM OLD.form_id
    OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at) THEN
    RAISE EXCEPTION 'checkin_answers_locked' USING ERRCODE = '42501';
  END IF;
  IF auth.uid() = OLD.client_user_id AND (
       NEW.trainer_seen_at IS DISTINCT FROM OLD.trainer_seen_at OR NEW.trainer_note IS DISTINCT FROM OLD.trainer_note) THEN
    RAISE EXCEPTION 'checkin_trainer_fields_locked' USING ERRCODE = '42501';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trainer_checkins_guard ON public.trainer_checkins;
CREATE TRIGGER trainer_checkins_guard BEFORE UPDATE ON public.trainer_checkins
  FOR EACH ROW EXECUTE FUNCTION public.trainer_checkins_guard();

-- Fotky: klient spravuje fotky svých check-inů; trenér je čte u aktivních klientů.
DROP POLICY IF EXISTS "checkin_photos_client" ON public.trainer_checkin_photos;
CREATE POLICY "checkin_photos_client" ON public.trainer_checkin_photos FOR ALL
  USING (EXISTS (SELECT 1 FROM trainer_checkins k WHERE k.id = checkin_id AND k.client_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM trainer_checkins k WHERE k.id = checkin_id AND k.client_user_id = auth.uid())
              AND storage_path LIKE auth.uid()::text || '/' || checkin_id::text || '/%');
DROP POLICY IF EXISTS "checkin_photos_trainer_read" ON public.trainer_checkin_photos;
CREATE POLICY "checkin_photos_trainer_read" ON public.trainer_checkin_photos FOR SELECT
  USING (EXISTS (SELECT 1 FROM trainer_checkins k WHERE k.id = checkin_id AND k.trainer_user_id = auth.uid()
                 AND public.is_my_active_client(k.client_user_id)));

-- Váhy: vlastník vše; trenér jen čte a jen se souhlasem klienta.
DROP POLICY IF EXISTS "weights_owner" ON public.body_weight_entries;
CREATE POLICY "weights_owner" ON public.body_weight_entries FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "weights_trainer_read" ON public.body_weight_entries;
CREATE POLICY "weights_trainer_read" ON public.body_weight_entries FOR SELECT
  USING (public.trainer_sees_weights_of(user_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trainer_checkin_forms, public.trainer_checkins,
  public.trainer_checkin_photos, public.body_weight_entries TO authenticated;

-- Klient zapne/vypne sdílení vah s trenérem (sloupec trainer_clients jinak klient měnit nesmí).
CREATE OR REPLACE FUNCTION public.set_weight_sharing(p_link uuid, p_share boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE trainer_clients SET client_shares_weight = COALESCE(p_share, false)
    WHERE id = p_link AND client_user_id = auth.uid() AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
END $$;

-- Trenér nastaví klientovi formulář a den check-inu.
CREATE OR REPLACE FUNCTION public.trainer_set_checkin(p_link uuid, p_form uuid, p_weekday smallint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_form IS NOT NULL AND NOT EXISTS (SELECT 1 FROM trainer_checkin_forms WHERE id = p_form AND trainer_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'form_not_found' USING ERRCODE = 'P0002';
  END IF;
  UPDATE trainer_clients SET checkin_form_id = p_form, checkin_weekday = p_weekday
    WHERE id = p_link AND trainer_user_id = auth.uid() AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'client_not_active' USING ERRCODE = '42501'; END IF;
END $$;

REVOKE ALL ON FUNCTION public.set_weight_sharing(uuid, boolean), public.trainer_set_checkin(uuid, uuid, smallint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_weight_sharing(uuid, boolean), public.trainer_set_checkin(uuid, uuid, smallint) TO authenticated;

-- Moji trenéři (klient) — navíc formulář, den check-inu a souhlas se sdílením vah.
DROP FUNCTION IF EXISTS public.my_trainers();
CREATE OR REPLACE FUNCTION public.my_trainers()
RETURNS TABLE (link_id uuid, trainer_user_id uuid, trainer_name text, trainer_photo text, accepted_at timestamptz,
               checkin_form_id uuid, checkin_weekday smallint, client_shares_weight boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.trainer_user_id, public.trainer_display_name(c.trainer_user_id),
         (SELECT gt.photo_url FROM gym_trainers gt WHERE gt.user_id = c.trainer_user_id AND gt.is_active ORDER BY gt.created_at LIMIT 1),
         c.accepted_at, c.checkin_form_id, c.checkin_weekday, c.client_shares_weight
  FROM trainer_clients c WHERE c.client_user_id = auth.uid() AND c.status = 'active'
  ORDER BY c.accepted_at
$$;
REVOKE ALL ON FUNCTION public.my_trainers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_trainers() TO authenticated;

-- ───────────────────────── Storage: soukromé fotky ─────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('checkin-photos', 'checkin-photos', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
  ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "checkin photos owner write" ON storage.objects;
CREATE POLICY "checkin photos owner write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'checkin-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "checkin photos owner read" ON storage.objects;
CREATE POLICY "checkin photos owner read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'checkin-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "checkin photos owner delete" ON storage.objects;
CREATE POLICY "checkin photos owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'checkin-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "checkin photos trainer read" ON storage.objects;
CREATE POLICY "checkin photos trainer read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'checkin-photos' AND EXISTS (
    SELECT 1 FROM public.trainer_checkin_photos ph
    JOIN public.trainer_checkins k ON k.id = ph.checkin_id
    WHERE ph.storage_path = storage.objects.name AND k.trainer_user_id = auth.uid()
      AND public.is_my_active_client(k.client_user_id)));
