-- RLS policy for notification_logs - no public access, only service role
-- This is intentional as this table is only accessed by the edge function using service_role_key
-- Add a dummy policy that always returns false for regular users
CREATE POLICY "No public access to notification logs"
ON public.notification_logs
FOR ALL
USING (false);