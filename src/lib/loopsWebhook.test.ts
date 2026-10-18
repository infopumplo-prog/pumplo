// Loops webhook (19. 10. 2026): podpis, odhlášení → user_profiles, odeslání → contact_log,
// bounce/stížnost → suppressions, vše do email_events, idempotence opakovaného doručení.
import { describe, it, expect } from 'vitest';
import { svixSignature } from '../../supabase/functions/resend-webhook/handler';
import { handleLoopsWebhook, mapLoopsEvent, verifyLoopsSignature, type LoopsWebhookDeps } from '../../supabase/functions/loops-webhook/handler';

const SECRET = 'whsec_' + btoa('pumplo-loops-webhook-secret-0123456789');
const NOW = 1_760_000_000;
const UID = '11111111-2222-4333-8444-555555555555';

const payload = (eventName: string, extra: Record<string, unknown> = {}) => JSON.stringify({
  eventName, eventTime: NOW - 10, webhookSchemaVersion: '1.0.0',
  contactIdentity: { id: 'c1', email: 'Jana@Example.com', userId: UID },
  email: { id: 'e1', emailMessageId: 'm1', subject: 'S' }, sourceType: 'loop', loopName: 'M6 druhý trénink',
  ...extra,
});

async function req(body: string, opts: { id?: string; ts?: number; tamper?: boolean; secret?: string } = {}) {
  const id = opts.id ?? 'wh_1';
  const ts = String(opts.ts ?? NOW);
  const sig = await svixSignature(opts.secret ?? SECRET, id, ts, body);
  return new Request('https://x.supabase.co/functions/v1/loops-webhook', {
    method: 'POST',
    headers: { 'webhook-id': id, 'webhook-timestamp': ts, 'webhook-signature': `v1,nope v1,${sig}` },
    body: opts.tamper ? body.replace('m1', 'm2') : body,
  });
}

function deps(over: Partial<LoopsWebhookDeps> = {}) {
  const log = { stored: [] as unknown[], unsub: [] as unknown[], contacts: [] as unknown[], suppressed: [] as unknown[] };
  const seen = new Set<string>();
  const d: LoopsWebhookDeps = {
    secret: SECRET,
    nowSeconds: () => NOW,
    storeEvent: async (e) => {
      if (seen.has(e.webhookId)) return { error: null, duplicate: true };
      seen.add(e.webhookId); log.stored.push(e); return { error: null };
    },
    resolveUserId: async (userId) => userId,
    markUnsubscribed: async (userId, at) => { log.unsub.push({ userId, at }); return { error: null }; },
    logEmailContact: async (userId, type) => { log.contacts.push({ userId, type }); },
    suppress: async (email, reason, note) => { log.suppressed.push({ email, reason, note }); return { error: null }; },
    ...over,
  };
  return { d, log };
}

describe('verifyLoopsSignature', () => {
  it('platný projde; pozměněné tělo, starý čas, chybějící hlavičky a chybějící tajemství ne', async () => {
    const sig = await svixSignature(SECRET, 'i', String(NOW), 'b');
    expect(await verifyLoopsSignature(SECRET, { id: 'i', timestamp: String(NOW), signature: `v1,${sig}` }, 'b', NOW)).toEqual({ ok: true });
    expect(await verifyLoopsSignature(SECRET, { id: 'i', timestamp: String(NOW), signature: `v1,${sig}` }, 'b2', NOW)).toEqual({ ok: false, reason: 'bad_signature' });
    expect(await verifyLoopsSignature(SECRET, { id: 'i', timestamp: String(NOW - 301), signature: `v1,${sig}` }, 'b', NOW)).toEqual({ ok: false, reason: 'stale' });
    expect(await verifyLoopsSignature(SECRET, { id: 'i', timestamp: null, signature: `v1,${sig}` }, 'b', NOW)).toEqual({ ok: false, reason: 'missing_headers' });
    expect(await verifyLoopsSignature('', { id: 'i', timestamp: String(NOW), signature: `v1,${sig}` }, 'b', NOW)).toEqual({ ok: false, reason: 'no_secret' });
    expect(await verifyLoopsSignature(SECRET, { id: 'i', timestamp: String(NOW), signature: `v2,${sig}` }, 'b', NOW)).toEqual({ ok: false, reason: 'bad_signature' });
  });
  it('mapování událostí', () => {
    expect(mapLoopsEvent('loop.email.sent')).toBe('sent');
    expect(mapLoopsEvent('email.hardBounced')).toBe('bounced');
    expect(mapLoopsEvent('email.softBounced')).toBe('soft_bounced');
    expect(mapLoopsEvent('email.spamReported')).toBe('complained');
    expect(mapLoopsEvent('contact.unsubscribed')).toBe('unsubscribed');
    expect(mapLoopsEvent('contact.created')).toBe('other');
  });
});

