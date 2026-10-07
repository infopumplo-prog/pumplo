// Browser E2E: GA4 + Meta Pixel + TikTok Pixel on the QR machine page behind consent, cookie banner after the
// e-mail prompt. log-qr intercepted (no production writes); GA/Meta/TikTok hits observed and aborted.
// Prints SCAN_ANALYTICS_E2E_OK.
import { createRequire } from "node:module";
const require = createRequire("/Users/davidnovotny/pumplo-web/package.json");
const puppeteer = require("puppeteer-core");
const BASE = process.argv[2] || "http://localhost:4188";
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = (m) => { throw new Error(m); };
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const GA = /googletagmanager\.com|google-analytics\.com|analytics\.google\.com/;
const FB = /connect\.facebook\.net|facebook\.com\/tr/;
const TT = /analytics(-ipv6)?\.tiktok\.com/;
async function open() {
  const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(() => Object.defineProperty(navigator, "webdriver", { get: () => false }));
  const hits = [];
  await page.setRequestInterception(true);
  page.on("request", (r) => {
    const u = r.url();
    if (u.includes("/functions/v1/log-qr")) {
      const h = { "access-control-allow-origin": "*", "content-type": "application/json" };
      if (r.method() === "OPTIONS") return r.respond({ status: 204, headers: { ...h, "access-control-allow-headers": "*" } });
      return r.respond({ status: 200, headers: h, body: '{"ok":true,"scanId":"00000000-0000-0000-0000-000000000000","appStoreUrl":"","playStoreUrl":""}' });
    }
    if (GA.test(u) || FB.test(u) || TT.test(u)) { hits.push(u + " " + (r.postData() || "")); if (/gtag\/js|fbevents\.js|signals\/config/.test(u) || (TT.test(u) && /\.js(\?|$)/.test(u))) return r.continue(); return r.abort(); }
    if (/apps\.apple\.com|play\.google\.com/.test(u)) return r.abort();
    r.continue();
  });
  await page.goto(`${BASE}/s/fk797g7Z`, { waitUntil: "networkidle2" });
  return { ctx, page, hits };
}
const has = (p, s) => p.evaluate((s) => !!document.querySelector(s), s);
const click = (p, s) => p.evaluate((s) => document.querySelector(s)?.click(), s);
try {
  let { ctx, page, hits } = await open();
  await wait(2000);
  if (!(await has(page, "[data-lead-popup]"))) fail("lead popup missing");
  if (await has(page, "[data-cookie-banner]")) fail("cookie banner together with lead popup");
  await click(page, "[data-lead-close]"); await wait(500);
  if (!(await has(page, "[data-cookie-banner]"))) fail("cookie banner not shown after popup closed");
  if (hits.length) fail("tracker before consent: " + hits[0]);
  await click(page, "[data-cookie-reject]"); await wait(1500);
  await page.reload({ waitUntil: "networkidle2" }); await wait(2500);
  if (await has(page, "[data-cookie-banner]")) fail("banner back after reject");
  if (hits.length) fail("tracker after reject: " + hits[0]);
  await ctx.close();

  ({ ctx, page, hits } = await open());
  await wait(2000);
  await page.type("input[type=email]", "qa@pumplo.com"); await click(page, "[data-lead-submit]");
  await wait(800);
  if (await has(page, "[data-cookie-banner]")) fail("banner during thanks");
  await wait(3200);
  if (!(await has(page, "[data-cookie-banner]"))) fail("banner not shown after lead sent");
  if (hits.length) fail("tracker before consent (B): " + hits[0]);
  await click(page, "[data-cookie-accept]"); await wait(6000);
  if (!hits.some((u) => u.includes("gtag/js") && u.includes("G-HXXC0FX8SQ"))) fail("gtag.js not loaded");
  if (!hits.some((u) => /\/g\/collect/.test(u) && u.includes("en=generate_lead"))) fail("generate_lead not sent after consent");
  if (!hits.some((u) => u.includes("fbevents.js"))) fail("Pixel not loaded");
  if (!hits.some((u) => /facebook\.com\/tr/.test(u) && u.includes("id=1577216264451707") && u.includes("ev=PageView"))) fail("no Pixel PageView");
  if (!hits.some((u) => TT.test(u) && u.includes("events.js") && u.includes("sdkid=DB34H8JC77U534NEHGPG"))) fail("TikTok events.js not loaded");
  const ttEvents = (list) => list.filter((u) => TT.test(u) && /\/api\/v2\/pixel/.test(u));
  if (!ttEvents(hits).some((u) => u.includes("DB34H8JC77U534NEHGPG") && /"event":"Pageview"/.test(u))) fail("no TikTok Pageview");
  // pixel.js translates the legacy SubmitForm we send into its current "Lead" event name.
  if (!ttEvents(hits).some((u) => /"event":"(SubmitForm|Lead)"/.test(u) && u.includes("qr_station"))) fail("TikTok SubmitForm (lead after consent) not sent");
  const before = hits.length;
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /plán|plan/i.test(b.textContent || ""))?.click());
  await wait(6000);
  if (!hits.slice(before).some((u) => u.includes("en=click_store"))) fail("click_store not sent");
  const fbAfter = hits.slice(before).filter((u) => /facebook\.com\/tr/.test(u));
  if (!fbAfter.some((u) => u.includes("ev=ClickStore"))) fail("Pixel ClickStore not sent");
  if (fbAfter.some((u) => u.includes("ev=Lead"))) fail("store click still sent as Pixel Lead");
  if (!ttEvents(hits.slice(before)).some((u) => /"event":"Download"/.test(u))) fail("TikTok Download not sent");
  await ctx.close();
  console.log("SCAN_ANALYTICS_E2E_OK");
} catch (e) { console.error("FAIL:", e.message); process.exitCode = 1; }
finally { await browser.close(); }
