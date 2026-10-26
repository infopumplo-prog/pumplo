// Ověří migraci trenérské platformy proti produkční DB.
// mode=dry  → BEGIN; migrace (2×, opakovatelnost); syntetičtí uživatelé; scénáře RLS/RPC; ROLLBACK
// mode=live → jen čtecí kontroly po skutečném nasazení migrace
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

const mode = process.argv[2] ?? 'dry';
const pat = readFileSync(`${homedir()}/.supabase-pat`, 'utf8').trim();
const migration = readFileSync(new URL('../../supabase/migrations/20261026_trainer_platform.sql', import.meta.url), 'utf8');

// Syntetická ID (v rollbacku zmizí).
const T1 = 'deadbeef-7a1e-4000-8000-000000000001';
const T2 = 'deadbeef-7a1e-4000-8000-000000000002';
const C1 = 'deadbeef-7a1e-4000-8000-000000000003';
const C2 = 'deadbeef-7a1e-4000-8000-000000000004';
const T3 = 'deadbeef-7a1e-4000-8000-000000000005';
const TPL = 'deadbeef-7a1e-4000-8000-0000000000a1';
const TPL_PRIV = 'deadbeef-7a1e-4000-8000-0000000000a2';
const SESS = 'deadbeef-7a1e-4000-8000-0000000000b1';

const as = (uid) => `reset role; select set_config('request.jwt.claims', json_build_object('sub', '${uid}', 'role', 'authenticated')::text, true); set local role authenticated;`;
const asAnon = `reset role; select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true); set local role anon;`;
// Výsledek bloku (OK / chyba) do _tp.
const tryBlock = (key, body) => `do $$ begin ${body} insert into _tp values ('${key}', 'OK'); exception when others then insert into _tp values ('${key}', 'ERR:' || sqlerrm); end $$;`;
const put = (key, sql) => `insert into _tp select '${key}', (${sql})::text;`;
// Počet řádků změněných příkazem (UPDATE … RETURNING 1).
const putMod = (key, dml) => `with u as (${dml}) insert into _tp select '${key}', count(*)::text from u;`;

const users = [T1, T2, C1, C2, T3].map((id, i) =>
  `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
   values ('${id}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tp-probe-${i}@example.test', '', now(), now(), '{}'::jsonb, '{}'::jsonb);`).join('\n');

