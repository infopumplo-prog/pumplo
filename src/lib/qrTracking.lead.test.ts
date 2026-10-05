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
