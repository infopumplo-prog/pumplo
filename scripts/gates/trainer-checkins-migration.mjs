// Ověří migraci check-inů, fotek a vah (20261030) proti produkční DB.
// mode=dry  → BEGIN; migrace 2×; syntetičtí uživatelé; scénáře RLS/RPC/storage; ROLLBACK
// mode=live → jen čtecí kontroly po nasazení
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

const mode = process.argv[2] ?? 'dry';
const pat = readFileSync(`${homedir()}/.supabase-pat`, 'utf8').trim();
const migration = readFileSync(new URL('../../supabase/migrations/20261030_trainer_checkins_weights.sql', import.meta.url), 'utf8');

const T1 = 'deadbeef-7a20-4000-8000-000000000001';
const T2 = 'deadbeef-7a20-4000-8000-000000000002';
const C1 = 'deadbeef-7a20-4000-8000-000000000003';
const C2 = 'deadbeef-7a20-4000-8000-000000000004';
const FORM = 'deadbeef-7a20-4000-8000-0000000000f1';
const CK = 'deadbeef-7a20-4000-8000-0000000000c1';

const as = (uid) => `reset role; select set_config('request.jwt.claims', json_build_object('sub', '${uid}', 'role', 'authenticated')::text, true); set local role authenticated;`;
const asAdmin = `reset role; select set_config('request.jwt.claims', '', true);`;
const tryBlock = (key, body) => `do $$ begin ${body} insert into _tp values ('${key}', 'OK'); exception when others then insert into _tp values ('${key}', 'ERR:' || sqlerrm); end $$;`;
const put = (key, sql) => `insert into _tp select '${key}', (${sql})::text;`;
const putMod = (key, dml) => `with u as (${dml}) insert into _tp select '${key}', count(*)::text from u;`;

const users = [T1, T2, C1, C2].map((id, i) =>
  `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
   values ('${id}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tck-probe-${i}@example.test', '', now(), now(), '{}'::jsonb, '{}'::jsonb);`).join('\n');
const MONDAY = `(date_trunc('week', (now() at time zone 'Europe/Prague'))::date)`;
const PHOTO = `'${C1}/${CK}/front-1.jpg'`;

