-- Popis zranění skrytý před majitelem posilovny (David 17. 10. 2026, GDPR čl. 9).
-- Politika „Gym owners can view member profiles" pouští majitele ke všem sloupcům
-- user_profiles, proto popis zranění žije ve vlastní tabulce: vidí ho jen uživatel a admin Pumpla.
-- Opakovatelné. Návrat: ALTER TABLE user_profiles ADD COLUMN injury_note text;
--   UPDATE user_profiles p SET injury_note = n.note FROM user_injury_notes n WHERE n.user_id = p.user_id;
--   DROP TABLE user_injury_notes;

CREATE TABLE IF NOT EXISTS public.user_injury_notes (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  note text NOT NULL CHECK (char_length(note) BETWEEN 1 AND 300),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_injury_notes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_injury_notes' AND policyname = 'Users manage own injury note') THEN
    CREATE POLICY "Users manage own injury note" ON public.user_injury_notes
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_injury_notes' AND policyname = 'Admins read injury notes') THEN
    CREATE POLICY "Admins read injury notes" ON public.user_injury_notes
      FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- Přenos případných existujících popisů (17. 10. jich bylo 0) a zrušení sloupce v profilu.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'injury_note') THEN
    INSERT INTO public.user_injury_notes (user_id, note)
      SELECT user_id, injury_note FROM public.user_profiles
      WHERE injury_note IS NOT NULL AND char_length(btrim(injury_note)) > 0
      ON CONFLICT (user_id) DO NOTHING;
    ALTER TABLE public.user_profiles DROP COLUMN injury_note;
  END IF;
END $$;
