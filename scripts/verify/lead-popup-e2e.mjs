// Browser E2E of the machine-page e-mail prompt. log-qr and Supabase auth are intercepted:
// nothing is written to production. Usage: node scripts/verify/lead-popup-e2e.mjs [baseUrl].
// Without baseUrl it serves the local build (dist/, run `npm run build` first) on port 4188.
// Prints LEAD_POPUP_E2E_OK.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
const require = createRequire("/Users/davidnovotny/pumplo-web/package.json");
const puppeteer = require("puppeteer-core");
let preview = null;
if (!process.argv[2]) {
  preview = spawn("npx", ["vite", "preview", "--port", "4188", "--strictPort"], { stdio: "ignore", detached: true });
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch("http://localhost:4188/")).ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
}
const stopPreview = () => { if (preview) try { process.kill(-preview.pid); } catch {} };
const BASE = process.argv[2] || "http://localhost:4188";
const SKIP = (posts) => posts.filter((b) => b.action === "lead_prompt_skipped");
// A session the supabase client accepts locally (expires far in the future).
const FAKE_SESSION = JSON.stringify({ access_token: "e2e", token_type: "bearer", expires_in: 3600, expires_at: 4102444800, refresh_token: "e2e",
  user: { id: "00000000-0000-0000-0000-0000000000e2", aud: "authenticated", role: "authenticated", email: "e2e@pumplo.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } });
const CODE = "fk797g7Z";
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = (m) => { throw new Error(m); };
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });

async function open({ leadStatus = 200, viewport = { width: 390, height: 844 }, ctx, native = false, loggedIn = false } = {}) {
  ctx = ctx || await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setUserAgent(UA);
  if (native) await page.evaluateOnNewDocument(() => { window.CapacitorCustomPlatform = { name: "android", plugins: {} }; });
  if (loggedIn) await page.evaluateOnNewDocument((s) => { localStorage.setItem("sb-auth-auth-token", s); }, FAKE_SESSION);
  await page.setViewport({ ...viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const posts = [];
  await page.setRequestInterception(true);
  page.on("request", (r) => {
    if (r.url().includes("/functions/v1/log-qr")) {
      if (r.method() === "OPTIONS") return r.respond({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" } });
      let body = {}; try { body = JSON.parse(r.postData() || "{}"); } catch {}
      posts.push(body);
      const h = { "access-control-allow-origin": "*", "content-type": "application/json" };
      if (body.action === "scan") return r.respond({ status: 200, headers: h, body: JSON.stringify({ scanId: "00000000-0000-0000-0000-000000000000", appStoreUrl: "", playStoreUrl: "" }) });
      if (body.action === "lead") return r.respond({ status: leadStatus, headers: h, body: JSON.stringify(leadStatus === 200 ? { ok: true } : { error: "x" }) });
      return r.respond({ status: 200, headers: h, body: '{"ok":true}' });
    }
    if (r.url().includes("/auth/v1/")) {
      const h = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "content-type": "application/json" };
      if (r.method() === "OPTIONS") return r.respond({ status: 204, headers: h });
      return r.respond({ status: 200, headers: h, body: JSON.stringify(JSON.parse(FAKE_SESSION).user) });
    }
    // Reads of public station data go out as anon (the fake session JWT would get a 401).
    const hdr = r.headers();
    if (r.url().includes("/rest/v1/") && hdr.apikey && hdr.authorization === "Bearer e2e") return r.continue({ headers: { ...hdr, authorization: `Bearer ${hdr.apikey}` } });
    r.continue();
  });
  await page.goto(`${BASE}/s/${CODE}`, { waitUntil: "networkidle2" });
  return { ctx, page, posts };
}
const popup = (p) => p.evaluate(() => { const e = document.querySelector("[data-lead-popup]"); return e ? { phase: e.getAttribute("data-lead-popup"), r: e.getBoundingClientRect().toJSON(), bottom: e.style.bottom } : null; });
const has = (p, s) => p.evaluate((s) => !!document.querySelector(s), s);

try {
  // 1-3: appears right away (≤ 2 s), dimmed, aligned with title, shown event
  let { ctx, page, posts } = await open();
  await wait(2000);
  const pp = await popup(page); if (!pp) fail("no popup within 2 s");
  if (!(await has(page, "[data-lead-dim]"))) fail("no dim");
  const titleTop = await page.evaluate(() => document.querySelector("[data-station-title]")?.getBoundingClientRect().top);
  if (titleTop == null) fail("no title in DOM");
  if (Math.abs(pp.r.top - (titleTop - 6)) > 12) fail(`not aligned: popup ${pp.r.top} title ${titleTop}`);
  if (!posts.some((b) => b.action === "lead_prompt_shown")) fail("no lead_prompt_shown");
  // tap on the dimmed area (e.g. where the next-exercise arrow is) must NOT close it
  await page.mouse.click(360, 420); await wait(300);
  if (!(await popup(page))) fail("tap on dim closed the popup");
  // 4: close → gone, dismissed event, not again after reload
  await page.click("[data-lead-close]"); await wait(300);
  if (await popup(page)) fail("popup still there after close");
  if (!posts.some((b) => b.action === "lead_prompt_dismissed")) fail("no dismissed event");
  if (!posts.some((b) => b.action === "scan" && !("native" in b))) fail("web scan carries a native flag");
  if (SKIP(posts).length) fail("skip logged although the popup was shown");
  await page.reload({ waitUntil: "networkidle2" }); await wait(2500);
  if (await popup(page)) fail("popup back after dismiss");
  if (!SKIP(posts).some((b) => b.reason === "dismissed_recently")) fail("no skip dismissed_recently: " + JSON.stringify(SKIP(posts)));
  // dismiss cookie (shared with pumplo.com) alone blocks too
  await page.evaluate(() => localStorage.removeItem("pumplo_lead_prompt"));
  if (!(await page.evaluate(() => document.cookie.includes("pumplo_lead_dismissed=1")))) fail("no dismiss cookie");
  await page.reload({ waitUntil: "networkidle2" }); await wait(2500);
  if (await popup(page)) fail("popup back with dismiss cookie only");
  await ctx.close();

  // 5: bad email message, then valid submit → thanks → gone within 3.6 s
  ({ ctx, page, posts } = await open());
  await wait(2500);
  await page.type("input[type=email]", "nope"); await page.click("[data-lead-submit]"); await wait(300);
  if (!(await has(page, "[data-lead-message]"))) fail("no bad email message");
  await page.$eval("input[type=email]", (el) => el.select()); await page.type("input[type=email]", "qa@pumplo.com");
  await page.click("[data-lead-submit]"); await wait(400);
  const lead = posts.find((b) => b.action === "lead");
  if (!lead || lead.email !== "qa@pumplo.com" || lead.website !== "" || !["cs", "en"].includes(lead.lang)) fail("bad lead post " + JSON.stringify(lead));
  if ((await popup(page))?.phase !== "thanks") fail("no thanks phase");
  if (await has(page, "[data-lead-dim]")) fail("dim still on after submit");
  await wait(3300);
  if (await popup(page)) fail("popup not gone 3.6 s after submit");
  // 6: cookie alone blocks (localStorage cleared)
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle2" }); await wait(2500);
  if (await popup(page)) fail("popup back after submit (cookie should block)");
  if (!SKIP(posts).some((b) => b.reason === "already_submitted")) fail("no skip already_submitted");
  await ctx.close();

  // 9: logged-in member → no popup, skip logged_in
  ({ ctx, page, posts } = await open({ loggedIn: true }));
  await wait(2500);
  if (await popup(page)) fail("popup shown to a logged-in member");
  const li = SKIP(posts); if (li.length !== 1 || li[0].reason !== "logged_in" || li[0].scanId !== "00000000-0000-0000-0000-000000000000") fail("bad logged_in skip " + JSON.stringify(li));
  await ctx.close();

  // 10: inside the native app → no popup, skip native_app, scan marked native
  ({ ctx, page, posts } = await open({ native: true }));
  await wait(2500);
  if (await popup(page)) fail("popup shown in the native app");
  const nv = SKIP(posts); if (nv.length !== 1 || nv[0].reason !== "native_app" || nv[0].platform !== "android") fail("bad native skip " + JSON.stringify(nv));
  const ns = posts.find((b) => b.action === "scan"); if (!ns || ns.native !== true || ns.platform !== "android") fail("native scan not marked " + JSON.stringify(ns));
  await ctx.close();

  // 7: server error → message, popup stays, button enabled
  ({ ctx, page, posts } = await open({ leadStatus: 500 }));
  await wait(2500);
  await page.type("input[type=email]", "qa@pumplo.com"); await page.click("[data-lead-submit]"); await wait(500);
  if (!(await has(page, "[data-lead-message]"))) fail("no error message on 500");
  if ((await popup(page))?.phase !== "form") fail("popup left form on error");
  if (await page.$eval("[data-lead-submit]", (b) => b.disabled)) fail("submit disabled after error");
  await ctx.close();

  // 3b: short viewport (keyboard) → popup bottom inside viewport
  ({ ctx, page, posts } = await open({ viewport: { width: 390, height: 500 } }));
  await wait(2500);
  const sp = await popup(page); if (!sp) fail("no popup on short viewport");
  if (sp.r.bottom > 500) fail("popup below viewport: " + sp.r.bottom);
  await ctx.close();

  // 8: title missing → fallback bottom 176px
  ({ ctx, page, posts } = await open());
  await page.evaluate(() => document.querySelector("[data-station-title]")?.removeAttribute("data-station-title"));
  await wait(2500);
  const fp = await popup(page); if (!fp || fp.bottom !== "176px") fail("fallback position wrong " + JSON.stringify(fp));
  await ctx.close();

  console.log("LEAD_POPUP_E2E_OK");
} catch (e) { console.error("FAIL:", e.message); process.exitCode = 1; }
finally { await browser.close(); stopPreview(); }
