// POSTs to live log-qr; checks scan still works, lead row, dedupe, bad email, honeypot,
// lead_prompt_skipped reasons, native scan marker and a flyer lead; cleans up its own rows.
// RUN ONLY AFTER migration 20261007120000_qr_events_detail + new log-qr are deployed.
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
  await q(`update qr_leads set unsubscribed_at = now() where email_normalized='${E}'`);
  r = await post({ ...base, email: E }); if (r.s !== 200 || !r.j.ok) fail("post after unsubscribe");
  const unsub = await q(`select unsubscribed_at from qr_leads where email_normalized='${E}'`);
  if (!unsub[0]?.unsubscribed_at) fail("form re-subscribed an unsubscribed address");
  const E2 = `qa+race-${Date.now()}@pumplo.com`;
  const race = await Promise.all([1, 2, 3].map(() => post({ ...base, email: E2 })));
  if (race.some((x) => x.s !== 200 || !x.j.ok)) fail("parallel submit not ok: " + JSON.stringify(race));
  if ((await q(`select 1 from qr_leads where email_normalized='${E2}'`)).length !== 1) fail("race row count");
  r = await post({ ...base, email: `qa+uuid-${Date.now()}@pumplo.com`, scanId: "not-a-uuid" }); if (r.s !== 200 || !r.j.ok) fail("bad scanId broke submit: " + JSON.stringify(r));
  r = await post({ ...base, email: "nope" }); if (r.s !== 400) fail("bad email not rejected: " + r.s);
  const bot = `qa+bot-${Date.now()}@pumplo.com`;
  r = await post({ ...base, email: bot, website: "x" }); if (!r.j.ok) fail("bot not fake-ok");
  if ((await q(`select 1 from qr_leads where email_normalized='${bot}'`)).length) fail("bot row stored");
  r = await post({ action: "lead_prompt_shown", sourceType: "station", code: "fk797g7Z", platform: "ios" }); if (!r.j.ok) fail("prompt_shown");
  // skip reasons: whitelist enforced, one skip per scan
  const scanId = (await post({ action: "scan", sourceType: "station", code: "fk797g7Z", platform: "ios" })).j.scanId;
  r = await post({ action: "lead_prompt_skipped", sourceType: "station", code: "fk797g7Z", platform: "ios", scanId, reason: "logged_in" }); if (!r.j.ok) fail("skip " + JSON.stringify(r));
  r = await post({ action: "lead_prompt_skipped", sourceType: "station", code: "fk797g7Z", platform: "ios", scanId, reason: "logged_in" }); if (!r.j.ok) fail("skip repeat");
  r = await post({ action: "lead_prompt_skipped", sourceType: "station", code: "fk797g7Z", platform: "ios", reason: "bogus" }); if (r.s !== 400) fail("bad reason not rejected: " + r.s);
  const sk = await q(`select detail from qr_events where event_type='lead_prompt_skipped' and scan_id='${scanId}'`);
  if (sk.length !== 1 || sk[0].detail !== "logged_in") fail("skip rows " + JSON.stringify(sk));
  // native scan: marked, and not deduplicated against the web scan above
  r = await post({ action: "scan", sourceType: "station", code: "fk797g7Z", platform: "android", native: true });
  if (!r.j.scanId || r.j.scanId === scanId) fail("native scan deduped into web scan");
  const nat = await q(`select detail, platform from qr_events where id='${r.j.scanId}'`);
  if (nat[0]?.detail !== "native" || nat[0]?.platform !== "android") fail("native scan row " + JSON.stringify(nat));
  // flyer lead (pumplo.com prompt): gym from the flyer code, no machine
  const EF = `qa+flyer-${Date.now()}@pumplo.com`;
  r = await post({ ...base, sourceType: "flyer", code: "eurogym", email: EF }); if (!r.j.ok) fail("flyer lead " + JSON.stringify(r));
  const fl = await q(`select gym_id, machine_id, source_type from qr_leads where email_normalized='${EF}'`);
  if (fl.length !== 1 || !fl[0].gym_id || fl[0].machine_id !== null || fl[0].source_type !== "flyer") fail("flyer lead row " + JSON.stringify(fl));
  r = await post({ ...base, sourceType: "flyer", code: "no-such-flyer", email: EF }); if (r.s !== 404) fail("unknown flyer not 404: " + r.s);
  // flyer QR redirect hands the scan id to pumplo.com for its prompt
  const go = await fetch(`${FN}?go=1&code=eurogym`, { redirect: "manual" });
  const loc = new URL(go.headers.get("location") || "https://x");
  if (go.status !== 302 || loc.hostname !== "pumplo.com" || loc.searchParams.get("utm_campaign") !== "eurogym" || !/^[0-9a-f-]{36}$/.test(loc.searchParams.get("qr_scan") || "")) fail("flyer redirect " + go.status + " " + loc);
  const ev = await q(`select event_type from qr_events where created_at >= '${T0}' and ip_hash='${ipHash}'`);
  const types = new Set(ev.map((e) => e.event_type));
  for (const t of ["scan", "lead_submitted", "lead_prompt_shown", "lead_prompt_skipped"]) if (!types.has(t)) fail("event missing " + t);
  console.log("LEAD_ENDPOINT_OK");
} catch (e) {
  console.error("FAIL:", e.message);
  process.exitCode = 1;
} finally {
  await q(`delete from qr_leads where email_normalized like 'qa+%@pumplo.com'`);
  // children (scan_id FK) first, then scans
  if (ipHash) {
    await q(`delete from qr_events where scan_id is not null and created_at >= '${T0}' and ip_hash='${ipHash}' and code in ('fk797g7Z','eurogym')`);
    await q(`delete from qr_events where created_at >= '${T0}' and ip_hash='${ipHash}' and code in ('fk797g7Z','eurogym')`);
  }
}