const scenario = `
create temp table _tp (k text primary key, v text) on commit drop;
grant insert, select on _tp to authenticated, anon;
create temp table _tok (k text primary key, v uuid) on commit drop;
grant insert, select on _tok to authenticated, anon;

${users}
insert into user_roles (user_id, role) values ('${T1}', 'trainer'), ('${T2}', 'trainer');
insert into trainer_access (user_id, tier) values ('${T1}', 'paid'), ('${T2}', 'paid');

-- ── T1: formulář, pozvánka, C1 přijme, T1 nastaví check-in ──
${as(T1)}
insert into trainer_checkin_forms (id, trainer_user_id, name, fields) values ('${FORM}', '${T1}', 'Týdenní check-in',
  '[{"id":"weight","type":"weight","label":"Váha"},{"id":"waist","type":"number","label":"Obvod pasu","unit":"cm"},{"id":"front","type":"photos","label":"Fotka zepředu"}]');
insert into _tok select 'inv', invite_token from trainer_invite_client(null);
${as(C1)}
select trainer_accept_invite((select v from _tok where k = 'inv'));
${as(T1)}
insert into _tok select 'link', id from trainer_clients where client_user_id = '${C1}';
${tryBlock('t1_set_checkin', `perform trainer_set_checkin((select v from _tok where k = 'link'), '${FORM}', 7::smallint);`)}
${as(T2)}
${tryBlock('t2_set_checkin', `perform trainer_set_checkin((select v from _tok where k = 'link'), '${FORM}', 1::smallint);`)}
${put('t2_sees_form', `select count(*) from trainer_checkin_forms where id = '${FORM}'`)}

-- ── C1 vidí formulář přes my_trainers, vyplní check-in + fotku + váhy ──
${as(C1)}
${put('c1_my_trainers', `select checkin_form_id::text || '|' || checkin_weekday || '|' || client_shares_weight from my_trainers()`)}
${put('c1_sees_form', `select count(*) from trainer_checkin_forms where id = '${FORM}'`)}
insert into trainer_checkins (id, trainer_client_id, trainer_user_id, client_user_id, form_id, form_snapshot, week_start, answers, weight_kg)
  select '${CK}', (select v from _tok where k = 'link'), '${T1}', '${C1}', '${FORM}', f.fields, ${MONDAY}, '{"waist": 82}', 81.4
  from trainer_checkin_forms f where f.id = '${FORM}';
${tryBlock('c1_photo_row', `insert into trainer_checkin_photos (checkin_id, field_id, storage_path) values ('${CK}', 'front', ${PHOTO});`)}
${tryBlock('c1_photo_foreign_path', `insert into trainer_checkin_photos (checkin_id, field_id, storage_path) values ('${CK}', 'front', '${C2}/${CK}/x.jpg');`)}
${tryBlock('c1_storage_insert', `insert into storage.objects (bucket_id, name, owner) values ('checkin-photos', ${PHOTO}, '${C1}');`)}
${tryBlock('c1_storage_foreign', `insert into storage.objects (bucket_id, name, owner) values ('checkin-photos', '${C2}/evil.jpg', '${C1}');`)}
insert into body_weight_entries (user_id, measured_at, weight_kg, source, external_id) values
  ('${C1}', now() - interval '2 days', 81.9, 'apple_health', 'hk-1'), ('${C1}', now() - interval '1 day', 81.6, 'apple_health', 'hk-2');
${tryBlock('c1_weight_dup', `insert into body_weight_entries (user_id, measured_at, weight_kg, source, external_id) values ('${C1}', now(), 81.0, 'apple_health', 'hk-1');`)}
${tryBlock('c1_set_trainer_note', `update trainer_checkins set trainer_note = 'hack' where id = '${CK}';`)}
${tryBlock('c1_dup_week', `insert into trainer_checkins (trainer_client_id, trainer_user_id, client_user_id, week_start) values ((select v from _tok where k = 'link'), '${T1}', '${C1}', ${MONDAY});`)}
${tryBlock('c1_wrong_trainer', `insert into trainer_checkins (trainer_client_id, trainer_user_id, client_user_id, week_start) values ((select v from _tok where k = 'link'), '${T2}', '${C1}', ${MONDAY} - 7);`)}

-- ── T1: vidí check-in a fotku, váhy až po souhlasu, odpovědi měnit nesmí ──
${as(T1)}
${put('t1_sees_checkin', `select count(*) from trainer_checkins where id = '${CK}' and (answers->>'waist')::int = 82`)}
${put('t1_sees_photo_row', `select count(*) from trainer_checkin_photos where checkin_id = '${CK}'`)}
${put('t1_sees_storage', `select count(*) from storage.objects where bucket_id = 'checkin-photos' and name = ${PHOTO}`)}
${put('t1_weights_no_consent', `select count(*) from body_weight_entries where user_id = '${C1}'`)}
${putMod('t1_note', `update trainer_checkins set trainer_note = 'Super týden', trainer_seen_at = now() where id = '${CK}' returning 1`)}
${tryBlock('t1_edit_answers', `update trainer_checkins set answers = '{"waist": 70}' where id = '${CK}';`)}
${as(C1)}
select set_weight_sharing((select v from _tok where k = 'link'), true);
${as(T1)}
${put('t1_weights_consent', `select count(*) from body_weight_entries where user_id = '${C1}'`)}
${tryBlock('t1_write_weight', `insert into body_weight_entries (user_id, measured_at, weight_kg) values ('${C1}', now(), 50);`)}

-- ── T2 (cizí trenér) nevidí nic ──
${as(T2)}
${put('t2_checkins', `select count(*) from trainer_checkins`)}
${put('t2_photos', `select count(*) from trainer_checkin_photos`)}
${put('t2_storage', `select count(*) from storage.objects where bucket_id = 'checkin-photos'`)}
${put('t2_weights', `select count(*) from body_weight_entries where user_id = '${C1}'`)}

-- ── C2 (cizí klient) nevidí nic ──
${as(C2)}
${put('c2_checkins', `select count(*) from trainer_checkins`)}
${put('c2_storage', `select count(*) from storage.objects where bucket_id = 'checkin-photos'`)}

-- ── konec spolupráce → trenér ztratí přístup ──
${as(C1)}
select trainer_end_client((select v from _tok where k = 'link'));
${as(T1)}
${put('t1_after_end_checkins', `select count(*) from trainer_checkins`)}
${put('t1_after_end_storage', `select count(*) from storage.objects where bucket_id = 'checkin-photos'`)}
${put('t1_after_end_weights', `select count(*) from body_weight_entries where user_id = '${C1}'`)}
${as(C1)}
${put('c1_keeps_checkin', `select count(*) from trainer_checkins where id = '${CK}'`)}
${asAdmin}
${put('bucket_private', `select (not public)::text from storage.buckets where id = 'checkin-photos'`)}
reset role;
`;