const scenario = `
create temp table _tp (k text primary key, v text) on commit drop;
grant insert, select on _tp to authenticated, anon;
create temp table _tok (k text primary key, v uuid) on commit drop;
grant insert, select on _tok to authenticated, anon;

${users}
insert into user_roles (user_id, role) values ('${T1}', 'trainer'), ('${T2}', 'trainer'), ('${T3}', 'trainer');
-- Šablony T1: veřejná + soukromá, každá 1 den / 1 cvik (globální cvik bez vlastníka).
insert into custom_plans (id, user_id, name, is_template, template_visibility) values
  ('${TPL}', '${T1}', 'Probe PPL', true, 'public'),
  ('${TPL_PRIV}', '${T1}', 'Probe private', true, 'private');
insert into custom_plan_days (plan_id, day_number, name)
  select p, 1, 'Den A' from unnest(array['${TPL}', '${TPL_PRIV}']::uuid[]) p;
insert into custom_plan_exercises (day_id, exercise_id, sets, reps, order_index)
  select d.id, (select id from exercises where owner_id is null order by id limit 1), 4, 8, 0
  from custom_plan_days d where d.plan_id in ('${TPL}', '${TPL_PRIV}');

-- ── Přístup: T1, T2 mezi prvními 10 → zdarma; doplnit do 10 zakladatelů; T3 = waitlist ──
${as(T1)}
${put('t1_tier', `select trainer_claim_access()`)}
${put('t1_tier_again', `select trainer_claim_access()`)}
${as(T2)}
${put('t2_tier', `select trainer_claim_access()`)}
${as(C2)}
${tryBlock('client_claim', `perform trainer_claim_access();`)}
${tryBlock('client_write_access', `insert into trainer_access (user_id, tier) values ('${C2}', 'paid');`)}
reset role;
insert into _tp select 'founders_before_fill', count(*)::text from trainer_access where tier = 'founder_free';
do $$ declare n int := trainer_free_trainer_limit() - (select count(*) from trainer_access where tier = 'founder_free'); u uuid;
begin for i in 1..n loop
  u := gen_random_uuid();
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values (u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tp-fill-' || i || '@example.test', '', now(), now(), '{}'::jsonb, '{}'::jsonb);
  insert into trainer_access (user_id, tier) values (u, 'founder_free');
end loop; end $$;
${as(T3)}
${put('t3_tier', `select trainer_claim_access()`)}
${put('t3_status', `select tier || '|' || free_limit || '|' || free_taken from trainer_access_status()`)}
${tryBlock('t3_invite', `perform trainer_invite_client(null);`)}

-- ── T1: pozvánky (bez limitu klientů) ──
${as(T1)}
insert into _tok select 'c1', invite_token from trainer_invite_client('C1@Example.test ');
${put('same_email_reuses', `(select invite_token from trainer_invite_client('c1@example.test')) = (select v from _tok where k = 'c1')`)}
do $$ begin for i in 1..10 loop perform trainer_invite_client(null); end loop; end $$;
${put('t1_live_links', `select count(*) from trainer_clients`)}
${tryBlock('bad_email', `perform trainer_invite_client('nope');`)}
insert into _tok select 'own', invite_token from trainer_clients where invite_email is null order by created_at limit 1;
${tryBlock('accept_own', `perform trainer_accept_invite((select v from _tok where k = 'own'));`)}

-- ── C2 (není trenér) nemůže zvát ──
${as(C2)}
${tryBlock('client_invite', `perform trainer_invite_client(null);`)}
${tryBlock('auth_display_name', `perform trainer_display_name('${T1}');`)}
${put('c2_sees_links', `select count(*) from trainer_clients`)}

-- ── anon: info o pozvánce, nic víc ──
${asAnon}
${put('anon_info', `select trainer_name || '|' || is_valid from trainer_invite_info((select v from _tok where k = 'c1'))`)}
${tryBlock('anon_accept', `perform trainer_accept_invite((select v from _tok where k = 'c1'));`)}
${tryBlock('anon_display_name', `perform trainer_display_name('${C1}');`)}
${put('anon_public_plans_ok', `select count(*) >= 0 from custom_plans where is_public`)}

-- ── C1 přijme, C2 už ne ──
${as(C1)}
${put('c1_accept', `select status from trainer_accept_invite((select v from _tok where k = 'c1'))`)}
${put('c1_accept_again', `select status from trainer_accept_invite((select v from _tok where k = 'c1'))`)}
${put('c1_my_trainers', `select count(*) from my_trainers()`)}
${as(C2)}
${tryBlock('c2_accept_used', `perform trainer_accept_invite((select v from _tok where k = 'c1'));`)}

-- ── T1 přiřadí veřejnou šablonu C1 ──
${as(T1)}
insert into _tok select 'link1', id from trainer_clients where client_user_id = '${C1}';
insert into _tok select 'asg1', trainer_assign_plan((select v from _tok where k = 'link1'), '${TPL}', current_date - 3, 4, 3, 'Probe PPL pro C1');
${put('copy_owner_is_client', `select p.user_id = '${C1}' and p.source_plan_id = '${TPL}' and not p.is_template from trainer_plan_assignments a join custom_plans p on p.id = a.plan_id where a.id = (select v from _tok where k = 'asg1')`)}
${put('copy_exercises', `select count(*) from custom_plan_exercises e join custom_plan_days d on d.id = e.day_id join trainer_plan_assignments a on a.plan_id = d.plan_id where a.id = (select v from _tok where k = 'asg1')`)}
${putMod('t1_updates_copy', `update custom_plans set name = 'Upraveno trenérem' where id = (select plan_id from trainer_plan_assignments where id = (select v from _tok where k = 'asg1')) returning 1`)}

${tryBlock('t1_steal_copy', `update custom_plans set user_id = '${T1}' where name = 'Upraveno trenérem';`)}
${tryBlock('t1_publish_copy', `update custom_plans set is_public = true where name = 'Upraveno trenérem';`)}
-- ── C1 odcvičí trénink z kopie + zpětná vazba ──
${as(C1)}
${put('c1_sees_copy', `select count(*) from custom_plans where name = 'Upraveno trenérem'`)}
insert into workout_sessions (id, user_id, plan_id, day_letter, goal_id, started_at, completed_at, custom_plan_id)
  values ('${SESS}', '${C1}', null, 'PR', 'general_fitness', now() - interval '1 hour', now(),
          (select plan_id from trainer_plan_assignments where client_user_id = '${C1}' limit 1));
${putMod('c1_feedback', `update workout_sessions set client_difficulty = 4, client_note = 'Dřepy bolely koleno' where id = '${SESS}' returning 1`)}
${tryBlock('c1_bad_difficulty', `update workout_sessions set client_difficulty = 9 where id = '${SESS}';`)}

-- ── T1 vidí trénink, přehled a dá srdíčko ──
${as(T1)}
${put('t1_sees_session', `select count(*) from workout_sessions where id = '${SESS}' and client_difficulty = 4 and client_note like 'Dřepy%'`)}
${put('t1_overview', `select client_email || '|' || sessions_7d || '|' || done_sessions || '/' || target_sessions || '|' || progress_pct || '|' || plan_name from trainer_clients_overview() where client_user_id = '${C1}'`)}
${put('t1_overview_rows', `select count(*) from trainer_clients_overview()`)}
${tryBlock('t1_heart', `insert into trainer_session_reactions (session_id, trainer_user_id) values ('${SESS}', '${T1}');`)}

-- ── T2: cizí klient je neviditelný; veřejná šablona ano, soukromá ne ──
${as(T2)}
${put('t2_sees_session', `select count(*) from workout_sessions where id = '${SESS}'`)}
${put('t2_overview_rows', `select count(*) from trainer_clients_overview()`)}
${putMod('t2_updates_copy', `update custom_plans set name = 'hack' where name = 'Upraveno trenérem' returning 1`)}
${tryBlock('t2_heart', `insert into trainer_session_reactions (session_id, trainer_user_id) values ('${SESS}', '${T2}');`)}
${put('t2_public_tpl', `select count(*) from custom_plans where id = '${TPL}'`)}
${put('t2_public_tpl_days', `select count(*) from custom_plan_days where plan_id = '${TPL}'`)}
${put('t2_private_tpl', `select count(*) from custom_plans where id = '${TPL_PRIV}'`)}
insert into _tok select 'c2', invite_token from trainer_invite_client('tp-probe-3@example.test');
${as(C2)}
select trainer_accept_invite((select v from _tok where k = 'c2'));
${as(T2)}
${tryBlock('t2_assign_private', `perform trainer_assign_plan((select id from trainer_clients where client_user_id = '${C2}'), '${TPL_PRIV}', current_date, 4, 3);`)}
${tryBlock('t2_assign_public', `perform trainer_assign_plan((select id from trainer_clients where client_user_id = '${C2}'), '${TPL}', current_date, 4, 3);`)}

-- ── C2 (běžný člen) veřejnou šablonu nevidí ──
${as(C2)}
${put('c2_public_tpl', `select count(*) from custom_plans where id = '${TPL}'`)}

-- ── C1 vidí srdíčko, pak ukončí spolupráci → T1 ztratí přístup ──
${as(C1)}
${put('c1_sees_heart', `select count(*) from trainer_session_reactions where session_id = '${SESS}'`)}
select trainer_end_client((select id from trainer_clients where client_user_id = '${C1}'));
${as(T1)}
${put('t1_after_end_session', `select count(*) from workout_sessions where id = '${SESS}'`)}
${put('t1_after_end_overview', `select count(*) from trainer_clients_overview()`)}
${putMod('t1_after_end_update', `update custom_plans set name = 'x' where name = 'Upraveno trenérem' returning 1`)}
${as(C1)}
${put('c1_keeps_plan', `select count(*) from custom_plans where name = 'Upraveno trenérem'`)}
reset role;
`;

