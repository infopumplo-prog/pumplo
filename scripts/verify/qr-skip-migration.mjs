// Applies supabase/migrations/20261007120000_qr_events_detail.sql to an in-memory Postgres
// (PGlite) holding qr_events exactly as in production on 2026-10-07 (columns + checks read
// via Management API). Never touches the production DB. Needs: npm i --no-save @electric-sql/pglite
// Prints QR_SKIP_MIGRATION_OK only when every assertion passes.
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const MIG = new URL("../../supabase/migrations/20261007120000_qr_events_detail.sql", import.meta.url);
const db = new PGlite();
const fail = (m) => { throw new Error(m); };
const ok = async (sql, label) => { try { await db.query(sql); } catch (e) { fail(`${label} rejected: ${e.message}`); } };
const bad = async (sql, label) => { let threw = false; try { await db.query(sql); } catch { threw = true; } if (!threw) fail(`${label} accepted`); };
const ins = (type, detail, scan = "NULL") =>
  `insert into public.qr_events (event_type, source_type, code, platform, detail, scan_id) values ('${type}', 'station', 'c', 'ios', ${detail === null ? "NULL" : `'${detail}'`}, ${scan})`;
try {
  await db.exec(`
    create table public.qr_events (
      id uuid primary key default gen_random_uuid(),
      event_type text not null, source_type text not null, code text not null,
      gym_id uuid, machine_id uuid, scan_id uuid references public.qr_events(id),
      platform text not null, ip_hash text, ua_hash text, created_at timestamptz not null default now(),
      constraint qr_events_event_type_check check (event_type = any (array['scan','store_click','first_open','signup','lead_prompt_shown','lead_prompt_dismissed','lead_submitted'])),
      constraint qr_events_platform_check check (platform = any (array['ios','android','other'])),
      constraint qr_events_source_type_check check (source_type = any (array['station','flyer'])));
    insert into public.qr_events (event_type, source_type, code, platform) values ('scan','station','old','ios'), ('lead_submitted','flyer','old','android');`);
  // control: before the migration the new event type is rejected
  await bad(`insert into public.qr_events (event_type, source_type, code, platform) values ('lead_prompt_skipped','station','c','ios')`, "skip before migration");
  const sql = readFileSync(MIG, "utf8");
  await db.exec(sql);
  await db.exec(sql); // idempotent re-run
  const old = await db.query(`select count(*)::int n from public.qr_events where detail is null`);
  if (old.rows[0].n !== 2) fail("existing rows changed");
  for (const r of ["native_app", "logged_in", "already_submitted", "dismissed_recently"]) await ok(ins("lead_prompt_skipped", r), `skip ${r}`);
  await ok(ins("scan", "native"), "native scan");
  await ok(ins("scan", null), "web scan (old clients)");
  for (const t of ["store_click", "first_open", "signup", "lead_prompt_shown", "lead_prompt_dismissed", "lead_submitted"]) await ok(ins(t, null), `old type ${t}`);
  await bad(ins("lead_prompt_skipped", null), "skip without reason");
  await bad(ins("lead_prompt_skipped", "native"), "skip with scan detail");
  await bad(ins("lead_prompt_skipped", "bogus"), "unknown reason");
  await bad(ins("scan", "native_app"), "scan with skip reason");
  await bad(ins("lead_prompt_shown", "native"), "detail on other event");
  await bad(ins("nonsense", null), "unknown event type");
  console.log("QR_SKIP_MIGRATION_OK");
} catch (e) { console.error("FAIL:", e.message); process.exitCode = 1; }
finally { await db.close(); }
