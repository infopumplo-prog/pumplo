-- E-maily F1 (19. 10. 2026): retargetingová architektura M3–M8 nad F0.
--
-- Spec: Vaults/pumplo/strategie/2026-10-01-retargeting-automatizace-skolni-zadani.md
--       (Pravidla systému, Frekvence, Právní základ, M3–M8)
--     + 2026-10-18 E-mailová strategie Pumplo — řídí Petr na iMacu.md
--
-- Idempotentní: dá se pustit opakovaně. NIC neschvaluje ani neseeduje šablony — M3–M8
-- se od 19. 10. 2026 staví v Loops (docs/email/loops-journeys.md). M2A (F0) beze změny.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Sloupce v profilu (právní brána obchodních sdělení)
-- ─────────────────────────────────────────────────────────────────────────────
-- marketing_consent_at   = výslovný souhlas s tipy e-mailem (in-app žádost „Ano“,
--                          nebo zapnutí „E-maily s tipy“ v Nastavení).
-- email_optout_offered_at = při sběru e-mailu (registrace) byla nabídnuta volba odmítnutí
--                          (§ 7 odst. 3 zák. 480/2004 Sb.). Zapisuje JEN klient, který
--                          zaškrtávátko „Nechci dostávat tipy…“ opravdu ukázal. Starší buildy
--                          z obchodů ho nemají → NULL → žádné obchodní e-maily bez souhlasu.
alter table public.user_profiles add column if not exists marketing_consent_at timestamptz;
alter table public.user_profiles add column if not exists email_optout_offered_at timestamptz;
-- Zápis vlastního řádku kryje stávající policy „Users manage own profile“.

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. contact_log — každý kontakt napříč kanály (strop 1 kontakt / pražský den)
-- ─────────────────────────────────────────────────────────────────────────────
-- Píšou: lifecycle-emails (M2A), loops-webhook (e-mail z Loops, type = loops:<název>) a send-push-notifications
-- (channel 'push', type = morning/missed/first_workout/closing/comeback). Bez backfillu:
-- do té doby brána čte i notification_logs.date_key.
create table if not exists public.contact_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('push', 'email', 'in_app')),
  type text not null,
  sent_at timestamptz not null default now()
);
create index if not exists contact_log_user_sent_idx on public.contact_log (user_id, sent_at desc);
create index if not exists contact_log_sent_idx on public.contact_log (sent_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. email_events — webhook Resend (doručení, otevření, kliky, bounce, stížnost)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  svix_id text,                           -- idempotence: Resend/Svix doručuje at-least-once
  resend_id text,                         -- = email_sends.resend_id
  type text not null check (type in ('delivered', 'opened', 'clicked', 'bounced', 'complained')),
  email text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists email_events_svix_id_key on public.email_events (svix_id);
create index if not exists email_events_resend_type_idx on public.email_events (resend_id, type);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. email_eligible_daily — kolik lidí šablona ten den oslovila (před stropy)
-- ─────────────────────────────────────────────────────────────────────────────
-- Od 19. 10. 2026 ji nikdo nezapisuje (M3–M8 běží v Loops, statistiky má Loops); zůstává kvůli KPI view.
create table if not exists public.email_eligible_daily (
  day date not null,
  template_key text not null,
  eligible integer not null default 0 check (eligible >= 0),
  updated_at timestamptz not null default now(),
  primary key (day, template_key)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS: číst smí jen admin, klient nezapisuje nic (zapisují edge funkce service rolí)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.contact_log enable row level security;
alter table public.email_events enable row level security;
alter table public.email_eligible_daily enable row level security;

revoke insert, update, delete, truncate on public.contact_log from anon, authenticated;
revoke insert, update, delete, truncate on public.email_events from anon, authenticated;
revoke insert, update, delete, truncate on public.email_eligible_daily from anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'contact_log' and policyname = 'Admins read contact_log') then
    create policy "Admins read contact_log" on public.contact_log
      for select to authenticated using (public.has_role(auth.uid(), 'admin'::public.app_role));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'email_events' and policyname = 'Admins read email_events') then
    create policy "Admins read email_events" on public.email_events
      for select to authenticated using (public.has_role(auth.uid(), 'admin'::public.app_role));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'email_eligible_daily' and policyname = 'Admins read email_eligible_daily') then
    create policy "Admins read email_eligible_daily" on public.email_eligible_daily
      for select to authenticated using (public.has_role(auth.uid(), 'admin'::public.app_role));
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. View email_lifecycle_facts — vše, co pravidla M3–M8 potřebují, na jeden dotaz
-- ─────────────────────────────────────────────────────────────────────────────
-- Staví na email_eligible_users (F0: bez demo/staff/rolí/odhlášených/suppressions).
-- Tréninky: jen dokončené, bez Hevy importu (day_letter 'H') a demo posilovny.
-- workout_dates = pražská data (YYYY-MM-DD) všech dokončených tréninků vzestupně —
-- okna a počty (n14, n14prev, dny od posledního) počítají čistá pravidla v loops-sync/sync.ts.
-- ZÁMĚRNĚ bez injuries / weight_kg / height_cm / age (nikdy nepersonalizovat podle nich).
-- marketing_ok = stejná právní brána jako legalGate() v loops-sync/sync.ts (= marketingAllowed v Loops).
create or replace view public.email_lifecycle_facts as
select
  e.user_id,
  e.email,
  e.signed_up_at,
  e.auth_provider,
  e.first_name,
  e.language,
  e.onboarding_completed,
  e.current_step,
  e.selected_gym_id,
  e.marketing_optout_at,
  p.marketing_consent_at,
  p.email_optout_offered_at,
  p.email_unsubscribed_at,
  coalesce(p.notification_comeback, true) as notification_comeback,
  p.training_days,
  p.current_day_index,
  g.name as selected_gym_name,
  coalesce(ws.completed_workouts, 0) as completed_workouts,
  ws.first_completed_at,
  ws.last_completed_at,
  coalesce(ws.workout_dates, '{}'::text[]) as workout_dates,
  pl.first_gym_plan_at,
  ap.plan_training_days,
  exists (select 1 from public.device_tokens d where d.user_id = e.user_id) as has_device_token,
  (
    p.email_unsubscribed_at is null
    and (
      (p.marketing_consent_at is not null
        and (e.marketing_optout_at is null or e.marketing_optout_at < p.marketing_consent_at))
      or (p.email_optout_offered_at is not null and e.marketing_optout_at is null)
    )
  ) as marketing_ok
