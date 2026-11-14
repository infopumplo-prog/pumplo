// Loops webhook (19. 10. 2026) — čistá logika bez Deno importů, testovaná vitestem
// (src/lib/loopsWebhook.test.ts).
//
// Podpis (docs loops.so/docs/webhooks): hlavičky webhook-id, webhook-timestamp,
// webhook-signature („v1,<base64>“, víc mezerou oddělených); podepisuje se
// `${id}.${timestamp}.${rawBody}` HMAC-SHA256 klíčem z LOOPS_WEBHOOK_SECRET
// („whsec_<base64>“). Tolerance 5 min. Stejné schéma jako Svix → sdílí svixSignature.
//
// Co dělá:
//  - každou událost uloží do email_events (provider 'loops', idempotence přes webhook-id;
//    opakované doručení znovu provede jen idempotentní kroky),
//  - contact.unsubscribed / email.unsubscribed → user_profiles.email_unsubscribed_at,
//  - *.email.sent → contact_log (channel 'email'), aby ranní push vynechal den s e-mailem,
//  - email.hardBounced → email_suppressions 'bounce', email.spamReported → 'complaint'.
//  - email.resubscribed jen uloží: znovupřihlášení v Loops samo neobnoví právní základ u nás.

import { svixSignature } from '../resend-webhook/handler.ts';

export const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

export type LoopsStoredType =
  | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'soft_bounced' | 'complained'
  | 'unsubscribed' | 'resubscribed' | 'other';

const TYPE_MAP: Record<string, LoopsStoredType> = {
  'campaign.email.sent': 'sent',
  'loop.email.sent': 'sent',
  'transactional.email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.hardBounced': 'bounced',
  'email.softBounced': 'soft_bounced',
  'email.spamReported': 'complained',
  'email.unsubscribed': 'unsubscribed',
  'contact.unsubscribed': 'unsubscribed',
  'email.resubscribed': 'resubscribed',
};

export const mapLoopsEvent = (name: unknown): LoopsStoredType =>
  typeof name === 'string' && name in TYPE_MAP ? TYPE_MAP[name] : 'other';

const safeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

export type VerifyResult = { ok: true } | { ok: false; reason: 'missing_headers' | 'bad_timestamp' | 'stale' | 'bad_signature' | 'no_secret' };

export async function verifyLoopsSignature(
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
  for (const c of headers.signature.split(' ').map((s) => s.trim()).filter(Boolean)) {
    const [version, sig] = c.split(',', 2);
    if (version === 'v1' && sig && safeEqual(sig, expected)) return { ok: true };
  }
  return { ok: false, reason: 'bad_signature' };
}

export interface LoopsPayload {
  eventName?: string;
  eventTime?: number;
  contactIdentity?: { id?: string | null; email?: string | null; userId?: string | null };
  email?: { id?: string; emailMessageId?: string; subject?: string };
  sourceType?: string;
  campaignName?: string;
  loopName?: string;
  transactionalName?: string;
  [k: string]: unknown;
}

export interface LoopsWebhookDeps {
  secret: string;
  nowSeconds?: () => number;
  /** duplicate = stejný webhook-id už uložený (Loops doručuje at-least-once). */
  storeEvent: (e: {
    webhookId: string; type: LoopsStoredType; eventName: string; email: string | null;
    userId: string | null; messageId: string | null; payload: unknown;
  }) => Promise<{ error: string | null; duplicate?: boolean }>;
  /** userId z contactIdentity, jinak dohledat podle e-mailu (null = neznámý). */
  resolveUserId: (userId: string | null, email: string | null) => Promise<string | null>;
  markUnsubscribed: (userId: string, atIso: string) => Promise<{ error: string | null }>;
  logEmailContact: (userId: string, type: string) => Promise<void>;
  suppress: (email: string, reason: 'bounce' | 'complaint', note: string | null) => Promise<{ error: string | null }>;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const sourceLabel = (p: LoopsPayload): string => {
  const name = p.loopName ?? p.campaignName ?? p.transactionalName ?? p.sourceType ?? 'email';
  return `loops:${String(name).slice(0, 80)}`;
};

export async function handleLoopsWebhook(req: Request, deps: LoopsWebhookDeps): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const body = await req.text();
  const webhookId = req.headers.get('webhook-id');
  const verdict = await verifyLoopsSignature(
    deps.secret,
    { id: webhookId, timestamp: req.headers.get('webhook-timestamp'), signature: req.headers.get('webhook-signature') },
    body,
    deps.nowSeconds ? deps.nowSeconds() : Math.floor(Date.now() / 1000),
  );
  if (verdict.ok === false) {
    const reason = (verdict as Extract<VerifyResult, { ok: false }>).reason;
    return json({ error: 'invalid_signature', reason }, reason === 'no_secret' ? 500 : 401);
  }

  let p: LoopsPayload;
  try {
    p = JSON.parse(body);
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  const eventName = typeof p.eventName === 'string' ? p.eventName : 'unknown';
  const type = mapLoopsEvent(eventName);
  const rawEmail = p.contactIdentity?.email;
  const email = typeof rawEmail === 'string' && rawEmail.includes('@') ? rawEmail.trim().toLowerCase() : null;
  const rawUser = p.contactIdentity?.userId;
  const claimedUserId = typeof rawUser === 'string' && UUID.test(rawUser) ? rawUser : null;
  const atIso = new Date((Number.isFinite(p.eventTime) ? Number(p.eventTime) : Math.floor(Date.now() / 1000)) * 1000).toISOString();

  const stored = await deps.storeEvent({
    webhookId: webhookId!, type, eventName, email, userId: claimedUserId,
    messageId: p.email?.emailMessageId ?? p.email?.id ?? null, payload: p,
  });
  if (stored.error) return json({ error: 'store_failed' }, 500); // Loops zkusí znovu
  // Opakované doručení: odhlášení a suppression jsou idempotentní, a proto proběhnou znovu
  // (minulý pokus mohl spadnout po uložení); contact_log jen poprvé.
  const duplicate = stored.duplicate === true;

  if (type === 'unsubscribed' || type === 'sent') {
    const userId = await deps.resolveUserId(claimedUserId, email);
    if (userId && type === 'unsubscribed') {
      const r = await deps.markUnsubscribed(userId, atIso);
      if (r.error) return json({ error: 'unsubscribe_failed' }, 500);
    }
    if (userId && type === 'sent' && !duplicate) await deps.logEmailContact(userId, sourceLabel(p));
  }
  if ((type === 'bounced' || type === 'complained') && email) {
    const s = await deps.suppress(email, type === 'bounced' ? 'bounce' : 'complaint', `loops:${p.email?.emailMessageId ?? webhookId}`);
    if (s.error) return json({ error: 'suppress_failed' }, 500);
  }
  return json({ ok: true, type, duplicate });
}
