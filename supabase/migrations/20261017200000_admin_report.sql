-- Sekce „Report" v super adminu (17. 10. 2026).
--
-- Jen PŘIDÁVÁ nové objekty (tabulky report_*, RPC admin_report_app_usage,
-- cron joby report-*). Nic existujícího nemění.
--
-- Plní je edge funkce (service role, hlavička x-sync-secret = STORE_SYNC_SECRET):
--   seo-gsc-sync   → report_gsc_daily, report_gsc_query_daily, report_gsc_page_daily, report_gsc_sitemaps
--   web-ga4-sync   → report_ga4_daily, report_ga4_events_daily
--   aso-rank-sync  → report_aso_rank_daily, report_store_rating_daily (klíčová slova v report_aso_keywords)
--   mrr-snapshot   → report_mrr_daily
-- Každý běh zapíše řádek do report_sync_runs (stav zdroje + čerstvost dat v adminu).
--
-- Čtou jen super admini (user_roles.role = 'admin', stejně jako store_metrics_daily),
-- zapisuje jen service role (žádná insert/update/delete policy → RLS zápis zakáže).

-- ── Stav synchronizací ──────────────────────────────────────────────────────
create table if not exists public.report_sync_runs (
  id bigint generated always as identity primary key,
  source text not null check (source in ('gsc', 'ga4', 'aso', 'mrr')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('ok', 'partial', 'error', 'not_authorized', 'not_configured')),
  message text,
  details jsonb not null default '{}'::jsonb
);
create index if not exists report_sync_runs_source_started_idx
  on public.report_sync_runs (source, started_at desc);

-- ── Google Search Console ───────────────────────────────────────────────────
create table if not exists public.report_gsc_daily (
  day date primary key,
  clicks integer not null default 0,
  impressions integer not null default 0,
  ctr numeric(8,6),
  position numeric(8,2),
  updated_at timestamptz not null default now()
);

create table if not exists public.report_gsc_query_daily (
  day date not null,
  query text not null,
  clicks integer not null default 0,
  impressions integer not null default 0,
  ctr numeric(8,6),
  position numeric(8,2),
  updated_at timestamptz not null default now(),
  primary key (day, query)
);

create table if not exists public.report_gsc_page_daily (
  day date not null,
  page text not null,
  clicks integer not null default 0,
  impressions integer not null default 0,
  ctr numeric(8,6),
  position numeric(8,2),
  updated_at timestamptz not null default now(),
  primary key (day, page)
);

create table if not exists public.report_gsc_sitemaps (
  snapshot_day date not null,
  path text not null,
  submitted integer,
  indexed integer,
  errors integer,
  warnings integer,
  last_submitted timestamptz,
  last_downloaded timestamptz,
  is_pending boolean,
  updated_at timestamptz not null default now(),
  primary key (snapshot_day, path)
);

-- ── Google Analytics 4 (jen hostname pumplo.com) ────────────────────────────
-- channel = sessionDefaultChannelGroup; řádek '(all)' = součet za den bez
-- rozpadu (uživatelé se mezi kanály nedají sčítat, proto zvlášť).
create table if not exists public.report_ga4_daily (
  day date not null,
  channel text not null,
  sessions integer not null default 0,
  total_users integer not null default 0,
  new_users integer not null default 0,
  engaged_sessions integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (day, channel)
);

create table if not exists public.report_ga4_events_daily (
  day date not null,
  event_name text not null,
  event_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (day, event_name)
);

-- ── ASO ─────────────────────────────────────────────────────────────────────
create table if not exists public.report_aso_keywords (
  id bigint generated always as identity primary key,
  keyword text not null,
  country text not null default 'cz',
  platform text not null default 'ios' check (platform in ('ios')),
  active boolean not null default true,
  sort_order integer not null default 0,
  note text,
  created_at timestamptz not null default now(),
  unique (keyword, country, platform)
);

