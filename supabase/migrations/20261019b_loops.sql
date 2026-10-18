-- E-maily přes Loops (19. 10. 2026) — navazuje na 20261019_email_f1.sql (spustit AŽ PO ní).
--
-- Rozhodnutí Davida: journeys M3–M8 + vizuální editor v Loops (loops.so). Supabase zůstává
-- zdrojem pravdy, kdo smí dostat obchodní e-mail (právní brána, souhlas, odhlášení).
-- Spec journeys: docs/email/loops-journeys.md.
--
-- Idempotentní: dá se pustit opakovaně. Nic neodesílá a cron je jen zakomentovaný.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. loops_event_log — co loops-sync poslal do Loops (idempotence událostí)
-- ─────────────────────────────────────────────────────────────────────────────
-- episode: 'life' (jednou za život účtu), 'gym'/'nogym' (plan_ready), id tréninku
-- (workout_completed), datum posledního tréninku (inactive_21d), pražské datum (plan_slowing).
create table if not exists public.loops_event_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event text not null,
  episode text not null,
  properties jsonb not null default '{}'::jsonb,
  sent_at timestamptz not null default now(),
  constraint loops_event_log_user_event_episode_key unique (user_id, event, episode)
);
create index if not exists loops_event_log_sent_idx on public.loops_event_log (sent_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. loops_contacts — kdo je v Loops a s jakým otiskem vlastností
-- ─────────────────────────────────────────────────────────────────────────────
-- Bez FK na auth.users ZÁMĚRNĚ: po smazání účtu musí loops-sync poznat, že má kontakt
-- v Loops smazat (pak nastaví removed_at). props_hash = otisk posledně poslaných vlastností.
create table if not exists public.loops_contacts (
  user_id uuid primary key,
  email text,
  props_hash text,
  synced_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_reason text check (removed_reason is null or removed_reason in ('not_eligible', 'account_deleted'))
);
create index if not exists loops_contacts_email_idx on public.loops_contacts (lower(email));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. email_events rozšířit o Loops webhook
-- ─────────────────────────────────────────────────────────────────────────────
-- svix_id zůstává jako obecné id doručení (Loops: 'loops:<webhook-id>'), unique hlídá duplicity.
alter table public.email_events add column if not exists provider text not null default 'resend';
alter table public.email_events add column if not exists event_name text;
alter table public.email_events add column if not exists user_id uuid;
alter table public.email_events add column if not exists message_id text;
alter table public.email_events drop constraint if exists email_events_type_check;
alter table public.email_events add constraint email_events_type_check check (type in (
  'sent', 'delivered', 'opened', 'clicked', 'bounced', 'soft_bounced', 'complained',
  'unsubscribed', 'resubscribed', 'other'
));
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'email_events_provider_check') then
    alter table public.email_events add constraint email_events_provider_check check (provider in ('resend', 'loops'));
  end if;
end $$;
create index if not exists email_events_provider_type_idx on public.email_events (provider, type, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RLS: číst smí jen admin, klient nezapisuje nic (zapisují edge funkce service rolí)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.loops_event_log enable row level security;
alter table public.loops_contacts enable row level security;
revoke insert, update, delete, truncate on public.loops_event_log from anon, authenticated;
revoke insert, update, delete, truncate on public.loops_contacts from anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'loops_event_log' and policyname = 'Admins read loops_event_log') then
    create policy "Admins read loops_event_log" on public.loops_event_log
      for select to authenticated using (public.has_role(auth.uid(), 'admin'::public.app_role));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'loops_contacts' and policyname = 'Admins read loops_contacts') then
    create policy "Admins read loops_contacts" on public.loops_contacts
      for select to authenticated using (public.has_role(auth.uid(), 'admin'::public.app_role));
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. View loops_contact_facts — vstup loops-sync (jen oslovitelní z email_eligible_users)
-- ─────────────────────────────────────────────────────────────────────────────
-- Staví na email_lifecycle_facts (F1), která staví na email_eligible_users (F0): bez demo,
-- staff, rolí, odhlášených a suppressions. ZÁMĚRNĚ bez injuries / weight_kg / height_cm /
-- age / gender — do Loops nikdy nejdou.
-- first_plan_at   = první plán vůbec (persistOnboarding ho založí po dotazníku, gym_id null)
-- recent_workouts = dokončené tréninky za 72 h [{id, at}] (události workout_completed)
create or replace view public.loops_contact_facts as
select
  f.user_id,
  f.email,
  f.first_name,
  f.language,
  f.signed_up_at,
  f.onboarding_completed,
  f.selected_gym_id,
  f.selected_gym_name,
  f.marketing_consent_at,
  f.email_optout_offered_at,
  f.marketing_optout_at,
  f.email_unsubscribed_at,
  f.completed_workouts,
  f.first_completed_at,
  f.last_completed_at,
  f.workout_dates,
  f.training_days,
  f.plan_training_days,
  fp.first_plan_at,
  f.first_gym_plan_at,
  exists (select 1 from public.user_workout_plans up where up.user_id = f.user_id and up.is_active) as has_active_plan,
  coalesce(rw.recent_workouts, '[]'::jsonb) as recent_workouts
from public.email_lifecycle_facts f
left join lateral (
  select min(up.created_at) as first_plan_at
  from public.user_workout_plans up
  where up.user_id = f.user_id
) fp on true
left join lateral (
  select jsonb_agg(jsonb_build_object('id', w.id, 'at', w.completed_at) order by w.completed_at) as recent_workouts
  from public.workout_sessions w
  where w.user_id = f.user_id
    and w.completed_at is not null
    and w.completed_at > now() - interval '72 hours'
    and w.day_letter is distinct from 'H'
    and w.gym_id is distinct from 'deadbeef-0000-4000-8000-000000000001'::uuid
) rw on true;

revoke all on public.loops_contact_facts from public, anon, authenticated;
grant select on public.loops_contact_facts to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Cron — loops-sync každou hodinu v :40 (ZAKOMENTOVANÉ, spouští David)
-- ─────────────────────────────────────────────────────────────────────────────
-- Autorizaci (CRON_SECRET) převezme z existujícího jobu pumplo-reminders-hourly,
-- takže tajný klíč nikde v repu není. Nejdřív s LOOPS_DRY_RUN=true (výchozí) a projít logy.
--
-- select cron.schedule(
--   'loops-sync-hourly',
--   '40 * * * *',
--   replace(
--     (select command from cron.job where jobname = 'pumplo-reminders-hourly'),
--     '/functions/v1/send-push-notifications',
--     '/functions/v1/loops-sync'
--   )
-- );
--
-- Kontrola:  select jobname, schedule, command like '%loops-sync%' as ok from cron.job where jobname = 'loops-sync-hourly';
-- Vypnutí:   select cron.unschedule('loops-sync-hourly');
