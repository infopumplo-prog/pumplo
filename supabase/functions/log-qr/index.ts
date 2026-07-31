import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_STORE_URL = "https://apps.apple.com/app/pumplo/id6768619318";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.pumplo.app";

// Scans from the same phone within this window count as one (page refreshes,
// double scans) — the funnel should count people, not page loads.
const DEDUP_WINDOW_MIN = 10;

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

/** Logs one flyer scan, skipping a repeat from the same IP (see DEDUP_WINDOW_MIN). */
const logFlyerScan = async (
  code: string,
  ipHash: string | null,
  uaHash: string | null,
  plat: string,
): Promise<void> => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: qr } = await supabase.from("qr_codes").select("gym_id").eq("code", code).maybeSingle();
  if (!qr) return; // Unknown flyer code — forward the reader, log nothing.

  if (ipHash) {
    const since = new Date(Date.now() - DEDUP_WINDOW_MIN * 60_000).toISOString();
    const { data: dup } = await supabase
      .from("qr_events")
      .select("id")
      .eq("event_type", "scan").eq("code", code).eq("ip_hash", ipHash)
      .gte("created_at", since)
      .limit(1);
    if (dup && dup.length > 0) return;
  }

  await supabase.from("qr_events").insert({
    event_type: "scan", source_type: "flyer", code, gym_id: qr.gym_id,
    machine_id: null, platform: plat, ip_hash: ipHash, ua_hash: uaHash,
  });
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // GET ?go=1&code=<code> — the flyer QR entry point: log the scan, then send
  // the reader to the website. Analytics failures must not cost us the visitor,
  // so every error path still redirects.
  if (req.method === "GET") {
    const url = new URL(req.url);
    const code = url.searchParams.get("code") ?? "";
    const dest = new URL(WEB_URL);
    dest.searchParams.set("utm_source", "qr");
    dest.searchParams.set("utm_medium", "flyer");
    if (code) dest.searchParams.set("utm_campaign", code);

    if (code && code.length <= 64) {
      try {
        const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
        const ua = req.headers.get("user-agent") ?? "";
        await Promise.race([
          logFlyerScan(
            code,
            ip ? await sha256(`pumplo-qr|${ip}`) : null,
            ua ? await sha256(`pumplo-qr|${ua}`) : null,
            platformFromUa(ua),
          ),
          new Promise((resolve) => setTimeout(resolve, LOG_TIMEOUT_MS)),
        ]);
      } catch { /* tracking never costs us a flyer reader */ }
    }

    return redirect(dest.toString());
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { action, sourceType, code, scanId, platform } = await req.json();
    if (!["scan", "store_click"].includes(action)) return json({ error: "bad action" }, 400);
    if (!["station", "flyer"].includes(sourceType)) return json({ error: "bad sourceType" }, 400);
    if (typeof code !== "string" || !code || code.length > 64) return json({ error: "bad code" }, 400);
    const plat = ["ios", "android"].includes(platform) ? platform : "other";

    // Resolve the gym (and machine for stations) from the scanned code.
    let gymId: string | null = null;
    let machineId: string | null = null;
    if (sourceType === "flyer") {
      const { data } = await supabase.from("qr_codes").select("gym_id").eq("code", code).maybeSingle();
      if (!data) return json({ error: "unknown code" }, 404);
      gymId = data.gym_id;
    } else {
      const { data } = await supabase.from("gym_machines").select("id, gym_id").eq("short_code", code).maybeSingle();
      if (data) { gymId = data.gym_id; machineId = data.id; }
      // Unknown station codes are still logged (sticker of a deleted machine).
    }

    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
    const ua = req.headers.get("user-agent") ?? "";
    const ipHash = ip ? await sha256(`pumplo-qr|${ip}`) : null;
    const uaHash = ua ? await sha256(`pumplo-qr|${ua}`) : null;

    if (action === "scan") {
      if (ipHash) {
        const since = new Date(Date.now() - DEDUP_WINDOW_MIN * 60_000).toISOString();
        const { data: dup } = await supabase
          .from("qr_events")
          .select("id")
          .eq("event_type", "scan").eq("code", code).eq("ip_hash", ipHash)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(1);
        if (dup && dup.length > 0) {
          return json({ scanId: dup[0].id, appStoreUrl: APP_STORE_URL, playStoreUrl: playUrl(dup[0].id) });
        }
      }
      const { data, error } = await supabase
        .from("qr_events")
        .insert({ event_type: "scan", source_type: sourceType, code, gym_id: gymId, machine_id: machineId, platform: plat, ip_hash: ipHash, ua_hash: uaHash })
        .select("id").single();
      if (error) return json({ error: error.message }, 500);
      return json({ scanId: data.id, appStoreUrl: APP_STORE_URL, playStoreUrl: playUrl(data.id) });
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
