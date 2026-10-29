// Ověří migraci fází a progrese (20261029) proti produkční DB.
// mode=dry  → BEGIN; migrace 2×; syntetičtí uživatelé; scénáře RLS/RPC; ROLLBACK
// mode=live → jen čtecí kontroly po nasazení
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

const mode = process.argv[2] ?? 'dry';
const pat = readFileSync(`${homedir()}/.supabase-pat`, 'utf8').trim();
const migration = readFileSync(new URL('../../supabase/migrations/20261029_trainer_phases_progression.sql', import.meta.url), 'utf8');

const T1 = 'deadbeef-7a1f-4000-8000-000000000001';
const T2 = 'deadbeef-7a1f-4000-8000-000000000002';
const C1 = 'deadbeef-7a1f-4000-8000-000000000003';
const C2 = 'deadbeef-7a1f-4000-8000-000000000004';
const TPL = 'deadbeef-7a1f-4000-8000-0000000000a1';
const PH1 = 'deadbeef-7a1f-4000-8000-0000000000b1';
const PH2 = 'deadbeef-7a1f-4000-8000-0000000000b2';
const D1 = 'deadbeef-7a1f-4000-8000-0000000000c1';
const D2 = 'deadbeef-7a1f-4000-8000-0000000000c2';
const EX1 = 'deadbeef-7a1f-4000-8000-0000000000d1';
const PUB = 'deadbeef-7a1f-4000-8000-0000000000e1';
const PRIV = 'deadbeef-7a1f-4000-8000-0000000000e2';

const as = (uid) => `reset role; select set_config('request.jwt.claims', json_build_object('sub', '${uid}', 'role', 'authenticated')::text, true); set local role authenticated;`;
const asAnon = `reset role; select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true); set local role anon;`;
const tryBlock = (key, body) => `do $$ begin ${body} insert into _tp values ('${key}', 'OK'); exception when others then insert into _tp values ('${key}', 'ERR:' || sqlerrm); end $$;`;
const put = (key, sql) => `insert into _tp select '${key}', (${sql})::text;`;
const putMod = (key, dml) => `with u as (${dml}) insert into _tp select '${key}', count(*)::text from u;`;

const users = [T1, T2, C1, C2].map((id, i) =>
  `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
   values ('${id}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tph-probe-${i}@example.test', '', now(), now(), '{}'::jsonb, '{}'::jsonb);`).join('\n');
const EXID = `(select id from exercises where owner_id is null order by id limit 1)`;

