-- Add notification preferences columns to user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS notification_morning_reminder boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_missed_workout boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_closing_soon boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_onboarding_shown boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS push_subscription jsonb DEFAULT NULL;