// Denní sběr dat z Google Search Console (sc-domain:pumplo.com) pro sekci Report.
//
//   report_gsc_daily        — součty po dnech (posledních TOTALS_DAYS dní při každém běhu)
//   report_gsc_query_daily  — dotazy po dnech  (posledních DETAIL_DAYS dní se přepisuje,
//   report_gsc_page_daily   — stránky po dnech  GSC data dobíhají 2–3 dny zpětně)
//   report_gsc_sitemaps     — denní snímek sitemap (odesláno / indexováno)
//
// Přístup: service account z FCM_SERVICE_ACCOUNT_JSON musí být v Search Console
// přidaný jako uživatel (stačí „Omezené“). Dokud není, Google vrací 403 a běh se
// zapíše jako not_authorized — v adminu je to vidět, nic nespadne potichu.
//
// Jednorázový backfill: tělo {"days": 90} (max 480 — tolik GSC drží).
import {
  addDays, GoogleApiError, googleFetch, googleToken, guard, json, logRun, pragueDay,
  serviceAccount, serviceClient, upsertChunks,
} from "../_shared/report.ts";

const SITE = Deno.env.get("GSC_SITE_URL") ?? "sc-domain:pumplo.com";
const TOTALS_DAYS = 35;
const DETAIL_DAYS = 3;
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

interface GscRow { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }

Deno.serve(async (req) => {
  const denied = guard(req);
  if (denied) return denied;
  const started = new Date();
  const db = serviceClient();
  const body = await req.json().catch(() => ({}));
  const detailDays = Math.min(Math.max(parseInt(body?.days, 10) || DETAIL_DAYS, 1), 480);
  const totalsDays = Math.max(TOTALS_DAYS, detailDays);

  const sa = serviceAccount();
  if (!sa) {
    await logRun(db, "gsc", started, "not_configured", "Chybí secret FCM_SERVICE_ACCOUNT_JSON.");
    return json({ status: "not_configured" });
  }

  const today = pragueDay();
  const end = addDays(today, -1);
  const base = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}`;
  const errors: string[] = [];
  const counts: Record<string, number> = {};

  try {
    const token = await googleToken(sa, SCOPE);
    const query = async (dimensions: string[], startDate: string): Promise<GscRow[]> => {
      const out: GscRow[] = [];
      for (let startRow = 0; ; startRow += 25000) {
        const r = await googleFetch(token, `${base}/searchAnalytics/query`, {
          startDate, endDate: end, dimensions, rowLimit: 25000, startRow, dataState: "all",
        });
        const rows = (r.rows ?? []) as GscRow[];
        out.push(...rows);
        if (rows.length < 25000) break;
      }
      return out;
    };
    const metrics = (r: GscRow) => ({
      clicks: Math.round(r.clicks), impressions: Math.round(r.impressions),
      ctr: Number(r.ctr.toFixed(6)), position: Number(r.position.toFixed(2)),
      updated_at: new Date().toISOString(),
    });

    // Součty po dnech. Dny bez dat GSC nevrací — doplníme nulami, ať graf nemá díry.
    const totalsStart = addDays(end, -(totalsDays - 1));
    const totals = await query(["date"], totalsStart);
    const byDay = new Map(totals.map((r) => [r.keys[0], r]));
    const totalRows = [];
    // Poslední 3 dny bez řádku ještě nemusí být zpracované — nulu nezapisujeme.
    for (let d = totalsStart; d <= end; d = addDays(d, 1)) {
      const r = byDay.get(d);
      if (r) totalRows.push({ day: d, ...metrics(r) });
      else if (d < addDays(end, -3)) totalRows.push({ day: d, clicks: 0, impressions: 0, ctr: null, position: null, updated_at: new Date().toISOString() });
    }
    const e1 = await upsertChunks(db, "report_gsc_daily", totalRows, "day");
    if (e1) errors.push(e1);
    counts.daily = totalRows.length;

    // Dotazy a stránky: přepsat posledních detailDays dní (smazat + vložit, ať zmizí
    // řádky, které GSC mezitím přepočítal).
    const detailStart = addDays(end, -(detailDays - 1));
    for (const [dim, table, col] of [["query", "report_gsc_query_daily", "query"], ["page", "report_gsc_page_daily", "page"]] as const) {
      const rows = await query(["date", dim], detailStart);
      const del = await db.from(table).delete().gte("day", detailStart).lte("day", end);
      if (del.error) errors.push(`${table} delete: ${del.error.message}`);
      const e = await upsertChunks(db, table, rows.map((r) => ({ day: r.keys[0], [col]: r.keys[1], ...metrics(r) })), `day,${col}`);
      if (e) errors.push(e);
      counts[dim] = rows.length;
    }

    // Sitemapy — denní snímek.
    const sm = await googleFetch(token, `${base}/sitemaps`);
    const smRows = (sm.sitemap ?? []).map((s: Record<string, unknown>) => {
      const contents = (s.contents ?? []) as { submitted?: string; indexed?: string }[];
      const sum = (k: "submitted" | "indexed") =>
        contents.reduce((a, c) => a + (parseInt(c[k] ?? "", 10) || 0), 0);
      return {
        snapshot_day: today, path: s.path,
        submitted: contents.length ? sum("submitted") : null,
        indexed: contents.length ? sum("indexed") : null,
        errors: parseInt(String(s.errors ?? "0"), 10) || 0,
        warnings: parseInt(String(s.warnings ?? "0"), 10) || 0,
        last_submitted: s.lastSubmitted ?? null,
        last_downloaded: s.lastDownloaded ?? null,
        is_pending: s.isPending ?? null,
        updated_at: new Date().toISOString(),
      };
    });
    const e2 = await upsertChunks(db, "report_gsc_sitemaps", smRows, "snapshot_day,path");
    if (e2) errors.push(e2);
    counts.sitemaps = smRows.length;
  } catch (e) {
    if (e instanceof GoogleApiError && (e.status === 401 || e.status === 403)) {
      const disabled = e.message.includes("SERVICE_DISABLED");
      const msg = disabled
        ? `V GCP projektu pumplo-app není zapnuté Google Search Console API — zapni ho: https://console.cloud.google.com/apis/library/searchconsole.googleapis.com?project=pumplo-app (pak ještě přidat service account ${sa.client_email}). Detail: ${e.message}`
        : `Service account ${sa.client_email} nemá přístup do Search Console (${SITE}). ` +
        `Přidej ho v Search Console → Nastavení → Uživatelé a oprávnění (Omezené). Detail: ${e.message}`;
      await logRun(db, "gsc", started, "not_authorized", msg, { counts });
      return json({ status: "not_authorized", message: msg });
    }
    errors.push(String(e));
  }

  const status = errors.length === 0 ? "ok" : Object.keys(counts).length > 0 ? "partial" : "error";
  const message = errors.length ? errors.join(" | ") :
    `OK: ${counts.daily ?? 0} dní, ${counts.query ?? 0} řádků dotazů, ${counts.page ?? 0} řádků stránek, ${counts.sitemaps ?? 0} sitemap.`;
  await logRun(db, "gsc", started, status, message, { counts, detail_days: detailDays });
  return json({ status, message, counts });
});