const query = mode === 'live'
  ? `select
      (select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('trainer_clients', 'trainer_plan_assignments', 'trainer_session_reactions', 'trainer_access'))::int as tables,
      (select count(*) from information_schema.columns where table_schema = 'public' and ((table_name = 'custom_plans' and column_name in ('is_template', 'template_visibility')) or (table_name = 'workout_sessions' and column_name in ('client_difficulty', 'client_note'))))::int as cols,
      (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname in ('trainer_invite_client', 'trainer_invite_info', 'trainer_accept_invite', 'trainer_end_client', 'trainer_assign_plan', 'trainer_end_assignment', 'trainer_assignment_progress', 'trainer_clients_overview', 'my_trainers', 'trainer_free_trainer_limit', 'trainer_claim_access', 'trainer_access_status', 'is_trainer', 'is_my_active_client', 'trainer_manages_plan', 'is_public_template', 'trainer_display_name'))::int as fns,
      (select relrowsecurity from pg_class where oid = 'public.trainer_clients'::regclass) as rls,
      has_function_privilege('anon', 'public.trainer_invite_client(text)', 'execute') as anon_invite,
      has_function_privilege('anon', 'public.trainer_invite_info(uuid)', 'execute') as anon_info,
      has_function_privilege('authenticated', 'public.trainer_display_name(uuid)', 'execute') as auth_display_name;`
  : `begin;\n${migration}\n${migration}\n${scenario}\nselect json_object_agg(k, v) as r from _tp;\nrollback;`;

const res = await fetch('https://api.supabase.com/v1/projects/udqwjqgdsjobdufdxbpn/database/query', {
  method: 'POST',
  headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
});
const body = await res.json();
if (!res.ok) { console.error('query failed', JSON.stringify(body)); process.exit(1); }
const row = Array.isArray(body) ? body[0] : null;
console.log(JSON.stringify(row, null, 1));