create table if not exists public.report_aso_rank_daily (
  day date not null,
  keyword text not null,
  country text not null,
  platform text not null,
  rank integer,                 -- null = Pumplo není v prvních 200 výsledcích
  results_count integer,
  top_results jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (day, keyword, country, platform)
);

create table if not exists public.report_store_rating_daily (
  day date not null,
  platform text not null,
  country text not null default 'cz',
  rating_avg numeric(4,3),
  rating_count integer,
  version text,
  updated_at timestamptz not null default now(),
  primary key (day, platform, country)
);

-- ── MRR ─────────────────────────────────────────────────────────────────────
create table if not exists public.report_mrr_daily (
  day date primary key,
  mrr_czk numeric(12,2) not null default 0,       -- jen placené Stripe předplatné posiloven
  active_paying_gyms integer not null default 0,
  by_plan jsonb not null default '{}'::jsonb,     -- plan_id → {gyms, mrr_czk}
  manual_gyms integer not null default 0,         -- aktivní bez Stripe a bez grandfather (ruční / dočasné)
  manual_list_mrr_czk numeric(12,2) not null default 0, -- ceníková hodnota ručních (NEzahrnuto v mrr_czk)
  free_gyms integer not null default 0,           -- grandfathered (custom deal bez Stripe)
  details jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ── RLS: čtou jen super admini, zapisuje jen service role ───────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'report_sync_runs', 'report_gsc_daily', 'report_gsc_query_daily', 'report_gsc_page_daily',
    'report_gsc_sitemaps', 'report_ga4_daily', 'report_ga4_events_daily', 'report_aso_keywords',
    'report_aso_rank_daily', 'report_store_rating_daily', 'report_mrr_daily'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'admins_read_' || t) then
      execute format($p$create policy %I on public.%I for select to authenticated
        using (exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin'::app_role))$p$,
        'admins_read_' || t, t);
    end if;
  end loop;
end $$;

-- ── Výchozí klíčová slova (z ASO auditu 17. 10. 2026) ───────────────────────
insert into public.report_aso_keywords (keyword, sort_order) values
  ('pumplo', 0),
  ('posilovna', 10),
  ('trénink v posilovně', 20),
  ('tréninkový plán', 30),
  ('trénink', 40),
  ('fitness', 50),
  ('cvičení', 60),
  ('posilování', 70),
  ('gym', 80),
  ('osobní trenér', 90),
  ('fitness aplikace', 100),
  ('cviky', 110),
  ('hubnutí', 120),
  ('nabrat svaly', 130),
  ('workout', 140),
  ('eurogym', 150),
  ('olomouc posilovna', 160)
on conflict (keyword, country, platform) do nothing;

-- ── Aplikace: čísla počítaná při čtení (bez synchronizace) ─────────────────
-- Za skutečné členy (is_real_member: bez týmu, interních domén vč.
-- @demo.pumplo.cz, správců a ukázkové posilovny). Vrací aktuální období
-- i stejně dlouhé předchozí (pro trend) + denní řady.
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
  if not exists (select 1 from user_roles r where r.user_id = auth.uid() and r.role = 'admin') then
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

-- ── Denní spouštění (pg_cron) ───────────────────────────────────────────────
-- Aplikováno ručně přes Management API, protože hlavička nese secret (stejně
-- jako store-metrics-sync-daily). <STORE_SYNC_SECRET> = ~/.keys/store-sync-secret.
--   report-seo-gsc-sync-daily   40 5 * * *  (UTC)
--   report-web-ga4-sync-daily   45 5 * * *
--   report-aso-rank-sync-daily  50 5 * * *
--   report-mrr-snapshot-daily   55 5 * * *
-- select cron.schedule('report-<fn>-daily', '<min> 5 * * *', $c$
--   select net.http_post(url := 'https://udqwjqgdsjobdufdxbpn.supabase.co/functions/v1/<fn>',
--     headers := '{"Content-Type": "application/json", "x-sync-secret": "<STORE_SYNC_SECRET>"}'::jsonb,
--     body := '{}'::jsonb, timeout_milliseconds := 150000) $c$);
