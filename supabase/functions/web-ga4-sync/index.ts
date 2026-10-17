// Denní sběr návštěvnosti webu z GA4 (Data API runReport) pro sekci Report.
//
// GA4 property „Pumplo“ (557367388, stream G-HXXC0FX8SQ) měří i app.pumplo.com
// a localhost — proto VŠECHNY dotazy filtrují hostName na pumplo.com (+ www).
//
//   report_ga4_daily        — sessions, uživatelé, noví, engaged po dnech a kanálech
//                             (sessionDefaultChannelGroup) + řádek '(all)' bez rozpadu
//   report_ga4_events_daily — počty klíčových událostí (click_store, generate_lead, click_register)
//
// Každý běh přepočítá posledních REFRESH_DAYS dní (GA4 data dozrávají ~48 h).
// Přístup: service account z FCM_SERVICE_ACCOUNT_JSON musí mít v GA4 roli
// Čtenář (Správce → Správa přístupu k službě). Jinak 403 → not_authorized.
// Backfill: tělo {"days": 90}.
import {
  addDays, GoogleApiError, googleFetch, googleToken, guard, json, logRun, pragueDay,
  serviceAccount, serviceClient, upsertChunks,
} from "../_shared/report.ts";

const PROPERTY = Deno.env.get("GA4_PROPERTY_ID") ?? "557367388";
const HOSTS = ["pumplo.com", "www.pumplo.com"];
const KEY_EVENTS = ["click_store", "generate_lead", "click_register"];
const REFRESH_DAYS = 30;
const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

const hostFilter = {
  filter: { fieldName: "hostName", inListFilter: { values: HOSTS } },
};

// GA4 vrací datum jako YYYYMMDD.
const gaDay = (v: string) => `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;

interface GaRow { dimensionValues: { value: string }[]; metricValues: { value: string }[] }

Deno.serve(async (req) => {
  const denied = guard(req);
  if (denied) return denied;
  const started = new Date();
  const db = serviceClient();
  const body = await req.json().catch(() => ({}));
  const days = Math.min(Math.max(parseInt(body?.days, 10) || REFRESH_DAYS, 1), 730);

  const sa = serviceAccount();
  if (!sa) {
    await logRun(db, "ga4", started, "not_configured", "Chybí secret FCM_SERVICE_ACCOUNT_JSON.");
    return json({ status: "not_configured" });
  }

  const end = addDays(pragueDay(), -1);
  const start = addDays(end, -(days - 1));
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY}:runReport`;
  const errors: string[] = [];
  const counts: Record<string, number> = {};
  const now = new Date().toISOString();

  try {
    const token = await googleToken(sa, SCOPE);
    const run = async (dimensions: string[], metrics: string[], dimensionFilter: unknown): Promise<GaRow[]> => {
      const out: GaRow[] = [];
      for (let offset = 0; ; offset += 10000) {
        const r = await googleFetch(token, url, {
          dateRanges: [{ startDate: start, endDate: end }],
          dimensions: dimensions.map((name) => ({ name })),
          metrics: metrics.map((name) => ({ name })),
          dimensionFilter, limit: 10000, offset, keepEmptyRows: false,
        });
        const rows = (r.rows ?? []) as GaRow[];
        out.push(...rows);
        if (out.length >= (r.rowCount ?? 0) || rows.length === 0) break;
      }
      return out;
    };
    const m = ["sessions", "totalUsers", "newUsers", "engagedSessions"];
    const toMetrics = (r: GaRow) => ({
      sessions: parseInt(r.metricValues[0].value, 10) || 0,
      total_users: parseInt(r.metricValues[1].value, 10) || 0,
      new_users: parseInt(r.metricValues[2].value, 10) || 0,
      engaged_sessions: parseInt(r.metricValues[3].value, 10) || 0,
      updated_at: now,
    });

    const [byChannel, total, events] = await Promise.all([
      run(["date", "sessionDefaultChannelGroup"], m, hostFilter),
      run(["date"], m, hostFilter),
      run(["date", "eventName"], ["eventCount"], {
        andGroup: {
          expressions: [
            hostFilter,
            { filter: { fieldName: "eventName", inListFilter: { values: KEY_EVENTS } } },
          ],
        },
      }),
    ]);

    // Přepočítávané okno nejdřív smazat — kanál, který mezitím zmizel, nesmí zůstat viset.
    for (const t of ["report_ga4_daily", "report_ga4_events_daily"]) {
      const del = await db.from(t).delete().gte("day", start).lte("day", end);
      if (del.error) errors.push(`${t} delete: ${del.error.message}`);
    }

    const rows = [
      ...byChannel.map((r) => ({ day: gaDay(r.dimensionValues[0].value), channel: r.dimensionValues[1].value || "(not set)", ...toMetrics(r) })),
      ...total.map((r) => ({ day: gaDay(r.dimensionValues[0].value), channel: "(all)", ...toMetrics(r) })),
    ];
    const e1 = await upsertChunks(db, "report_ga4_daily", rows, "day,channel");
    if (e1) errors.push(e1);
    counts.daily_rows = rows.length;

    const evRows = events.map((r) => ({
      day: gaDay(r.dimensionValues[0].value), event_name: r.dimensionValues[1].value,
      event_count: parseInt(r.metricValues[0].value, 10) || 0, updated_at: now,
    }));
    const e2 = await upsertChunks(db, "report_ga4_events_daily", evRows, "day,event_name");
    if (e2) errors.push(e2);
    counts.event_rows = evRows.length;
  } catch (e) {
    if (e instanceof GoogleApiError && (e.status === 401 || e.status === 403)) {
      const disabled = e.message.includes("SERVICE_DISABLED");
      const msg = disabled
        ? `V GCP projektu pumplo-app není zapnuté Google Analytics Data API — zapni ho: https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com?project=pumplo-app (pak ještě přidat service account ${sa.client_email}). Detail: ${e.message}`
        : `Service account ${sa.client_email} nemá přístup do GA4 property ${PROPERTY}. ` +
        `Přidej ho v GA4 → Správce → Správa přístupu k službě (role Čtenář). Detail: ${e.message}`;
      await logRun(db, "ga4", started, "not_authorized", msg);
      return json({ status: "not_authorized", message: msg });
    }
    errors.push(String(e));
  }

  const status = errors.length === 0 ? "ok" : Object.keys(counts).length > 0 ? "partial" : "error";
  const message = errors.length ? errors.join(" | ") :
    `OK: ${start}–${end}, ${counts.daily_rows ?? 0} řádků návštěvnosti, ${counts.event_rows ?? 0} řádků událostí.`;
  await logRun(db, "ga4", started, status, message, { counts, property: PROPERTY, from: start, to: end });
  return json({ status, message, counts });
});
