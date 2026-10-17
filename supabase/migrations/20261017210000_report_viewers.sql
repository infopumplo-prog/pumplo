-- Report v adminu vidí jen vybrané účty (David), ne všichni super admini.
-- Rozhodnutí Davida 17. 10. 2026: Benda ani Kakiš Report nevidí.
-- Mění jen objekty z 20261017200000_admin_report.sql (stejný den, nic jiného).

create table if not exists public.report_viewers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);
alter table public.report_viewers enable row level security;
revoke all on public.report_viewers from anon, authenticated;
grant all on public.report_viewers to service_role;

insert into public.report_viewers (user_id, note) values
  ('56286629-37d2-4633-bd9d-f3d5446755ff', 'info.pumplo@gmail.com (David)'),
  ('2e70d26e-ff70-44b7-a4fe-a6902f409c7b', 'hydroman421@gmail.com (David)')
on conflict (user_id) do nothing;

create or replace function public.can_view_report()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from report_viewers v where v.user_id = auth.uid())
     and exists (select 1 from user_roles r where r.user_id = auth.uid() and r.role = 'admin'::app_role);
$$;
revoke all on function public.can_view_report() from public, anon;
grant execute on function public.can_view_report() to authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'report_sync_runs', 'report_gsc_daily', 'report_gsc_query_daily', 'report_gsc_page_daily',
    'report_gsc_sitemaps', 'report_ga4_daily', 'report_ga4_events_daily', 'report_aso_keywords',
    'report_aso_rank_daily', 'report_store_rating_daily', 'report_mrr_daily'
  ] loop
    execute format('drop policy if exists %I on public.%I', 'admins_read_' || t, t);
    execute format('drop policy if exists %I on public.%I', 'report_viewers_read_' || t, t);
    execute format($p$create policy %I on public.%I for select to authenticated using (public.can_view_report())$p$,
      'report_viewers_read_' || t, t);
  end loop;
end $$;

create or replace function public.admin_report_app_usage(from_day date, to_day date)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  len int := (to_day - from_day) + 1;
  p_from date := from_day - ((to_day - from_day) + 1);
  p_to date := from_day - 1;
  f_ts timestamptz := (from_day::timestamp at time zone 'Europe/Prague');
  t_ts timestamptz := ((to_day + 1)::timestamp at time zone 'Europe/Prague');
  pf_ts timestamptz := (p_from::timestamp at time zone 'Europe/Prague');
  result json;
begin
  if not public.can_view_report() then
    raise exception 'forbidden';
  end if;
  if from_day is null or to_day is null or to_day < from_day or len > 1000 then
    raise exception 'invalid range';
  end if;

  with real as (
    select p.user_id, p.created_at from user_profiles p where public.is_real_member(p.user_id)
  ), ws as (
    select w.user_id, w.completed_at from workout_sessions w join real r on r.user_id = w.user_id
    where w.completed_at is not null
      and w.gym_id is distinct from 'deadbeef-0000-4000-8000-000000000001'::uuid
      and w.completed_at >= pf_ts and w.completed_at < t_ts
  ), qe as (
    select event_type, created_at from qr_events
    where created_at >= pf_ts and created_at < t_ts
      and gym_id is distinct from 'deadbeef-0000-4000-8000-000000000001'::uuid
  ), leads as (
    select created_at, 'qr' as kind from qr_leads
      where gym_id is distinct from 'deadbeef-0000-4000-8000-000000000001'::uuid
        and split_part(lower(email), '@', 2) not in ('pumplo.com', 'pumplo.cz', 'pumplo.app', 'demo.pumplo.cz')
    union all select created_at, 'waitlist' from website_waitlist
      where split_part(lower(email), '@', 2) not in ('pumplo.com', 'pumplo.cz', 'pumplo.app', 'demo.pumplo.cz')
    union all select created_at, 'contact' from website_contact_submissions
      where split_part(lower(email), '@', 2) not in ('pumplo.com', 'pumplo.cz', 'pumplo.app', 'demo.pumplo.cz')
  )
  select json_build_object(
    'from_day', from_day, 'to_day', to_day, 'prev_from_day', p_from, 'prev_to_day', p_to,
    'total_members', (select count(*) from real where created_at < t_ts),
    'total_members_prev', (select count(*) from real where created_at < f_ts),
    'new_members', (select count(*) from real where created_at >= f_ts and created_at < t_ts),
    'new_members_prev', (select count(*) from real where created_at >= pf_ts and created_at < f_ts),
    'active_members', (select count(distinct user_id) from ws where completed_at >= f_ts),
    'active_members_prev', (select count(distinct user_id) from ws where completed_at < f_ts),
    'workouts', (select count(*) from ws where completed_at >= f_ts),
    'workouts_prev', (select count(*) from ws where completed_at < f_ts),
    'gyms_published', (select count(*) from gyms where is_published and id <> 'deadbeef-0000-4000-8000-000000000001'::uuid),
    'gyms_total', (select count(*) from gyms where id <> 'deadbeef-0000-4000-8000-000000000001'::uuid),
    'qr_scans', (select count(*) from qe where event_type = 'scan' and created_at >= f_ts),
    'qr_scans_prev', (select count(*) from qe where event_type = 'scan' and created_at < f_ts),
    'store_clicks', (select count(*) from qe where event_type = 'store_click' and created_at >= f_ts),
    'store_clicks_prev', (select count(*) from qe where event_type = 'store_click' and created_at < f_ts),
    'leads', (select count(*) from leads where created_at >= f_ts and created_at < t_ts),
    'leads_prev', (select count(*) from leads where created_at >= pf_ts and created_at < f_ts),
    'leads_by_kind', (select coalesce(json_object_agg(kind, c), '{}'::json) from (
        select kind, count(*) c from leads where created_at >= f_ts and created_at < t_ts group by kind) x),
    'leads_total', (select count(*) from leads),
    'by_day', (
      select coalesce(json_agg(json_build_object(
        'day', d.day,
        'signups', (select count(*) from real r where (r.created_at at time zone 'Europe/Prague')::date = d.day),
        'active', (select count(distinct w.user_id) from ws w where (w.completed_at at time zone 'Europe/Prague')::date = d.day),
        'workouts', (select count(*) from ws w where (w.completed_at at time zone 'Europe/Prague')::date = d.day),
        'scans', (select count(*) from qe q where q.event_type = 'scan' and (q.created_at at time zone 'Europe/Prague')::date = d.day),
        'leads', (select count(*) from leads l where (l.created_at at time zone 'Europe/Prague')::date = d.day)
      ) order by d.day), '[]'::json)
      from (select generate_series(from_day, to_day, interval '1 day')::date as day) d)
  ) into result;
  return result;
end
$$;

revoke all on function public.admin_report_app_usage(date, date) from public, anon;
grant execute on function public.admin_report_app_usage(date, date) to authenticated;