const scenario = `
create temp table _tp (k text primary key, v text) on commit drop;
grant insert, select on _tp to authenticated, anon;
create temp table _tok (k text primary key, v uuid) on commit drop;
grant insert, select on _tok to authenticated, anon;

${users}
insert into user_roles (user_id, role) values ('${T1}', 'trainer'), ('${T2}', 'trainer');
insert into trainer_access (user_id, tier) values ('${T1}', 'paid'), ('${T2}', 'paid');

-- Šablona T1: 8 týdnů, fáze 1–4 a 5–8, den v každé fázi, cvik s progresí od 5. týdne.
insert into custom_plans (id, user_id, name, is_template, duration_weeks) values ('${TPL}', '${T1}', 'Probe fáze', true, 8);
insert into custom_plan_phases (id, plan_id, order_index, name, start_week, end_week) values
  ('${PH1}', '${TPL}', 0, 'Doma', 1, 4), ('${PH2}', '${TPL}', 1, 'Posilovna', 5, 8);
insert into custom_plan_days (id, plan_id, day_number, name, phase_id) values
  ('${D1}', '${TPL}', 1, 'Den A doma', '${PH1}'), ('${D2}', '${TPL}', 2, 'Den A posilovna', '${PH2}');
insert into custom_plan_exercises (id, day_id, exercise_id, sets, reps, order_index) values ('${EX1}', '${D1}', ${EXID}, 3, 10, 0);
insert into custom_plan_exercise_progressions (plan_exercise_id, from_week, sets) values ('${EX1}', 5, 4);
-- Veřejný a soukromý plán C2 s fází (čtení anonem).
insert into custom_plans (id, user_id, name, is_public) values ('${PUB}', '${C2}', 'Veřejný', true), ('${PRIV}', '${C2}', 'Soukromý', false);
insert into custom_plan_phases (plan_id, name, start_week, end_week) values ('${PUB}', 'F', 1, 2), ('${PRIV}', 'F', 1, 2);

-- ── T1 pozve C1, C1 přijme ──
${as(T1)}
insert into _tok select 'inv', invite_token from trainer_invite_client(null);
${as(C1)}
select trainer_accept_invite((select v from _tok where k = 'inv'));

-- ── T1 přiřadí šablonu bez zadané délky ──
${as(T1)}
insert into _tok select 'link', id from trainer_clients where client_user_id = '${C1}';
insert into _tok select 'asg', trainer_assign_plan((select v from _tok where k = 'link'), '${TPL}', current_date, null, 3);
insert into _tok select 'copy', plan_id from trainer_plan_assignments where id = (select v from _tok where k = 'asg');
${put('asg_weeks', `select weeks from trainer_plan_assignments where id = (select v from _tok where k = 'asg')`)}
${put('copy_duration', `select duration_weeks from custom_plans where id = (select v from _tok where k = 'copy')`)}
${put('copy_phases', `select count(*) from custom_plan_phases where plan_id = (select v from _tok where k = 'copy')`)}
${put('copy_days_mapped', `select count(*) from custom_plan_days d join custom_plan_phases ph on ph.id = d.phase_id where d.plan_id = (select v from _tok where k = 'copy') and ph.plan_id = d.plan_id`)}
${put('copy_progression', `select string_agg(pr.from_week || ':' || pr.sets, ',') from custom_plan_exercise_progressions pr join custom_plan_exercises e on e.id = pr.plan_exercise_id join custom_plan_days d on d.id = e.day_id where d.plan_id = (select v from _tok where k = 'copy')`)}
${putMod('t1_edit_progression', `update custom_plan_exercise_progressions set sets = 5 where plan_exercise_id in (select e.id from custom_plan_exercises e join custom_plan_days d on d.id = e.day_id where d.plan_id = (select v from _tok where k = 'copy')) returning 1`)}
${tryBlock('phase_guard', `update custom_plan_days set phase_id = '${PH1}' where plan_id = (select v from _tok where k = 'copy');`)}

-- ── C1 čte své fáze a progresi ──
${as(C1)}
${put('c1_phases', `select count(*) from custom_plan_phases where plan_id = (select v from _tok where k = 'copy')`)}
${put('c1_progression', `select string_agg(sets::text, ',') from custom_plan_exercise_progressions`)}

-- ── T2 (cizí trenér) nic nevidí ani nemění ──
${as(T2)}
${put('t2_phases', `select count(*) from custom_plan_phases where plan_id = (select v from _tok where k = 'copy')`)}
${put('t2_progressions', `select count(*) from custom_plan_exercise_progressions`)}
${tryBlock('t2_insert_progression', `insert into custom_plan_exercise_progressions (plan_exercise_id, from_week, sets) values ((select v from _tok where k = 'copyex'), 7, 9);`)}
${put('t2_tpl_private', `select count(*) from custom_plan_phases where plan_id = '${TPL}'`)}

-- ── veřejná šablona: T2 fáze vidí ──
reset role; select set_config('request.jwt.claims', '', true);
update custom_plans set template_visibility = 'public' where id = '${TPL}';
${as(T2)}
${put('t2_tpl_public', `select count(*) from custom_plan_phases where plan_id = '${TPL}'`)}

-- ── anon: veřejný plán ano, soukromý ne ──
${asAnon}
${put('anon_public', `select count(*) from custom_plan_phases where plan_id = '${PUB}'`)}
${put('anon_private', `select count(*) from custom_plan_phases where plan_id = '${PRIV}'`)}
${tryBlock('anon_write', `insert into custom_plan_phases (plan_id, name, start_week, end_week) values ('${PUB}', 'x', 1, 1);`)}

-- ── konec spolupráce → T1 ztratí přístup k fázím kopie ──
${as(C1)}
select trainer_end_client((select v from _tok where k = 'link'));
${as(T1)}
${put('t1_after_end', `select count(*) from custom_plan_phases where plan_id = (select v from _tok where k = 'copy')`)}
reset role;
`;

