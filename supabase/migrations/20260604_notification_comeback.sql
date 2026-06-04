-- Opt-out flag for the comeback / re-engagement push system (default on).
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS notification_comeback boolean NOT NULL DEFAULT true;