from public.email_eligible_users e
join public.user_profiles p on p.user_id = e.user_id
left join public.gyms g on g.id = e.selected_gym_id
left join lateral (
  select
    count(*)::int as completed_workouts,
    min(w.completed_at) as first_completed_at,
    max(w.completed_at) as last_completed_at,
    array_agg(to_char(w.completed_at at time zone 'Europe/Prague', 'YYYY-MM-DD') order by w.completed_at) as workout_dates
  from public.workout_sessions w
  where w.user_id = e.user_id
    and w.completed_at is not null
    and w.day_letter is distinct from 'H'
    and w.gym_id is distinct from 'deadbeef-0000-4000-8000-000000000001'::uuid
) ws on true
left join lateral (
  select min(up.created_at) as first_gym_plan_at
  from public.user_workout_plans up
  where up.user_id = e.user_id and up.gym_id is not null
) pl on true
left join lateral (
  select up.training_days as plan_training_days
  from public.user_workout_plans up
  where up.user_id = e.user_id and up.is_active
  order by up.created_at desc
  limit 1
) ap on true;

revoke all on public.email_lifecycle_facts from public, anon, authenticated;
grant select on public.email_lifecycle_facts to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. KPI view email_kpi_daily (pražský den × šablona) — ranní report Petra
-- ─────────────────────────────────────────────────────────────────────────────
-- eligible     = email_eligible_daily (kandidáti po pravidlech a právní bráně, před stropy)
-- sent         = email_sends.status 'sent' (dry run se nepočítá)
-- delivered … complained = odeslané e-maily s danou událostí z Resend webhooku
-- unsubscribed = příjemce se do 72 h od e-mailu odhlásil (email_unsubscribed_at)
--                nebo odmítl tipy (marketing_optout_at)
-- converted    = cílový krok do 72 h od e-mailu:
--                M2A → dotazník dokončen (vznikl plán, profil onboarding_completed)
--                M3A/M3B/M4/M5 → první dokončený trénink
--                M6 → druhý trénink;  M7/M8 → další trénink
--                (všichni kromě M2A měli v okamžiku e-mailu známý počet tréninků,
--                 takže stačí „dokončený trénink v okně“)
create or replace view public.email_kpi_daily as
with sends as (
  select s.*, (s.created_at at time zone 'Europe/Prague')::date as day
  from public.email_sends s
  where s.status = 'sent'
),
keys as (
  select day, template_key from sends
  union
  select day, template_key from public.email_eligible_daily
)
select
  k.day,
  k.template_key,
  coalesce(max(el.eligible), 0) as eligible,
  count(s.id) as sent,
  count(s.id) filter (where exists (select 1 from public.email_events ev where ev.resend_id = s.resend_id and ev.type = 'delivered')) as delivered,
  count(s.id) filter (where exists (select 1 from public.email_events ev where ev.resend_id = s.resend_id and ev.type = 'opened')) as opened,
  count(s.id) filter (where exists (select 1 from public.email_events ev where ev.resend_id = s.resend_id and ev.type = 'clicked')) as clicked,
  count(s.id) filter (where exists (select 1 from public.email_events ev where ev.resend_id = s.resend_id and ev.type = 'bounced')) as bounced,
  count(s.id) filter (where exists (select 1 from public.email_events ev where ev.resend_id = s.resend_id and ev.type = 'complained')) as complained,
  count(s.id) filter (where
    (p.email_unsubscribed_at > s.created_at and p.email_unsubscribed_at <= s.created_at + interval '72 hours')
    or (p.marketing_optout_at > s.created_at and p.marketing_optout_at <= s.created_at + interval '72 hours')
  ) as unsubscribed,
  count(s.id) filter (where case
    when s.template_key = 'M2A' then
      coalesce(p.onboarding_completed, false)
      and exists (
        select 1 from public.user_workout_plans up
        where up.user_id = s.user_id
          and up.created_at > s.created_at and up.created_at <= s.created_at + interval '72 hours'
      )
    else exists (
      select 1 from public.workout_sessions w
      where w.user_id = s.user_id
        and w.completed_at > s.created_at and w.completed_at <= s.created_at + interval '72 hours'
        and w.day_letter is distinct from 'H'
    )
  end) as converted