// T2 nevidí cviky kopie, proto ID cviku kopie uložíme dopředu jako vlastník transakce.
const scenarioWithCopyEx = scenario.replace(
  `\${as(C1)}\n\${put('c1_phases'`,
  `\${as(C1)}\n\${put('c1_phases'`,
).replace(
  `-- ── C1 čte své fáze a progresi ──`,
  `reset role;\ninsert into _tok select 'copyex', e.id from custom_plan_exercises e join custom_plan_days d on d.id = e.day_id where d.plan_id = (select v from _tok where k = 'copy') limit 1;\n-- ── C1 čte své fáze a progresi ──`,
);

const query = mode === 'live'
  ? `select
      (select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('custom_plan_phases', 'custom_plan_exercise_progressions'))::int as tables,
      (select count(*) from information_schema.columns where table_schema = 'public' and ((table_name = 'custom_plans' and column_name = 'duration_weeks') or (table_name = 'custom_plan_days' and column_name = 'phase_id')))::int as cols,
      (select relrowsecurity from pg_class where oid = 'public.custom_plan_phases'::regclass) and (select relrowsecurity from pg_class where oid = 'public.custom_plan_exercise_progressions'::regclass) as rls,
      (select count(*) from pg_trigger where tgname = 'custom_plan_days_phase_guard')::int as trg,
      (select prosrc like '%custom_plan_exercise_progressions%' from pg_proc where proname = 'trainer_assign_plan' and pronamespace = 'public'::regnamespace) as assign_copies;`
  : `begin;\n${migration}\n${migration}\n${scenarioWithCopyEx}\nselect json_object_agg(k, v) as r from _tp;\nrollback;`;

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
  expect('tables', row?.tables === 2);
  expect('cols', row?.cols === 2);
  expect('rls', row?.rls === true);
  expect('trg', row?.trg === 1);
  expect('assign_copies', row?.assign_copies === true);
} else {
  const r = row?.r ?? {};
  const err = (k, msg) => String(r[k]).startsWith('ERR:') && String(r[k]).includes(msg);
  expect('asg_weeks', r.asg_weeks === '8');
  expect('copy_duration', r.copy_duration === '8');
  expect('copy_phases', r.copy_phases === '2');
  expect('copy_days_mapped', r.copy_days_mapped === '2');
  expect('copy_progression', r.copy_progression === '5:4');
  expect('t1_edit_progression', r.t1_edit_progression === '1');
  expect('phase_guard', err('phase_guard', 'phase_not_in_plan'));
  expect('c1_phases', r.c1_phases === '2');
  expect('c1_progression', r.c1_progression === '5');
  expect('t2_phases', r.t2_phases === '0');
  expect('t2_progressions', r.t2_progressions === '0');
  expect('t2_insert_progression', err('t2_insert_progression', 'row-level security'));
  expect('t2_tpl_private', r.t2_tpl_private === '0');
  expect('t2_tpl_public', r.t2_tpl_public === '2');
  expect('anon_public', r.anon_public === '1');
  expect('anon_private', r.anon_private === '0');
  expect('anon_write', err('anon_write', 'permission denied') || err('anon_write', 'row-level security'));
  expect('t1_after_end', r.t1_after_end === '0');
}
if (failures.length) { console.error('migration probe FAILED:', failures.join(', ')); process.exit(1); }
console.log(`TRAINER_PHASES_MIGRATION_OK mode=${mode}`);
