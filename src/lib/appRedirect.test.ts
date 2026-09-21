import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { openAppOrStore, APP_STORE_URL, PLAY_STORE_URL } from './appRedirect';

const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; motorola edge 40) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15';

/** Every URL the code navigated to, in order. */
let navigations: string[] = [];

const setupBrowser = (userAgent: string) => {
  navigations = [];
  const location = {
    get href() { return navigations[navigations.length - 1] ?? 'https://app.pumplo.com/s/abc'; },
    set href(url: string) { navigations.push(url); },
  };
  vi.stubGlobal('navigator', { userAgent });
  vi.stubGlobal('window', {
    location,
    addEventListener: () => {},
    removeEventListener: () => {},
    setTimeout: (fn: () => void, ms?: number) => setTimeout(fn, ms),
  });
  iframes = [];
  vi.stubGlobal('document', {
    addEventListener: () => {},
    removeEventListener: () => {},
    visibilityState: 'visible',
    hidden: false,
    createElement: (tag: string) => { const el = { tag, src: '', style: {}, remove: () => {} }; if (tag === 'iframe') iframes.push(el); return el; },
    body: { appendChild: () => {} },
  });
};

/** Hidden iframes the code created (iOS custom-scheme attempt). */
let iframes: { src: string }[] = [];

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('openAppOrStore', () => {
  it('iOS: tries the app through a hidden iframe, never via location (Safari would show a blocking alert)', () => {
    setupBrowser(IOS_UA);

    const attempted = openAppOrStore('plan/abc');

    expect(attempted).toBe(true);
    expect(iframes.map((f) => f.src)).toEqual(['com.pumplo.app://plan/abc']);
    expect(navigations.some((url) => url.startsWith('com.pumplo.app://'))).toBe(false);
  });

  it('iOS: falls back to the App Store only after the attempt, while the page is still visible', () => {
    setupBrowser(IOS_UA);

    openAppOrStore('station');
    expect(navigations).toEqual([]);
    vi.advanceTimersByTime(1799);
    expect(navigations).toEqual([]);
    vi.advanceTimersByTime(2);

    expect(navigations).toEqual([APP_STORE_URL]);
  });

  it('iOS: does not go to the App Store when the app took over (page hidden)', () => {
    setupBrowser(IOS_UA);

    openAppOrStore('station');
    (globalThis.document as unknown as { hidden: boolean }).hidden = true;
    vi.advanceTimersByTime(5000);

    expect(navigations).toEqual([]);
  });

  it('keeps the Android intent URL with its Play Store fallback', () => {
    setupBrowser(ANDROID_UA);

    const attempted = openAppOrStore('station');

    expect(attempted).toBe(true);
    expect(navigations).toHaveLength(1);
    expect(navigations[0]).toContain('intent://station');
    expect(navigations[0]).toContain('scheme=com.pumplo.app');
    expect(navigations[0]).toContain(`S.browser_fallback_url=${encodeURIComponent(PLAY_STORE_URL)}`);
  });

  it('does not navigate on desktop — the caller decides', () => {
    setupBrowser(DESKTOP_UA);

    const attempted = openAppOrStore('station');
    vi.advanceTimersByTime(5000);

    expect(attempted).toBe(false);
    expect(navigations).toEqual([]);
  });
});
