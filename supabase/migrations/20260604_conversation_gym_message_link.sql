-- Link a member<->gym conversation back to the gym announcement it was started
-- from, so the chat thread can show the announcement as a context banner.
-- Fixes "I got a gym message, tapped reply, but couldn't see what they sent".

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS original_gym_message_id uuid
  REFERENCES public.gym_messages(id) ON DELETE SET NULL;