const failures = [];
const expect = (k, cond) => { if (!cond) failures.push(k); };
if (mode === 'live') {
  expect('tables', row?.tables === 4);
  expect('cols', row?.cols === 4);
  expect('fns', row?.fns === 17);
  expect('rls', row?.rls === true);
  expect('anon_invite', row?.anon_invite === false);
  expect('anon_info', row?.anon_info === true);
  expect('auth_display_name', row?.auth_display_name === false);
} else {
  const r = row?.r ?? {};
  const err = (k, msg) => String(r[k]).startsWith('ERR:') && String(r[k]).includes(msg);
  expect('same_email_reuses', r.same_email_reuses === 'true');
  expect('t1_live_links', r.t1_live_links === '11');
  expect('t1_tier', r.t1_tier === 'founder_free');
  expect('t1_tier_again', r.t1_tier_again === 'founder_free');
  expect('t2_tier', r.t2_tier === 'founder_free');
  expect('client_claim', err('client_claim', 'not_trainer'));
  expect('client_write_access', err('client_write_access', 'row-level security'));
  expect('founders_before_fill', r.founders_before_fill === '2');
  expect('t3_tier', r.t3_tier === 'waitlist');
  expect('t3_status', r.t3_status === 'waitlist|10|10');
  expect('t3_invite', err('t3_invite', 'trainer_access_required'));
  expect('bad_email', err('bad_email', 'invalid_email'));
  expect('accept_own', err('accept_own', 'own_invite'));
  expect('client_invite', err('client_invite', 'not_trainer'));
  expect('c2_sees_links', r.c2_sees_links === '0');
  expect('anon_info', r.anon_info === 'tp-probe-0|true');
  expect('anon_accept', err('anon_accept', 'permission denied'));
  expect('anon_display_name', err('anon_display_name', 'permission denied'));
  expect('auth_display_name', err('auth_display_name', 'permission denied'));
  expect('anon_public_plans_ok', r.anon_public_plans_ok === 'true');
  expect('c1_accept', r.c1_accept === 'active');
  expect('c1_accept_again', r.c1_accept_again === 'active');
  expect('c1_my_trainers', r.c1_my_trainers === '1');
  expect('c2_accept_used', err('c2_accept_used', 'invite_used'));
  expect('copy_owner_is_client', r.copy_owner_is_client === 'true');
  expect('copy_exercises', r.copy_exercises === '1');
  expect('t1_updates_copy', r.t1_updates_copy === '1');
  expect('t1_steal_copy', err('t1_steal_copy', 'plan_owner_fields_locked'));
  expect('t1_publish_copy', err('t1_publish_copy', 'plan_owner_fields_locked'));
  expect('c1_sees_copy', r.c1_sees_copy === '1');
  expect('c1_feedback', r.c1_feedback === '1');
  expect('c1_bad_difficulty', err('c1_bad_difficulty', 'client_difficulty_check'));
  expect('t1_sees_session', r.t1_sees_session === '1');
  expect('t1_overview', r.t1_overview === 'tp-probe-2@example.test|1|1/12|8|Probe PPL pro C1');
  expect('t1_overview_rows', r.t1_overview_rows === '11');
  expect('t1_heart', r.t1_heart === 'OK');
  expect('t2_sees_session', r.t2_sees_session === '0');
  expect('t2_overview_rows', r.t2_overview_rows === '0');
  expect('t2_updates_copy', r.t2_updates_copy === '0');
  expect('t2_heart', err('t2_heart', 'row-level security'));
  expect('t2_public_tpl', r.t2_public_tpl === '1');
  expect('t2_public_tpl_days', r.t2_public_tpl_days === '1');
  expect('t2_private_tpl', r.t2_private_tpl === '0');
  expect('t2_assign_private', err('t2_assign_private', 'template_not_found'));
  expect('t2_assign_public', r.t2_assign_public === 'OK');
  expect('c2_public_tpl', r.c2_public_tpl === '0');
  expect('c1_sees_heart', r.c1_sees_heart === '1');
  expect('t1_after_end_session', r.t1_after_end_session === '0');
  expect('t1_after_end_overview', r.t1_after_end_overview === '10');
  expect('t1_after_end_update', r.t1_after_end_update === '0');
  expect('c1_keeps_plan', r.c1_keeps_plan === '1');
}
if (failures.length) { console.error('migration probe FAILED:', failures.join(', ')); process.exit(1); }
console.log(`TRAINER_PLATFORM_MIGRATION_OK mode=${mode}`);
