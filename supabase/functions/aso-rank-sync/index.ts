// Denní pozice Pumpla v App Storu (CZ) na klíčová slova + hodnocení appky.
//
//   report_aso_keywords       — seznam sledovaných slov (aktivní = active true; editace SQL)
//   report_aso_rank_daily     — pořadí v iTunes Search API (country=cz, limit 200);
//                               rank null = Pumplo v prvních 200 výsledcích není
//   report_store_rating_daily — průměr a počet hodnocení z iTunes Lookup API
//
// Pořadí z iTunes Search API je orientační — skutečné vyhledávání v App Storu
// používá jiný algoritmus, ale trend (lepší/horší) sedí. Apple API omezuje ~20
// dotazů za minutu, proto mezi dotazy čekáme PAUSE_MS.
// Google Play pozice nesledujeme: Play nemá veřejné vyhledávací API a stránku
// výsledků renderuje JS s proměnlivým obsahem (scraping by byl nespolehlivý).
import { guard, json, logRun, pragueDay, serviceClient, upsertChunks } from "../_shared/report.ts";

const APP_ID = 6768619318;
const PAUSE_MS = 3200;
const MAX_KEYWORDS = 40; // 40 × 3,2 s ≈ 130 s — pod 150s limitem edge funkce

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function itunes(url: string, attempt = 0): Promise<Record<string, unknown>> {
  const res = await fetch(url, { headers: { "User-Agent": "pumplo-report/1.0" } });
  if ((res.status === 403 || res.status === 429) && attempt < 2) {
    await sleep(10000);
    return itunes(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`iTunes HTTP ${res.status}`);
  return await res.json();
}

Deno.serve(async (req) => {
  const denied = guard(req);
  if (denied) return denied;
  const started = new Date();
  const db = serviceClient();
  const day = pragueDay();
  const now = new Date().toISOString();
  const errors: string[] = [];

  const { data: keywords, error: kwErr } = await db.from("report_aso_keywords")
    .select("keyword, country, platform").eq("active", true).eq("platform", "ios")
    .order("sort_order").order("id").limit(MAX_KEYWORDS);
  if (kwErr) {
    await logRun(db, "aso", started, "error", `report_aso_keywords: ${kwErr.message}`);
    return json({ status: "error", message: kwErr.message }, 500);
  }

  // Hodnocení appky (CZ storefront).
  let rating: Record<string, unknown> | null = null;
  try {
    const r = await itunes(`https://itunes.apple.com/lookup?id=${APP_ID}&country=cz`);
    const app = (r.results as Record<string, unknown>[] | undefined)?.[0];
    if (app) {
      rating = {
        day, platform: "ios", country: "cz",
        rating_avg: app.averageUserRating ?? null,
        rating_count: app.userRatingCount ?? 0,
        version: app.version ?? null, updated_at: now,
      };
      const e = await upsertChunks(db, "report_store_rating_daily", [rating], "day,platform,country");
      if (e) errors.push(e);
    } else errors.push("iTunes lookup: appka nenalezena");
  } catch (e) {
    errors.push(`lookup: ${e}`);
  }

  const rows: Record<string, unknown>[] = [];
  for (const kw of keywords ?? []) {
    await sleep(PAUSE_MS);
    try {
      const r = await itunes(
        `https://itunes.apple.com/search?term=${encodeURIComponent(kw.keyword)}&country=${kw.country}&entity=software&limit=200`,
      );
      const results = (r.results ?? []) as { trackId: number; trackName: string; userRatingCount?: number }[];
      const idx = results.findIndex((a) => a.trackId === APP_ID);
      rows.push({
        day, keyword: kw.keyword, country: kw.country, platform: "ios",
        rank: idx >= 0 ? idx + 1 : null,
        results_count: results.length,
        top_results: results.slice(0, 5).map((a) => ({ name: a.trackName, ratings: a.userRatingCount ?? 0 })),
        updated_at: now,
      });
    } catch (e) {
      errors.push(`${kw.keyword}: ${e}`);
    }
  }
  const e = await upsertChunks(db, "report_aso_rank_daily", rows, "day,keyword,country,platform");
  if (e) errors.push(e);

  const ranked = rows.filter((r) => r.rank !== null).length;
  const status = errors.length === 0 ? "ok" : rows.length > 0 ? "partial" : "error";
  const message = errors.length ? errors.join(" | ") :
    `OK: ${rows.length} klíčových slov (v top 200: ${ranked}), hodnocení ${rating?.rating_avg ?? "–"} (${rating?.rating_count ?? 0}×).`;
  await logRun(db, "aso", started, status, message, { keywords: rows.length, ranked });
  return json({ status, message });
});
