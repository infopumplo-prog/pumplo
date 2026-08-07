-- Renewal reminder emails for gym subscriptions.
-- Dedup table + daily cron POSTing to the subscription-renewal-reminders Edge Function.
-- Applied to prod via Management API; this file documents the live state.

create table if not exists public.subscription_renewal_reminders (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.gym_subscriptions(id) on delete cascade,
  gym_id uuid not null,
  period_end timestamptz not null,
  days_before int not null,
  email text,
  sent_at timestamptz not null default now(),
  unique (subscription_id, period_end, days_before)
);
alter table public.subscription_renewal_reminders enable row level security;
-- No policies: written by the Edge Function via the service role only.

-- Daily at 05:30 UTC (07:30 Prague). Emails the gym owner 7/3/1/0 days before
-- current_period_end. Grandfathered gyms (Eurogym, free until 2027-07-20) have
-- no card, so the mail prompts them to arrange payment.
-- SELECT cron.schedule('subscription-renewal-reminders', '30 5 * * *',
--   $$ select net.http_post(
--        url:='https://udqwjqgdsjobdufdxbpn.supabase.co/functions/v1/subscription-renewal-reminders',
--        headers:='{"Authorization":"Bearer <CRON_SECRET>","Content-Type":"application/json"}'::jsonb,
--        body:='{}'::jsonb); $$);
