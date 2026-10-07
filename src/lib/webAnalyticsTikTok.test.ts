import { beforeEach, describe, expect, it, vi } from 'vitest';

const setupDom = (cookie = '') => {
  const store = new Map<string, string>();
  const g = globalThis as Record<string, unknown>;
  g.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  Object.defineProperty(globalThis, 'navigator', { value: { webdriver: false }, configurable: true, writable: true });
  g.location = { hostname: 'app.pumplo.com', pathname: '/s/abc' };
  const cookies: string[] = [];
  g.document = {
    get cookie() { return cookie; },
    set cookie(v: string) { cookies.push(v); },
    head: { appendChild: () => undefined },
    createElement: () => ({}),
    addEventListener: () => undefined,
  };
  g.window = g;
  delete g.gtag; delete g.fbq; delete g._fbq; delete g.dataLayer; delete g.ttq;
  return cookies;
};

type Ttq = unknown[][] & { _i?: Record<string, unknown> };
const ttq = () => (globalThis as { ttq?: Ttq }).ttq;
const ttqCalls = () => (ttq() ?? []).filter(Array.isArray).map((a) => a.slice(0, 2));
const tracked = () => ttqCalls().filter((c) => c[0] === 'track').map((c) => c[1]);

describe('TikTok Pixel on machine pages', () => {
  beforeEach(() => { vi.resetModules(); });

  it('uses the Pumplo web pixel by default', async () => {
    setupDom();
    const a = await import('./webAnalytics');
    expect(a.TIKTOK_PIXEL_ID).toBe('DB34H8JC77U534NEHGPG');
  });

  it('loads nothing without marketing consent', async () => {
    setupDom();
    const a = await import('./webAnalytics');
    a.setConsent({ analytics: true, marketing: false });
    a.trackPixelCustom('ClickStore', { store: 'app_store' });
    a.trackPixel('Lead', { content_name: 'qr_station' });
    expect(ttq()).toBeUndefined();
  });

  it('loads nothing under automation even with full consent', async () => {
    setupDom();
    (globalThis as { navigator: { webdriver: boolean } }).navigator.webdriver = true;
    const a = await import('./webAnalytics');
    a.setConsent({ analytics: true, marketing: true });
    expect(ttq()).toBeUndefined();
  });

  it('loads with marketing consent and mirrors Meta events', async () => {
    setupDom();
    const a = await import('./webAnalytics');
    a.setConsent({ analytics: true, marketing: true });
    const t = ttq()!;
    expect(t._i && 'DB34H8JC77U534NEHGPG' in t._i).toBe(true);
    expect(ttqCalls()).toContainEqual(['page']);

    a.trackPixelCustom('ClickStore', { store: 'app_store' });
    a.trackPixel('Contact');
    a.trackPixel('Lead', { content_name: 'qr_station' });
    a.trackPixel('InitiateCheckout');
    a.trackPixel('PageView');
    expect(tracked()).toEqual(['Download', 'Contact', 'SubmitForm', 'ClickButton']);
  });

  it('a lead reported right after consent reaches TikTok', async () => {
    setupDom();
    const a = await import('./webAnalytics');
    // StationPage: banner decided -> setConsent -> reportLeadAfterConsent -> trackPixel('Lead')
    a.setConsent({ analytics: false, marketing: true });
    a.trackPixel('Lead', { content_name: 'qr_station' });
    expect(tracked()).toEqual(['SubmitForm']);
  });

  it('revoking marketing consent drops TikTok cookies', async () => {
    const written = setupDom('_ttp=abc; ttcsid=def; ttcsid_DB34=ghi; other=1');
    const a = await import('./webAnalytics');
    a.setConsent({ analytics: true, marketing: true });
    a.setConsent({ analytics: true, marketing: false });
    const dropped = written.filter((c) => c.includes('Max-Age=0')).map((c) => c.split('=')[0]);
    expect(dropped).toEqual(expect.arrayContaining(['_ttp', 'ttcsid', 'ttcsid_DB34']));
    expect(dropped).not.toContain('other');
  });
});
