// POSTs to live log-qr; checks scan still works, lead row, dedupe, bad email, honeypot; cleans up its own rows.
// Prints LEAD_ENDPOINT_OK only when all pass.
import { readFileSync } from "node:fs"; import { homedir } from "node:os";
const PAT = readFileSync(`${homedir()}/.supabase-pat`, "utf8").trim();
const FN = "https://udqwjqgdsjobdufdxbpn.supabase.co/functions/v1/log-qr";
const q = async (query) => (await fetch("https://api.supabase.com/v1/projects/udqwjqgdsjobdufdxbpn/database/query", { method: "POST", headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" }, body: JSON.stringify({ query }) })).json();
const post = async (b) => { const r = await fetch(FN, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const fail = (m) => { throw new Error(m); };
const T0 = new Date().toISOString();
const E = `qa+lead-${Date.now()}@pumplo.com`;
const base = { action: "lead", sourceType: "station", code: "fk797g7Z", platform: "ios", lang: "cs", website: "" };
let ipHash = null;
try {
  let r = await post({ action: "scan", sourceType: "station", code: "fk797g7Z", platform: "ios" }); if (!r.j.scanId) fail("scan broke " + JSON.stringify(r));
  r = await post({ ...base, email: "  " + E.toUpperCase() + " " }); if (r.s !== 200 || !r.j.ok) fail("lead post " + JSON.stringify(r));
  r = await post({ ...base, email: E }); if (r.s !== 200) fail("dup post");
  const rows = await q(`select gym_id, machine_id, consent_text_version, ip_hash, email from qr_leads where email_normalized='${E}'`);
  if (rows.length !== 1) fail("expected 1 row, got " + JSON.stringify(rows));
  ipHash = rows[0].ip_hash;
  if (rows[0].email !== E) fail("not normalized: " + rows[0].email);
  if (!rows[0].gym_id || !rows[0].machine_id) fail("gym/machine not resolved");
  if (rows[0].consent_text_version !== "qr-lead-2026-10-05") fail("consent version");
  r = await post({ ...base, email: "nope" }); if (r.s !== 400) fail("bad email not rejected: " + r.s);
  const bot = `qa+bot-${Date.now()}@pumplo.com`;
  r = await post({ ...base, email: bot, website: "x" }); if (!r.j.ok) fail("bot not fake-ok");
  if ((await q(`select 1 from qr_leads where email_normalized='${bot}'`)).length) fail("bot row stored");
  r = await post({ action: "lead_prompt_shown", sourceType: "station", code: "fk797g7Z", platform: "ios" }); if (!r.j.ok) fail("prompt_shown");
  const ev = await q(`select event_type from qr_events where code='fk797g7Z' and created_at >= '${T0}' and ip_hash='${ipHash}'`);
  const types = new Set(ev.map((e) => e.event_type));
  for (const t of ["scan", "lead_submitted", "lead_prompt_shown"]) if (!types.has(t)) fail("event missing " + t);
  console.log("LEAD_ENDPOINT_OK");
} catch (e) {
  console.error("FAIL:", e.message);
  process.exitCode = 1;
} finally {
  await q(`delete from qr_leads where email_normalized like 'qa+%@pumplo.com'`);
  if (ipHash) await q(`delete from qr_events where code='fk797g7Z' and created_at >= '${T0}' and ip_hash='${ipHash}'`);
}
