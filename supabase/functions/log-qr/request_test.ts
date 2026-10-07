import { assertEquals } from "jsr:@std/assert";
import { ACTIONS, LEAD_SKIP_REASONS, isAction, isSourceType, skipReason, scanDetail } from "./request.ts";

Deno.test("actions: old ones kept, skip added", () => {
  for (const a of ["scan", "store_click", "lead_prompt_shown", "lead_prompt_dismissed", "lead", "lead_prompt_skipped"]) assertEquals(isAction(a), true, a);
  for (const a of ["lead_submitted", "first_open", "", null, 42]) assertEquals(isAction(a), false, String(a));
  assertEquals(ACTIONS.length, 6);
});
Deno.test("skip reason whitelist", () => {
  assertEquals([...LEAD_SKIP_REASONS], ["native_app", "logged_in", "already_submitted", "dismissed_recently"]);
  for (const r of LEAD_SKIP_REASONS) assertEquals(skipReason(r), r);
  for (const r of ["", "native", "NATIVE_APP", "logged_in ", "x".repeat(500), null, undefined, 1, {}]) assertEquals(skipReason(r), null, String(r));
});
Deno.test("scan detail: only literal true marks a native scan", () => {
  assertEquals(scanDetail(true), "native");
  for (const v of [undefined, false, "true", 1, null]) assertEquals(scanDetail(v), null, String(v));
});
Deno.test("flyer is a valid source for every action incl. lead (web popup, option b)", () => {
  assertEquals(isSourceType("flyer"), true);
  assertEquals(isSourceType("station"), true);
  assertEquals(isSourceType("web"), false);
});

import { flyerDestination, resolveTarget, type CodeLookup } from "./request.ts";
const fakeDb = (tables: Record<string, Record<string, Record<string, unknown>>>): CodeLookup & { calls: string[] } => {
  const calls: string[] = [];
  return {
    calls,
    from: (t) => ({ select: () => ({ eq: (col, v) => ({ maybeSingle: () => { calls.push(`${t}.${col}=${v}`); return Promise.resolve({ data: tables[t]?.[v] ?? null }); } }) }) }),
  };
};
Deno.test("flyer lead resolves gym from qr_codes, machine null", async () => {
  const db = fakeDb({ qr_codes: { eurogym: { gym_id: "g1" } } });
  assertEquals(await resolveTarget(db, "flyer", "eurogym"), { gymId: "g1", machineId: null });
  assertEquals(db.calls, ["qr_codes.code=eurogym"]);
});
Deno.test("unknown flyer code → null (404)", async () => {
  assertEquals(await resolveTarget(fakeDb({}), "flyer", "nope"), null);
});
Deno.test("station resolves gym+machine; unknown station still logged with nulls", async () => {
  const db = fakeDb({ gym_machines: { fk797g7Z: { id: "m1", gym_id: "g1" } } });
  assertEquals(await resolveTarget(db, "station", "fk797g7Z"), { gymId: "g1", machineId: "m1" });
  assertEquals(await resolveTarget(db, "station", "gone"), { gymId: null, machineId: null });
});
Deno.test("flyer destination carries UTM + scan id; old shape when no scan", () => {
  const withScan = new URL(flyerDestination("https://pumplo.com", "eurogym", "11111111-1111-1111-1111-111111111111"));
  assertEquals(withScan.searchParams.get("utm_medium"), "flyer");
  assertEquals(withScan.searchParams.get("utm_campaign"), "eurogym");
  assertEquals(withScan.searchParams.get("qr_scan"), "11111111-1111-1111-1111-111111111111");
  assertEquals(flyerDestination("https://pumplo.com", "eurogym", null), "https://pumplo.com/?utm_source=qr&utm_medium=flyer&utm_campaign=eurogym");
});
