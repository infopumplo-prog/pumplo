// Společné pomocníky pro synchronizace sekce Report (seo-gsc-sync, web-ga4-sync,
// aso-rank-sync, mrr-snapshot). Funkce volá cron bez JWT — brání je hlavička
// x-sync-secret (STORE_SYNC_SECRET, stejně jako store-metrics-sync).
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

export type RunStatus = "ok" | "partial" | "error" | "not_authorized" | "not_configured";
export type Source = "gsc" | "ga4" | "aso" | "mrr";

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Pražský kalendářní den (YYYY-MM-DD). */
export const pragueDay = (d: Date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(d);

export const addDays = (day: string, n: number) => {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return isoDay(d);
};

export function serviceClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

/** null = požadavek je v pořádku, jinak hotová odpověď 403/405. */
export function guard(req: Request): Response | null {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const secret = Deno.env.get("STORE_SYNC_SECRET");
  if (!secret || req.headers.get("x-sync-secret") !== secret) return json({ error: "forbidden" }, 403);
  return null;
}

/** Zapíše výsledek běhu do report_sync_runs (stav zdroje v adminu). */
export async function logRun(
  db: SupabaseClient, source: Source, startedAt: Date, status: RunStatus, message: string,
  details: Record<string, unknown> = {},
) {
  const { error } = await db.from("report_sync_runs").insert({
    source, started_at: startedAt.toISOString(), finished_at: new Date().toISOString(),
    status, message: message.slice(0, 2000), details,
  });
  if (error) console.error(`report_sync_runs insert failed: ${error.message}`);
}

/** Chyba Google API s HTTP stavem — 401/403 se v reportu ukáže jako „nemá přístup“. */
export class GoogleApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const b64url = (data: Uint8Array | string) => {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export interface ServiceAccount { client_email: string; private_key: string }

/** Service account z FCM_SERVICE_ACCOUNT_JSON (projekt pumplo-app). */
export function serviceAccount(): ServiceAccount | null {
  const raw = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw);
    return sa.client_email && sa.private_key ? sa : null;
  } catch {
    return null;
  }
}

/** OAuth access token přes JWT bearer flow pro daný scope. */
export async function googleToken(sa: ServiceAccount, scope: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email, scope, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claims}`),
  ));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${b64url(sig)}`,
    }),
  });
  if (!res.ok) throw new GoogleApiError(res.status, `OAuth token: HTTP ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

/** fetch na Google API s Bearer tokenem; chyby jako GoogleApiError se zkráceným tělem. */
export async function googleFetch(token: string, url: string, body?: unknown) {
  const res = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new GoogleApiError(res.status, `${url.split("?")[0]}: HTTP ${res.status} ${text.slice(0, 600)}`);
  }
  return await res.json();
}

/** Upsert po dávkách (PostgREST má limit velikosti požadavku). */
export async function upsertChunks(
  db: SupabaseClient, table: string, rows: Record<string, unknown>[], onConflict: string, size = 500,
): Promise<string | null> {
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + size), { onConflict });
    if (error) return `${table}: ${error.message}`;
  }
  return null;
}
