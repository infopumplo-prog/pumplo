-- Persist each user's chosen UI language so server-side push notifications
-- (send-push-notifications Edge Function) can be localized per recipient.
-- Values: 'cs' | 'en'. Defaults to 'cs' (app fallback language).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_profiles'
      AND column_name = 'language'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD COLUMN language text NOT NULL DEFAULT 'cs';
  END IF;
END $$;