from keys k
left join sends s on s.day = k.day and s.template_key = k.template_key
left join public.email_eligible_daily el on el.day = k.day and el.template_key = k.template_key
left join public.user_profiles p on p.user_id = s.user_id
group by k.day, k.template_key;

revoke all on public.email_kpi_daily from public, anon, authenticated;
grant select on public.email_kpi_daily to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Šablony M3–M8 se do email_templates NESEEDUJÍ (změna 19. 10. 2026)
-- ─────────────────────────────────────────────────────────────────────────────
-- Obchodní e-maily M3–M8 se staví a posílají v Loops (journeys); texty a pravidla jsou
-- v docs/email/loops-journeys.md. Data a události do Loops posílá loops-sync
-- (migrace 20261019b_loops.sql). email_templates dál slouží jen pro M2A (F0).

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Cron — beze změny (job lifecycle-emails-hourly v :30 z F0 už běží)
-- ─────────────────────────────────────────────────────────────────────────────
-- lifecycle-emails posílá jen M2A; M3–M8 řídí Loops (cron loops-sync v 20261019b_loops.sql).
--
-- select cron.schedule(
--   'lifecycle-emails-hourly',
--   '30 * * * *',
--   $cron$ select net.http_post(
--     url := 'https://udqwjqgdsjobdufdxbpn.supabase.co/functions/v1/lifecycle-emails',
--     headers := '{"Authorization": "Bearer <CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
--     body := '{}'::jsonb,
--     timeout_milliseconds := 60000) $cron$
-- );
--
-- Schválení verze (David, po kontrole náhledu — každá šablona zvlášť):
-- update public.email_templates set status = 'approved', approved_by = 'David Novotný', approved_at = now(), updated_at = now()
--  where key = 'M6' and version = 1;
