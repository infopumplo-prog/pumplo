-- Volný popis zranění k onboardingu (feedback 13. 10.): „Přidat volnou formu u zranění".
-- * Nepovinný text ≤ 300 znaků, ukládá se jen když uživatel vybral skutečné zranění.
-- * Zdravotní údaj (čl. 9 GDPR) — viditelnost řídí stávající RLS řádku user_profiles
--   (vlastník, admin, majitel zvolené posilovny), stejně jako u sloupce injuries.
-- Idempotentní: lze pustit opakovaně.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS injury_note text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_profiles_injury_note_len'
      AND conrelid = 'public.user_profiles'::regclass
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_injury_note_len
      CHECK (injury_note IS NULL OR char_length(injury_note) <= 300);
  END IF;
END $$;

COMMENT ON COLUMN public.user_profiles.injury_note IS
  'Nepovinný volný popis zranění (≤300 znaků). Zdravotní údaj — jen se souhlasem, mazatelný v profilu.';

-- ROLLBACK:
-- ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_injury_note_len;
-- ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS injury_note;