const query = mode === 'live'
  ? `select
      (select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('trainer_checkin_forms', 'trainer_checkins', 'trainer_checkin_photos', 'body_weight_entries'))::int as tables,
      (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'trainer_clients' and column_name in ('checkin_form_id', 'checkin_weekday', 'client_shares_weight'))::int as cols,
      (select count(*) from pg_class where relname in ('trainer_checkin_forms', 'trainer_checkins', 'trainer_checkin_photos', 'body_weight_entries') and relrowsecurity)::int as rls,
      (select not public from storage.buckets where id = 'checkin-photos') as bucket_private,
      (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'checkin photos%')::int as storage_policies;`
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
  expect('cols', row?.cols === 3);
  expect('rls', row?.rls === 4);
  expect('bucket_private', row?.bucket_private === true);
  expect('storage_policies', row?.storage_policies === 4);
} else {
  const r = row?.r ?? {};
  const err = (k, msg) => String(r[k]).startsWith('ERR:') && String(r[k]).includes(msg);
  const denied = (k) => err(k, 'row-level security') || err(k, 'permission denied');
  expect('t1_set_checkin', r.t1_set_checkin === 'OK');
  expect('t2_set_checkin', err('t2_set_checkin', 'form_not_found') || err('t2_set_checkin', 'client_not_active'));
  expect('t2_sees_form', r.t2_sees_form === '0');
  expect('c1_my_trainers', r.c1_my_trainers === `${FORM}|7|false`);
  expect('c1_sees_form', r.c1_sees_form === '1');
  expect('c1_photo_row', r.c1_photo_row === 'OK');
  expect('c1_photo_foreign_path', denied('c1_photo_foreign_path'));
  expect('c1_storage_insert', r.c1_storage_insert === 'OK');
  expect('c1_storage_foreign', denied('c1_storage_foreign'));
  expect('c1_weight_dup', err('c1_weight_dup', 'duplicate key'));
  expect('c1_set_trainer_note', err('c1_set_trainer_note', 'checkin_trainer_fields_locked'));
  expect('c1_dup_week', err('c1_dup_week', 'duplicate key'));
  expect('c1_wrong_trainer', denied('c1_wrong_trainer'));
  expect('t1_sees_checkin', r.t1_sees_checkin === '1');
  expect('t1_sees_photo_row', r.t1_sees_photo_row === '1');
  expect('t1_sees_storage', r.t1_sees_storage === '1');
  expect('t1_weights_no_consent', r.t1_weights_no_consent === '0');
  expect('t1_note', r.t1_note === '1');
  expect('t1_edit_answers', err('t1_edit_answers', 'checkin_answers_locked'));
  expect('t1_weights_consent', r.t1_weights_consent === '2');
  expect('t1_write_weight', denied('t1_write_weight'));
  expect('t2_checkins', r.t2_checkins === '0');
  expect('t2_photos', r.t2_photos === '0');
  expect('t2_storage', r.t2_storage === '0');
  expect('t2_weights', r.t2_weights === '0');
  expect('c2_checkins', r.c2_checkins === '0');
  expect('c2_storage', r.c2_storage === '0');
  expect('t1_after_end_checkins', r.t1_after_end_checkins === '0');
  expect('t1_after_end_storage', r.t1_after_end_storage === '0');
  expect('t1_after_end_weights', r.t1_after_end_weights === '0');
  expect('c1_keeps_checkin', r.c1_keeps_checkin === '1');
  expect('bucket_private', r.bucket_private === 'true');
}
if (failures.length) { console.error('migration probe FAILED:', failures.join(', ')); process.exit(1); }
console.log(`TRAINER_CHECKINS_MIGRATION_OK mode=${mode}`);
