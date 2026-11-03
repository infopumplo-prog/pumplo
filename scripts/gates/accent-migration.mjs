// Ověří migraci user_profiles.accent_color. dry = v rollbacku (platná hodnota projde, neplatná ne), live = sloupec existuje.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

const mode = process.argv[2] ?? 'dry';
const pat = readFileSync(`${homedir()}/.supabase-pat`, 'utf8').trim();
const sql = readFileSync(new URL('../../supabase/migrations/20261008f_user_accent_color.sql', import.meta.url), 'utf8');
const probe = `select (select count(*) from information_schema.columns where table_name = 'user_profiles' and column_name = 'accent_color')::int as col,
  (select count(*) from pg_constraint where conname = 'user_profiles_accent_color_check')::int as chk`;
const scenario = `
create temp table _ac (k text primary key, v text) on commit drop;
update user_profiles set accent_color = 'pink' where user_id = (select user_id from user_profiles order by created_at limit 1);
insert into _ac select 'pink_saved', accent_color from user_profiles where user_id = (select user_id from user_profiles order by created_at limit 1);
do $$ begin
  update user_profiles set accent_color = 'rainbow' where user_id = (select user_id from user_profiles order by created_at limit 1);
  insert into _ac values ('invalid', 'ALLOWED');
exception when others then insert into _ac values ('invalid', 'BLOCKED');
end $$;`;
const query = mode === 'live' ? probe : `begin;\n${sql}\n${scenario}\nselect json_object_agg(k, v) as r from _ac;\nrollback;`;
const res = await fetch('https://api.supabase.com/v1/projects/udqwjqgdsjobdufdxbpn/database/query', {
  method: 'POST', headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }),
});
const body = await res.json();
if (!res.ok) { console.error('query failed', JSON.stringify(body)); process.exit(1); }
const row = body[0];
console.log(JSON.stringify(row));
const ok = mode === 'live' ? row.col === 1 && row.chk === 1 : row.r?.pink_saved === 'pink' && row.r?.invalid === 'BLOCKED';
if (!ok) { console.error('accent probe FAILED'); process.exit(1); }
console.log(`ACCENT_MIGRATION_OK mode=${mode}`);
