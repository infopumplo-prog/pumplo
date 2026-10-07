import { describe, it, expect, vi, afterEach } from 'vitest';
import { submitLead } from './qrTracking';
const respond = (status: number, body: unknown) => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status })));
afterEach(() => vi.unstubAllGlobals());
describe('submitLead', () => {
  it('ok', async () => { respond(200, { ok: true }); expect(await submitLead('c', 'a@b.cz', 'cs', '')).toBe('ok'); });
  it('bad email only when server says so', async () => { respond(400, { error: 'bad email' }); expect(await submitLead('c', 'a@b.cz', 'cs', '')).toBe('bad_email'); });
  it('other 400 is a generic error', async () => { respond(400, { error: 'bad code' }); expect(await submitLead('c', 'a@b.cz', 'cs', '')).toBe('error'); });
  it('network failure', async () => { vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); })); expect(await submitLead('c', 'a@b.cz', 'cs', '')).toBe('error'); });
});

import { logQrScan, logLeadPromptEvent } from './qrTracking';
const native = vi.hoisted(() => ({ on: false, platform: 'web' }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native.on, getPlatform: () => native.platform } }));
const bodies = (f: ReturnType<typeof vi.fn>) => f.mock.calls.map((c) => JSON.parse((c[1] as RequestInit).body as string));
describe('scan native flag', () => {
  afterEach(() => { native.on = false; native.platform = 'web'; });
  it('web scan sends no native flag (backward compatible body)', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 200 })); vi.stubGlobal('fetch', f);
    await logQrScan('station', 'w1');
    expect(bodies(f)[0]).not.toHaveProperty('native');
  });
  it('native app scan sends native:true and the Capacitor platform', async () => {
    native.on = true; native.platform = 'android';
    const f = vi.fn(async () => new Response('{}', { status: 200 })); vi.stubGlobal('fetch', f);
    await logQrScan('station', 'n1');
    expect(bodies(f)[0]).toMatchObject({ action: 'scan', native: true, platform: 'android' });
  });
});
describe('lead_prompt_skipped', () => {
  it('sends reason and waits for the pending scan id', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const f = vi.fn(async (_u: string, init: RequestInit) => {
      const b = JSON.parse(init.body as string);
      if (b.action === 'scan') { await gate; return new Response(JSON.stringify({ scanId: '11111111-1111-1111-1111-111111111111' }), { status: 200 }); }
      return new Response('{"ok":true}', { status: 200 });
    });
    vi.stubGlobal('fetch', f);
    const scan = logQrScan('station', 'k1');
    const sent = logLeadPromptEvent('k1', 'lead_prompt_skipped', { reason: 'logged_in' });
    release(); await scan; await sent;
    const skip = bodies(f).find((b) => b.action === 'lead_prompt_skipped');
    expect(skip).toMatchObject({ reason: 'logged_in', sourceType: 'station', code: 'k1', scanId: '11111111-1111-1111-1111-111111111111' });
  });
  it('shown/dismissed carry no reason', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 200 })); vi.stubGlobal('fetch', f);
    await logLeadPromptEvent('k2', 'lead_prompt_shown');
    expect(bodies(f)[0]).not.toHaveProperty('reason');
  });
});
