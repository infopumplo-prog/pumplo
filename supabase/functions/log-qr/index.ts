import { createClient } from "npm:@supabase/supabase-js@2";
import { CONSENT_TEXT_VERSION, LEAD_RATE_LIMIT_PER_HOUR, consentTextFor, isBot, isValidEmail, normalizeEmail, toLang } from "./lead.ts";
import { type CodeLookup, flyerDestination, isAction, isSourceType, resolveTarget, scanDetail, skipReason } from "./request.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_STORE_URL = "https://apps.apple.com/app/pumplo/id6768619318";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.pumplo.app";

// Scans from the same phone within this window count as one (page refreshes,
// double scans) — the funnel should count people, not page loads.
const DEDUP_WINDOW_MIN = 10;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const sha256 = async (input: string): Promise<string> => {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Where a flyer QR sends its reader. Printed flyers point at
// app.pumplo.com/go/<code>, which Vercel 302s here; this function logs the scan
// and forwards to the marketing site. Going through here (rather than
// redirecting straight to the site) is what keeps the visitor's real IP and
// user-agent visible — dedup and attribution are built on them.
const WEB_URL = "https://pumplo.com";

// The redirect must never wait on analytics. If logging is slow, forward anyway.
const LOG_TIMEOUT_MS = 1500;

const platformFromUa = (ua: string): string => {
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
};

const redirect = (location: string) =>
  new Response(null, {
    status: 302,
    headers: { Location: location, "Cache-Control": "no-store" },
  });

/** Logs one flyer scan, skipping a repeat from the same IP (see DEDUP_WINDOW_MIN).
 *  Returns the scan id (new or the deduplicated one) so the website can pair a lead with it. */
const logFlyerScan = async (
  code: string,
  ipHash: string | null,
  uaHash: string | null,
  plat: string,
): Promise<string | null> => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: qr } = await supabase.from("qr_codes").select("gym_id").eq("code", code).maybeSingle();
  if (!qr) return null; // Unknown flyer code — forward the reader, log nothing.

  if (ipHash) {
    const since = new Date(Date.now() - DEDUP_WINDOW_MIN * 60_000).toISOString();
    const { data: dup } = await supabase
      .from("qr_events")
      .select("id")
      .eq("event_type", "scan").eq("code", code).eq("ip_hash", ipHash)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1);
    if (dup && dup.length > 0) return dup[0].id;
  }

  const { data } = await supabase.from("qr_events").insert({
    event_type: "scan", source_type: "flyer", code, gym_id: qr.gym_id,
    machine_id: null, platform: plat, ip_hash: ipHash, ua_hash: uaHash,
  }).select("id").single();
  return data?.id ?? null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // GET ?go=1&code=<code> — the flyer QR entry point: log the scan, then send
  // the reader to the website. Analytics failures must not cost us the visitor,
  // so every error path still redirects.
  if (req.method === "GET") {
    const url = new URL(req.url);
    const code = url.searchParams.get("code") ?? "";
    let scanId: string | null = null;

    if (code && code.length <= 64) {
      try {
        const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
        const ua = req.headers.get("user-agent") ?? "";
        scanId = await Promise.race([
          logFlyerScan(
            code,
            ip ? await sha256(`pumplo-qr|${ip}`) : null,
            ua ? await sha256(`pumplo-qr|${ua}`) : null,
            platformFromUa(ua),
          ),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), LOG_TIMEOUT_MS)),
        ]);
      } catch { /* tracking never costs us a flyer reader */ }
    }

    // The website's e-mail prompt pairs its lead with the scan (qr_scan, an opaque id).
    return redirect(flyerDestination(WEB_URL, code, scanId));
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { action, sourceType, code, scanId, platform } = body;
    if (!isAction(action)) return json({ error: "bad action" }, 400);
    if (!isSourceType(sourceType)) return json({ error: "bad sourceType" }, 400);
    const reason = action === "lead_prompt_skipped" ? skipReason(body.reason) : null;
    if (action === "lead_prompt_skipped" && !reason) return json({ error: "bad reason" }, 400);
    if (typeof code !== "string" || !code || code.length > 64) return json({ error: "bad code" }, 400);
    const plat = ["ios", "android"].includes(platform) ? platform : "other";

    // Resolve the gym (and machine for stations) from the scanned code.
    const target = await resolveTarget(supabase as unknown as CodeLookup, sourceType, code);
    if (!target) return json({ error: "unknown code" }, 404);
    const { gymId, machineId } = target;

    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
    const ua = req.headers.get("user-agent") ?? "";
    const ipHash = ip ? await sha256(`pumplo-qr|${ip}`) : null;
    const uaHash = ua ? await sha256(`pumplo-qr|${ua}`) : null;

    if (action === "scan") {
      // Scans from inside the Pumplo app are marked (detail 'native') and dedup only
      // among themselves, so an app scan never hides behind a web scan on gym Wi-Fi.
      const detail = scanDetail(body.native);
      if (ipHash) {
        const since = new Date(Date.now() - DEDUP_WINDOW_MIN * 60_000).toISOString();
        const dupQuery = supabase
          .from("qr_events")
          .select("id")
          .eq("event_type", "scan").eq("code", code).eq("ip_hash", ipHash)
          .gte("created_at", since);
        const { data: dup } = await (detail ? dupQuery.eq("detail", detail) : dupQuery.is("detail", null))
          .order("created_at", { ascending: false })
          .limit(1);
        if (dup && dup.length > 0) {
          return json({ scanId: dup[0].id, appStoreUrl: APP_STORE_URL, playStoreUrl: playUrl(dup[0].id) });
        }
      }
      const { data, error } = await supabase
        .from("qr_events")
        .insert({ event_type: "scan", source_type: sourceType, code, gym_id: gymId, machine_id: machineId, platform: plat, ip_hash: ipHash, ua_hash: uaHash, detail })
        .select("id").single();
      if (error) return json({ error: error.message }, 500);
      return json({ scanId: data.id, appStoreUrl: APP_STORE_URL, playStoreUrl: playUrl(data.id) });
    }

    if (action === "lead_prompt_shown" || action === "lead_prompt_dismissed" || action === "lead_prompt_skipped") {
      const validScanId = typeof scanId === "string" && UUID_RE.test(scanId) ? scanId : null;
      // A page refresh within the scan dedup window reuses the scan id: one skip per scan.
      if (action === "lead_prompt_skipped" && validScanId) {
        const { data: seen } = await supabase.from("qr_events").select("id")
          .eq("event_type", action).eq("scan_id", validScanId).limit(1);
        if (seen && seen.length > 0) return json({ ok: true });
      }
      await supabase.from("qr_events").insert({
        event_type: action, source_type: sourceType, code, gym_id: gymId, machine_id: machineId,
        scan_id: validScanId, platform: plat, ip_hash: ipHash, ua_hash: uaHash, detail: reason,
      });
      return json({ ok: true });
    }

    if (action === "lead") {
      if (isBot(body.website)) return json({ ok: true });
      const email = normalizeEmail(body.email);
      if (!isValidEmail(email)) return json({ error: "bad email" }, 400);
      const lang = toLang(body.lang);

      // Rate limit every submission from one IP (gym Wi-Fi shares one), new or repeated.
      if (ipHash) {
        const since = new Date(Date.now() - 3_600_000).toISOString();
        const { count } = await supabase.from("qr_events").select("id", { count: "exact", head: true })
          .eq("event_type", "lead_submitted").eq("ip_hash", ipHash).gte("created_at", since);
        if ((count ?? 0) >= LEAD_RATE_LIMIT_PER_HOUR) return json({ ok: true });
      }

      const now = new Date().toISOString();
      // scan_id is an FK: only a well-formed UUID of an existing scan is kept, never a reason to fail.
      const validScanId = typeof scanId === "string" && UUID_RE.test(scanId) ? scanId : null;
      const context = { scan_id: validScanId, source_type: sourceType, code, gym_id: gymId, machine_id: machineId, platform: plat, lang, ip_hash: ipHash, updated_at: now };
      // An existing address only moves its context. This unauthenticated form never
      // touches consent or unsubscribed_at: anyone can type anyone's address, so an
      // unsubscribe stays final here.
      const updateContext = async (ctx: typeof context) =>
        await supabase.from("qr_leads").update(ctx).eq("email_normalized", email);
      const { data: existing } = await supabase.from("qr_leads").select("id").eq("email_normalized", email).maybeSingle();
      let { error: leadErr } = existing
        ? await updateContext(context)
        : await supabase.from("qr_leads").insert({
            email, ...context,
            consent_text: consentTextFor(lang), consent_text_version: CONSENT_TEXT_VERSION, consent_at: now,
          });
      // Parallel submit of the same address: the other request inserted first.
      if (leadErr?.code === "23505") ({ error: leadErr } = await updateContext(context));
      // Scan event gone (FK): keep the lead without it.
      if (leadErr?.code === "23503") ({ error: leadErr } = existing
        ? await updateContext({ ...context, scan_id: null })
        : await supabase.from("qr_leads").insert({
            email, ...context, scan_id: null,
            consent_text: consentTextFor(lang), consent_text_version: CONSENT_TEXT_VERSION, consent_at: now,
          }));
      if (leadErr) {
        console.error("qr lead failed", leadErr.code, leadErr.message);
        return json({ error: "lead failed" }, 500);
      }

      await supabase.from("qr_events").insert({
        event_type: "lead_submitted", source_type: sourceType, code, gym_id: gymId, machine_id: machineId,
        scan_id: validScanId, platform: plat, ip_hash: ipHash, ua_hash: uaHash,
      });
      return json({ ok: true });
    }

    // store_click — tied to its scan when the page still knows it.
    const { error } = await supabase.from("qr_events").insert({
      event_type: "store_click", source_type: sourceType, code, gym_id: gymId,
      machine_id: machineId, scan_id: scanId ?? null, platform: plat, ip_hash: ipHash, ua_hash: uaHash,
    });
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, appStoreUrl: APP_STORE_URL, playStoreUrl: playUrl(scanId ?? null) });
  } catch (e) {
    return json({ error: `${e}` }, 500);
  }
});

// The Play referrer travels through install to the app (Install Referrer API),
// pairing the installation with the exact scan — Android attribution is exact.
const playUrl = (scanId: string | null) =>
  scanId ? `${PLAY_STORE_URL}&referrer=${encodeURIComponent(`pumplo_scan_${scanId}`)}` : PLAY_STORE_URL;
