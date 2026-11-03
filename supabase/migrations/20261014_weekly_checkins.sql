-- Týdenní check-in (feedback testerů 13. 10.): v neděli večer se člen ohodnotí
-- (nálada + tréninky 1–5) a volitelně napíše, co bylo nejtěžší a co na appku.
-- Jeden záznam na uživatele a týden (week_start = pondělí, Europe/Prague).
-- Idempotentní — lze pustit opakovaně.

CREATE TABLE IF NOT EXISTS public.weekly_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL CHECK (extract(isodow FROM week_start) = 1),
  mood smallint NOT NULL CHECK (mood BETWEEN 1 AND 5),
  training smallint NOT NULL CHECK (training BETWEEN 1 AND 5),
  hardest text CHECK (hardest IS NULL OR char_length(hardest) <= 300),
  app_feedback text CHECK (app_feedback IS NULL OR char_length(app_feedback) <= 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT weekly_checkins_user_week_key UNIQUE (user_id, week_start)
);

CREATE INDEX IF NOT EXISTS weekly_checkins_week_idx ON public.weekly_checkins (week_start DESC);

ALTER TABLE public.weekly_checkins ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'weekly_checkins' AND policyname = 'Users read own weekly checkins') THEN
    CREATE POLICY "Users read own weekly checkins" ON public.weekly_checkins FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'weekly_checkins' AND policyname = 'Users insert own weekly checkins') THEN
    CREATE POLICY "Users insert own weekly checkins" ON public.weekly_checkins FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  -- Úprava vlastní odpovědi (upsert při opakovaném otevření stejného týdne)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'weekly_checkins' AND policyname = 'Users update own weekly checkins') THEN
    CREATE POLICY "Users update own weekly checkins" ON public.weekly_checkins FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'weekly_checkins' AND policyname = 'Users delete own weekly checkins') THEN
    CREATE POLICY "Users delete own weekly checkins" ON public.weekly_checkins FOR DELETE USING (auth.uid() = user_id);
  END IF;
  -- Admini čtou vše (stejně jako app_feedback)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'weekly_checkins' AND policyname = 'Admins read all weekly checkins') THEN
    CREATE POLICY "Admins read all weekly checkins" ON public.weekly_checkins FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- ROLLBACK:
-- DROP TABLE IF EXISTS public.weekly_checkins;
