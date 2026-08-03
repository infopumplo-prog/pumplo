import { createClient } from "npm:@supabase/supabase-js@2";
import { create as createJwt } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

// Denní sběr metrik z obchodů do store_metrics_daily.
//
//   App Store: Sales report (stažení 1F / redownloady 3F) přes ASC API,
//              App Analytics ONGOING reporty (aktivní zařízení, sessions,
//              smazání) — Apple je generuje se zpožděním 1–2 dny.
//   Google Play: GCS export installs_com.pumplo.app_YYYYMM_overview.csv
//              (denní user_installs, uninstally, aktivní zařízení).
//
// Spouští cron jednou denně (viz cron.schedule store-metrics-sync-daily);
// každý běh dotáhne posledních BACKFILL_DAYS dní, takže výpadek se sám zahojí.
// Chyba jedné platformy nesmí zastavit druhou — proto se sbírají do `errors`
// a funkce vrací 200 s přehledem, co se povedlo.

const BACKFILL_DAYS = 14;
const PLAY_BUCKET = "pubsite_prod_4804754019393462500";
const PLAY_PACKAGE = "com.pumplo.app";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

const daysBack = (n: number): string[] => {
  const out: string[] = [];
  for (let i = 1; i <= n; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    out.push(isoDay(d));
  }
  return out;
};

// ---------- Apple ----------

const importP8 = async (pem: string): Promise<CryptoKey> => {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
};

const ascToken = async (): Promise<string> => {
  const key = await importP8(Deno.env.get("ASC_PRIVATE_KEY")!);
  const now = Math.floor(Date.now() / 1000);
  return await createJwt(
    { alg: "ES256", kid: Deno.env.get("ASC_KEY_ID")!, typ: "JWT" },
    { iss: Deno.env.get("ASC_ISSUER_ID")!, iat: now, exp: now + 900, aud: "appstoreconnect-v1" },
    key,
  );
};

// Sales report za jeden den → { downloads, redownloads } (jen řádky naší appky).
const ascSalesDay = async (token: string, day: string) => {
  const url = "https://api.appstoreconnect.apple.com/v1/salesReports" +
    `?filter[frequency]=DAILY&filter[reportDate]=${day}` +
    "&filter[reportSubType]=SUMMARY&filter[reportType]=SALES" +
    `&filter[vendorNumber]=${Deno.env.get("ASC_VENDOR_NUMBER")}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/a-gzip" },
  });
  if (res.status === 404) return { downloads: 0, redownloads: 0 }; // den bez prodejů
  if (!res.ok) throw new Error(`ASC sales ${day}: HTTP ${res.status}`);
  const gz = new Uint8Array(await res.arrayBuffer());
  const text = await new Response(
    new Blob([gz]).stream().pipeThrough(new DecompressionStream("gzip")),
  ).text();
  const lines = text.trim().split("\n");
  const hdr = lines[0].split("\t");
  const iUnits = hdr.indexOf("Units");
  const iType = hdr.indexOf("Product Type Identifier");
  const iSku = hdr.indexOf("SKU");
  let downloads = 0, redownloads = 0;
  for (const line of lines.slice(1)) {
    const c = line.split("\t");
    if (!c[iSku]?.startsWith("PUMPLO")) continue;
    const units = parseInt(c[iUnits] || "0", 10);
    if (c[iType] === "1F" || c[iType] === "1") downloads += units;
    if (c[iType] === "3F" || c[iType] === "3") redownloads += units;
  }
  return { downloads, redownloads };
};

// App Analytics ONGOING reporty: instance CSV mají řádky po dnech. Vrací mapy
// day → hodnota pro aktivní zařízení, sessions a smazání. Dokud Apple reporty
// negeneruje (prvních ~48 h po založení requestu), vrací prázdné mapy.
const ascAnalytics = async (token: string) => {
  const out = {
    activeDevices: new Map<string, number>(),
    sessions: new Map<string, number>(),
    deletions: new Map<string, number>(),
  };
  const get = async (url: string) => {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`ASC analytics: HTTP ${r.status} ${url}`);
    return await r.json();
  };
  const reqs = await get(
    `https://api.appstoreconnect.apple.com/v1/apps/${Deno.env.get("ASC_APP_ID")}/analyticsReportRequests?filter[accessType]=ONGOING`,
  );
  const reqId = reqs.data?.[0]?.id;
  if (!reqId) return out;

  const wanted: Record<string, keyof typeof out> = {
    "App Store Installation and Deletion Standard": "deletions",
    "App Sessions Standard": "sessions",
  };
  const reports = await get(
    `https://api.appstoreconnect.apple.com/v1/analyticsReportRequests/${reqId}/reports?limit=200`,
  );
  for (const rep of reports.data ?? []) {
    const target = wanted[rep.attributes?.name as string];
    if (!target) continue;
    const insts = await get(
      `https://api.appstoreconnect.apple.com/v1/analyticsReports/${rep.id}/instances?filter[granularity]=DAILY&limit=14`,
    );
    for (const inst of insts.data ?? []) {
      const segs = await get(
        `https://api.appstoreconnect.apple.com/v1/analyticsReportInstances/${inst.id}/segments`,
      );
      for (const seg of segs.data ?? []) {
        const gz = await fetch(seg.attributes.url);
        if (!gz.ok) continue;
        const text = await new Response(
          gz.body!.pipeThrough(new DecompressionStream("gzip")),
        ).text();
        const lines = text.trim().split("\n");
        const hdr = lines[0].split("\t");
        const iDate = hdr.findIndex((h) => /^Date$/i.test(h));
        if (iDate < 0) continue;
        for (const line of lines.slice(1)) {
          const c = line.split("\t");
          const day = c[iDate];
          if (!/^\d{4}-\d{2}-\d{2}$/.test(day ?? "")) continue;
          if (target === "deletions") {
            const iCnt = hdr.findIndex((h) => /Deletions|Counts?/i.test(h));
            const iEvent = hdr.findIndex((h) => /Event/i.test(h));
            if (iEvent >= 0 && !/delete/i.test(c[iEvent] ?? "")) continue;
            const v = parseInt(c[iCnt] ?? "0", 10) || 0;
            out.deletions.set(day, (out.deletions.get(day) ?? 0) + v);
          } else if (target === "sessions") {
            const iCnt = hdr.findIndex((h) => /Sessions?/i.test(h));
            const v = parseInt(c[iCnt] ?? "0", 10) || 0;
            out.sessions.set(day, (out.sessions.get(day) ?? 0) + v);
            const iDev = hdr.findIndex((h) => /Unique Devices/i.test(h));
            if (iDev >= 0) {
              const dv = parseInt(c[iDev] ?? "0", 10) || 0;
              out.activeDevices.set(day, (out.activeDevices.get(day) ?? 0) + dv);
            }
          }
        }
      }
    }
  }
  return out;
};

