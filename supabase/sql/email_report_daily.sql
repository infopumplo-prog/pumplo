-- Ranní e-mailový report pro Petra (F1 e-maily, 19. 10. 2026). JEN ČTENÍ.
-- Spouštět read-only (Management API "read_only": true nebo role report_ro); jeden příkaz,
-- jedna tabulka výsledků:
--   section = 'yesterday'      → včerejší pražský den po šablonách z email_kpi_daily
--   section = 'activation_7d'  → aktivace: první dokončený trénink do 7×24 h od registrace,
--                                kohorta registrací za 7 dní končících před 7 dny
--                                (jen oslovitelní členové z email_eligible_users; cíl 30 %)
--   section = 'activation_30d' → totéž pro kohortu registrací za 30 dní končících před 7 dny
-- converted = cílový krok do 72 h (M2A dotazník, M3–M5 1. trénink, M6 2. trénink, M7/M8 další).
with yesterday as (
  select ((now() at time zone 'Europe/Prague')::date - 1) as day
),
kpi as (
  select
    'yesterday'::text as section,
    k.template_key,
    k.eligible, k.sent, k.delivered, k.opened, k.clicked, k.bounced, k.complained, k.unsubscribed, k.converted,
    case when k.sent > 0 then round(100.0 * k.converted / k.sent, 1) end as rate_pct
  from public.email_kpi_daily k, yesterday y
  where k.day = y.day
),
cohort as (
  select
    e.user_id,
    e.signed_up_at,
    ((now() at time zone 'Europe/Prague')::date - (e.signed_up_at at time zone 'Europe/Prague')::date) as age_days,
    exists (
      select 1 from public.workout_sessions w
      where w.user_id = e.user_id
        and w.completed_at is not null
        and w.completed_at <= e.signed_up_at + interval '7 days'
        and w.day_letter is distinct from 'H'
        and w.gym_id is distinct from 'deadbeef-0000-4000-8000-000000000001'::uuid
    ) as activated
  from public.email_eligible_users e
),
activation as (
  select
    'activation_7d'::text as section, null::text as template_key,
    count(*)::bigint as eligible, null::bigint as sent, null::bigint as delivered, null::bigint as opened,
    null::bigint as clicked, null::bigint as bounced, null::bigint as complained, null::bigint as unsubscribed,
    count(*) filter (where activated)::bigint as converted,
    case when count(*) > 0 then round(100.0 * count(*) filter (where activated) / count(*), 1) end as rate_pct
  from cohort where age_days between 8 and 14
  union all
  select
    'activation_30d', null,
    count(*), null, null, null, null, null, null, null,
    count(*) filter (where activated),
    case when count(*) > 0 then round(100.0 * count(*) filter (where activated) / count(*), 1) end
  from cohort where age_days between 8 and 37
)
select * from kpi
union all
select * from activation
order by section desc, template_key;
