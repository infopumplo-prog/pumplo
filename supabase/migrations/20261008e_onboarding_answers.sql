-- Onboarding 2.0 (fáze 1, 8. 10. 2026): odpovědi na nové otázky dotazníku.
-- Motivace se ukládá i do user_profiles.motivations (sloupec už existoval),
-- tady jsou navíc volné odpovědi a očekávání od appky — ať jde s nimi dál pracovat.
-- Zdravotní údaje sem nepatří: zranění zůstávají jen výběrem (David 8. 10.).

CREATE TABLE IF NOT EXISTS onboarding_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question text NOT NULL CHECK (question IN ('motivation', 'expectations', 'plan_choice')),
  choices text[] NOT NULL DEFAULT '{}',
  free_text text CHECK (free_text IS NULL OR char_length(free_text) <= 300),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS onboarding_answers_user_idx ON onboarding_answers (user_id);

ALTER TABLE onboarding_answers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'onboarding_answers' AND policyname = 'Users read own onboarding answers') THEN
    CREATE POLICY "Users read own onboarding answers" ON onboarding_answers FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'onboarding_answers' AND policyname = 'Users insert own onboarding answers') THEN
    CREATE POLICY "Users insert own onboarding answers" ON onboarding_answers FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'onboarding_answers' AND policyname = 'Users delete own onboarding answers') THEN
    CREATE POLICY "Users delete own onboarding answers" ON onboarding_answers FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;
