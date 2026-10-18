// Resend webhook (F1 e-maily, 19. 10. 2026) — čistá logika bez Deno importů,
// testovaná vitestem (src/lib/resendWebhook.test.ts).
//
// Resend podepisuje přes Svix: hlavičky svix-id, svix-timestamp, svix-signature
// („v1,<base64>“, i víc mezerou oddělených), podepisuje se `${id}.${timestamp}.${body}`
// HMAC-SHA256 klíčem z RESEND_WEBHOOK_SECRET („whsec_<base64>“).
// Události: delivered / opened / clicked / bounced / complained → email_events;
// bounced a complained navíc → email_suppressions (adresa už nedostane nic).

export const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

export type StoredEventType = 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained';

const EVENT_MAP: Record<string, StoredEventType> = {
  'email.delivered': 'delivered',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
};

export const mapEventType = (t: unknown): StoredEventType | null =>
  typeof t === 'string' && t in EVENT_MAP ? EVENT_MAP[t] : null;

const b64ToBuffer = (b64: string): ArrayBuffer => {
  const bin = atob(b64);
  const buf = new ArrayBuffer(bin.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
  return buf;
};

const bytesToB64 = (bytes: Uint8Array): string => {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};

/** Konstantní čas porovnání (stejné délky). */
const safeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

export async function svixSignature(secret: string, id: string, timestamp: string, body: string): Promise<string> {
  const keyBytes = b64ToBuffer(secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret);
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
  return bytesToB64(new Uint8Array(sig));
}

export type VerifyResult = { ok: true } | { ok: false; reason: 'missing_headers' | 'bad_timestamp' | 'stale' | 'bad_signature' | 'no_secret' };

export async function verifySvix(
  secret: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  body: string,
  nowSeconds: number,
): Promise<VerifyResult> {
  if (!secret || secret.length < 16) return { ok: false, reason: 'no_secret' };
  if (!headers.id || !headers.timestamp || !headers.signature) return { ok: false, reason: 'missing_headers' };
  const ts = Number(headers.timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: 'bad_timestamp' };
  if (Math.abs(nowSeconds - ts) > SIGNATURE_TOLERANCE_SECONDS) return { ok: false, reason: 'stale' };
  let expected: string;
  try {
    expected = await svixSignature(secret, headers.id, headers.timestamp, body);
  } catch {
    return { ok: false, reason: 'no_secret' };
  }
  const candidates = headers.signature.split(' ').map((s) => s.trim()).filter(Boolean);
  for (const c of candidates) {
    const [version, sig] = c.split(',', 2);
    if (version === 'v1' && sig && safeEqual(sig, expected)) return { ok: true };
  }
  return { ok: false, reason: 'bad_signature' };
}

export interface WebhookDeps {
  secret: string;
  nowSeconds?: () => number;
  /** Uloží událost; duplicate = stejné svix-id už je uložené (opakované doručení). */
  storeEvent: (e: { svixId: string; resendId: string | null; type: StoredEventType; email: string | null; payload: unknown }) => Promise<{ error: string | null; duplicate?: boolean }>;
  suppress: (email: string, reason: 'bounce' | 'complaint', note: string | null) => Promise<{ error: string | null }>;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export async function handleResendWebhook(req: Request, deps: WebhookDeps): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const body = await req.text();
  const svixId = req.headers.get('svix-id');
  const verdict = await verifySvix(
    deps.secret,
    { id: svixId, timestamp: req.headers.get('svix-timestamp'), signature: req.headers.get('svix-signature') },
    body,
    deps.nowSeconds ? deps.nowSeconds() : Math.floor(Date.now() / 1000),
  );
  if (!verdict.ok) return json({ error: 'invalid_signature', reason: verdict.reason }, verdict.reason === 'no_secret' ? 500 : 401);

  let payload: { type?: string; data?: { email_id?: string; to?: string[] | string } };
  try {
    payload = JSON.parse(body);
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  const type = mapEventType(payload.type);
  if (!type) return json({ ok: true, ignored: payload.type ?? null });

  const resendId = payload.data?.email_id ?? null;
  const toRaw = payload.data?.to;
  const email = (Array.isArray(toRaw) ? toRaw[0] : toRaw) ?? null;
  const normalized = typeof email === 'string' && email.includes('@') ? email.trim().toLowerCase() : null;

  const stored = await deps.storeEvent({ svixId: svixId!, resendId, type, email: normalized, payload });
  if (stored.error) return json({ error: 'store_failed' }, 500); // Svix zkusí znovu

  if ((type === 'bounced' || type === 'complained') && normalized) {
    const s = await deps.suppress(normalized, type === 'bounced' ? 'bounce' : 'complaint', resendId);
    if (s.error) return json({ error: 'suppress_failed' }, 500);
  }
  return json({ ok: true, type, duplicate: stored.duplicate === true });
}
