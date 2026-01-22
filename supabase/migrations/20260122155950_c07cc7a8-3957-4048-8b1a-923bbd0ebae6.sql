-- Create notification_logs table to track sent notifications and prevent duplicates
CREATE TABLE public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  notification_type TEXT NOT NULL,
  date_key TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  
  -- Prevent duplicate notifications per user/type/day
  UNIQUE(user_id, notification_type, date_key)
);

-- Enable RLS - only service role can access
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- Index for faster lookups
CREATE INDEX idx_notification_logs_lookup ON public.notification_logs(user_id, notification_type, date_key);

-- Clean up old logs (older than 30 days) - can be called periodically
CREATE OR REPLACE FUNCTION public.cleanup_old_notification_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.notification_logs
  WHERE sent_at < NOW() - INTERVAL '30 days';
END;
$$;