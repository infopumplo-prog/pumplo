// Read-only check via Supabase Management API.
// Prints QR_LEADS_SCHEMA_OK only when table, RLS, unique index and event types exist.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
const PAT = readFileSync(`${homedir()}/.supabase-pat`, "utf8").trim();
const q = async (query) => {
  const r = await fetch("https://api.supabase.com/v1/projects/udqwjqgdsjobdufdxbpn/database/query", {
    method: "POST", headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return r.json();
};
const fail = (m) => { console.error("FAIL:", m); process.exit(1); };
const cols = await q("select column_name from information_schema.columns where table_schema='public' and table_name='qr_leads'");
const names = new Set((Array.isArray(cols) ? cols : []).map((c) => c.column_name));
for (const c of ["email", "email_normalized", "gym_id", "machine_id", "code", "scan_id", "consent_text", "consent_text_version", "consent_at", "ip_hash", "lang", "unsubscribed_at"])
  if (!names.has(c)) fail("missing column " + c);
const rls = await q("select relrowsecurity from pg_class where oid='public.qr_leads'::regclass");
if (!rls?.[0]?.relrowsecurity) fail("RLS off");
const pol = await q("select polname, polroles::regrole[]::text as roles from pg_policy where polrelid='public.qr_leads'::regclass");
if ((Array.isArray(pol) ? pol : []).some((p) => /anon|public/.test(p.roles))) fail("public/anon policy present");
const uq = await q("select indexdef from pg_indexes where tablename='qr_leads' and indexdef ilike '%unique%email_normalized%'");
if (!uq?.length) fail("no unique email_normalized index");
const ck = await q("select pg_get_constraintdef(oid) d from pg_constraint where conname='qr_events_event_type_check'");
for (const t of ["lead_prompt_shown", "lead_prompt_dismissed", "lead_submitted", "scan", "store_click", "first_open", "signup"])
  if (!String(ck?.[0]?.d).includes(t)) fail("event type missing " + t);
console.log("QR_LEADS_SCHEMA_OK");