describe('handleLoopsWebhook', () => {
  it('neplatný podpis → 401, nic se neuloží ani nezmění', async () => {
    const { d, log } = deps();
    const res = await handleLoopsWebhook(await req(payload('contact.unsubscribed'), { tamper: true }), d);
    expect(res.status).toBe(401);
    expect(log).toEqual({ stored: [], unsub: [], contacts: [], suppressed: [] });
  });
  it('chybí LOOPS_WEBHOOK_SECRET → 500 (Loops to zkusí znovu)', async () => {
    const { d } = deps({ secret: '' });
    expect((await handleLoopsWebhook(await req(payload('email.delivered')), d)).status).toBe(500);
  });
  it('odhlášení → email_unsubscribed_at k času události', async () => {
    const { d, log } = deps();
    const res = await handleLoopsWebhook(await req(payload('contact.unsubscribed')), d);
    expect(res.status).toBe(200);
    expect(log.unsub).toEqual([{ userId: UID, at: new Date((NOW - 10) * 1000).toISOString() }]);
    expect(log.stored).toHaveLength(1);
    expect(log.stored[0]).toMatchObject({ type: 'unsubscribed', email: 'jana@example.com', userId: UID, webhookId: 'wh_1' });
  });
  it('odeslaný e-mail → contact_log (jen poprvé), opakované doručení contact_log nezdvojí', async () => {
    const { d, log } = deps();
    await handleLoopsWebhook(await req(payload('loop.email.sent')), d);
    const again = await handleLoopsWebhook(await req(payload('loop.email.sent')), d);
    expect(await again.json()).toMatchObject({ ok: true, duplicate: true });
    expect(log.contacts).toEqual([{ userId: UID, type: 'loops:M6 druhý trénink' }]);
  });
  it('opakované doručení odhlášení se provede znovu (idempotentní) — minulý pokus mohl spadnout', async () => {
    let fail = true;
    const { d, log } = deps({ markUnsubscribed: async (userId, at) => { if (fail) { fail = false; return { error: 'db down' }; } log.unsub.push({ userId, at }); return { error: null }; } });
    expect((await handleLoopsWebhook(await req(payload('email.unsubscribed')), d)).status).toBe(500);
    expect((await handleLoopsWebhook(await req(payload('email.unsubscribed')), d)).status).toBe(200);
    expect(log.unsub).toHaveLength(1);
  });
  it('hard bounce a spam → suppressions; soft bounce, doručení a otevření jen uložit', async () => {
    const { d, log } = deps();
    await handleLoopsWebhook(await req(payload('email.hardBounced'), { id: 'a' }), d);
    await handleLoopsWebhook(await req(payload('email.spamReported'), { id: 'b' }), d);
    for (const [i, n] of ['email.softBounced', 'email.delivered', 'email.opened', 'email.clicked', 'email.resubscribed'].entries()) {
      await handleLoopsWebhook(await req(payload(n), { id: `c${i}` }), d);
    }
    expect(log.suppressed).toEqual([
      { email: 'jana@example.com', reason: 'bounce', note: 'loops:m1' },
      { email: 'jana@example.com', reason: 'complaint', note: 'loops:m1' },
    ]);
    expect(log.stored).toHaveLength(7);
    expect(log.unsub).toEqual([]);
    expect(log.contacts).toEqual([]);
  });
  it('neznámý uživatel (bez userId, e-mail nenalezen) → uloží, nic nemění', async () => {
    const { d, log } = deps({ resolveUserId: async () => null });
    const res = await handleLoopsWebhook(await req(payload('contact.unsubscribed', { contactIdentity: { id: 'c', email: 'x@y.cz', userId: null } })), d);
    expect(res.status).toBe(200);
    expect(log.unsub).toEqual([]);
    expect(log.stored).toHaveLength(1);
  });
  it('GET → 405', async () => {
    const { d } = deps();
    expect((await handleLoopsWebhook(new Request('https://x/y', { method: 'GET' }), d)).status).toBe(405);
  });
});