// ---------- Google Play ----------

const b64url = (data: Uint8Array | string) => {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const playToken = async (): Promise<string> => {
  const sa = JSON.parse(Deno.env.get("PLAY_SA_KEY")!);
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/devstorage.read_only",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c: string) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claims}`),
  ));
  const assertion = `${header}.${claims}.${b64url(sig)}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) throw new Error(`Play OAuth: HTTP ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
};

// Overview CSV pro měsíc → mapa day → řádek. CSV je UTF-16 s BOM.
const playMonth = async (token: string, yyyymm: string) => {
  const name = `stats/installs/installs_${PLAY_PACKAGE}_${yyyymm}_overview.csv`;
  const res = await fetch(
    `https://storage.googleapis.com/storage/v1/b/${PLAY_BUCKET}/o/${encodeURIComponent(name)}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (res.status === 404 || res.status === 403) return new Map();
  if (!res.ok) throw new Error(`Play GCS ${yyyymm}: HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  const text = new TextDecoder("utf-16").decode(buf);
  const lines = text.trim().split("\n").map((l) => l.trim());
  const hdr = lines[0].split(",");
  const iDate = hdr.findIndex((h) => /^Date$/i.test(h));
  const iInst = hdr.findIndex((h) => /Daily User Installs/i.test(h));
  const iUnin = hdr.findIndex((h) => /Daily User Uninstalls/i.test(h));
  const iActive = hdr.findIndex((h) => /Active Device Installs/i.test(h));
  const out = new Map<string, { installs: number; uninstalls: number; active: number }>();
  for (const line of lines.slice(1)) {
    const c = line.split(",");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(c[iDate] ?? "")) continue;
    out.set(c[iDate], {
      installs: parseInt(c[iInst] ?? "0", 10) || 0,
      uninstalls: parseInt(c[iUnin] ?? "0", 10) || 0,
      active: parseInt(c[iActive] ?? "0", 10) || 0,
    });
  }
  return out;
};

// ---------- hlavní běh ----------

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  // Funkce běží bez JWT (volá ji cron) — brání ji sdílený secret v hlavičce.
  if (req.headers.get("x-sync-secret") !== Deno.env.get("STORE_SYNC_SECRET")) {
    return json({ error: "forbidden" }, 403);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const days = daysBack(BACKFILL_DAYS);
  const errors: string[] = [];
  // deno-lint-ignore no-explicit-any
  const rows = new Map<string, any>();
  const row = (day: string, platform: string) => {
    const k = `${day}|${platform}`;
    if (!rows.has(k)) rows.set(k, { day, platform });
    return rows.get(k);
  };

  // Apple — prodeje po dnech
  try {
    const token = await ascToken();
    for (const day of days) {
      try {
        const s = await ascSalesDay(token, day);
        Object.assign(row(day, "ios"), {
          downloads: s.downloads,
          redownloads: s.redownloads,
        });
      } catch (e) {
        errors.push(String(e));
      }
    }
    // App Analytics (může být prázdné, dokud Apple nezačne generovat)
    try {
      const a = await ascAnalytics(token);
      for (const day of days) {
        const r = row(day, "ios");
        if (a.activeDevices.has(day)) r.active_devices = a.activeDevices.get(day);
        if (a.sessions.has(day)) r.sessions = a.sessions.get(day);
        if (a.deletions.has(day)) r.uninstalls = a.deletions.get(day);
      }
    } catch (e) {
      errors.push(String(e));
    }
  } catch (e) {
    errors.push(`ASC auth: ${e}`);
  }

  // Google Play — měsíční CSV pokrývající backfill okno
  try {
    const token = await playToken();
    const months = [...new Set(days.map((d) => d.slice(0, 7).replace("-", "")))];
    for (const m of months) {
      const data = await playMonth(token, m);
      for (const day of days) {
        const d = data.get(day);
        if (!d) continue;
        Object.assign(row(day, "android"), {
          downloads: d.installs,
          uninstalls: d.uninstalls,
          active_devices: d.active,
        });
      }
      if (data.size === 0) errors.push(`Play ${m}: export nedostupný (403/404 — oprávnění se možná ještě propaguje)`);
    }
  } catch (e) {
    errors.push(`Play: ${e}`);
  }

  const upserts = [...rows.values()];
  if (upserts.length > 0) {
    const { error } = await supabase
      .from("store_metrics_daily")
      .upsert(upserts, { onConflict: "day,platform" });
    if (error) errors.push(`DB: ${error.message}`);
  }

  return json({ upserted: upserts.length, errors });
});
