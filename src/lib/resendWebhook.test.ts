// F1 e-maily (19. 10.): Resend webhook — Svix podpis, uložení události, suppressions.
import { describe, it, expect } from 'vitest';
import { handleResendWebhook, mapEventType, svixSignature, verifySvix, type WebhookDeps } from '../../supabase/functions/resend-webhook/handler';

const SECRET = 'whsec_' + btoa('pumplo-test-webhook-secret-0123456789');
const NOW = 1_760_000_000;

const event = (type: string, to = 'Jana@Example.com') =>
  JSON.stringify({ type, created_at: '2026-10-19T10:00:00Z', data: { email_id: 're_123', to: [to] } });

async function signedRequest(body: string, opts: { secret?: string; ts?: number; id?: string; tamper?: boolean } = {}) {
  const id = opts.id ?? 'msg_1';
  const ts = String(opts.ts ?? NOW);
  const sig = await svixSignature(opts.secret ?? SECRET, id, ts, body);
  return new Request('https://x.supabase.co/functions/v1/resend-webhook', {
    method: 'POST',
    headers: { 'svix-id': id, 'svix-timestamp': ts, 'svix-signature': `v1,bogus v1,${sig}` },
    body: opts.tamper ? body.replace('re_123', 're_999') : body,
  });
}

function deps() {
  const stored: unknown[] = [];
  const suppressed: unknown[] = [];
  const d: WebhookDeps = {
    secret: SECRET,
    nowSeconds: () => NOW,
    storeEvent: async (e) => { stored.push(e); return { error: null }; },
    suppress: async (email, reason, note) => { suppressed.push({ email, reason, note }); return { error: null }; },
  };
  return { d, stored, suppressed };
}

describe('verifySvix', () => {
  it('platný podpis projde, starý timestamp a cizí tajemství ne', async () => {
    const sig = await svixSignature(SECRET, 'm', String(NOW), 'b');
    expect(await verifySvix(SECRET, { id: 'm', timestamp: String(NOW), signature: `v1,${sig}` }, 'b', NOW)).toEqual({ ok: true });
    expect(await verifySvix(SECRET, { id: 'm', timestamp: String(NOW - 600), signature: `v1,${sig}` }, 'b', NOW)).toEqual({ ok: false, reason: 'stale' });
    expect(await verifySvix(SECRET, { id: 'm', timestamp: String(NOW), signature: `v1,${sig}` }, 'b2', NOW)).toEqual({ ok: false, reason: 'bad_signature' });
    expect(await verifySvix('whsec_' + btoa('other-secret-0123456789abcdef'), { id: 'm', timestamp: String(NOW), signature: `v1,${sig}` }, 'b', NOW)).toEqual({ ok: false, reason: 'bad_signature' });
    expect(await verifySvix(SECRET, { id: null, timestamp: String(NOW), signature: `v1,${sig}` }, 'b', NOW)).toEqual({ ok: false, reason: 'missing_headers' });
    expect(await verifySvix('', { id: 'm', timestamp: String(NOW), signature: `v1,${sig}` }, 'b', NOW)).toEqual({ ok: false, reason: 'no_secret' });
  });
});

describe('handleResendWebhook', () => {
  it('bez platného podpisu 401 a nic se neuloží', async () => {
    const { d, stored, suppressed } = deps();
    const res = await handleResendWebhook(await signedRequest(event('email.bounced'), { tamper: true }), d);
    expect(res.status).toBe(401);
    expect(stored).toHaveLength(0);
    expect(suppressed).toHaveLength(0);
  });
  it('starý timestamp → 401', async () => {
    const { d, stored } = deps();
    const res = await handleResendWebhook(await signedRequest(event('email.opened'), { ts: NOW - 3600 }), d);
    expect(res.status).toBe(401);
    expect(stored).toHaveLength(0);
  });
  it('GET → 405', async () => {
    const { d } = deps();
    expect((await handleResendWebhook(new Request('https://x/', { method: 'GET' }), d)).status).toBe(405);
  });
  it('opened → email_events, bez suppression', async () => {
    const { d, stored, suppressed } = deps();
    const res = await handleResendWebhook(await signedRequest(event('email.opened')), d);
    expect(res.status).toBe(200);
    expect(stored).toEqual([expect.objectContaining({ svixId: 'msg_1', resendId: 're_123', type: 'opened', email: 'jana@example.com' })]);
    expect(suppressed).toHaveLength(0);
  });
  it('bounce a stížnost → suppressions', async () => {
    for (const [t, reason] of [['email.bounced', 'bounce'], ['email.complained', 'complaint']] as const) {
      const { d, suppressed } = deps();
      const res = await handleResendWebhook(await signedRequest(event(t)), d);
      expect(res.status).toBe(200);
      expect(suppressed).toEqual([{ email: 'jana@example.com', reason, note: 're_123' }]);
    }
  });
  it('neznámý typ (email.sent) se potvrdí a ignoruje', async () => {
    const { d, stored } = deps();
    const res = await handleResendWebhook(await signedRequest(event('email.sent')), d);
    expect(res.status).toBe(200);
    expect(stored).toHaveLength(0);
  });
  it('chyba uložení → 500, aby Svix zkusil znovu', async () => {
    const { d } = deps();
    d.storeEvent = async () => ({ error: 'db down' });
    expect((await handleResendWebhook(await signedRequest(event('email.delivered')), d)).status).toBe(500);
  });
  it('mapování typů', () => {
    expect(mapEventType('email.delivered')).toBe('delivered');
    expect(mapEventType('email.clicked')).toBe('clicked');
    expect(mapEventType('email.delivery_delayed')).toBeNull();
  });
});
