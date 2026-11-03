// GET na odhlašovací funkci NESMÍ odhlásit (skenery odkazů prefetchují), POST ano.
import { describe, it, expect, vi } from 'vitest';
import { handleUnsubscribe } from '../../supabase/functions/email-unsubscribe/handler';
import { buildUnsubscribePageUrl, buildUnsubscribeUrl, signUnsubToken } from '../../supabase/functions/_shared/emailUnsubToken';
import { confirmUnsubscribe, parseUnsubscribeParams } from './emailUnsubscribe';

const SECRET = 'test-secret-0123456789abcdef';
const USER = '3f2b8c1e-4a5d-4e6f-9a0b-1c2d3e4f5a6b';
const FN = 'https://abc.supabase.co/functions/v1/email-unsubscribe';

const deps = () => {
  const unsubscribe = vi.fn(async () => ({ error: null }));
  return { secret: SECRET, unsubscribe };
};

describe('handleUnsubscribe', () => {
  it('GET s platným tokenem nic nemění a vrací jen nápovědu', async () => {
    const d = deps();
    const url = await buildUnsubscribeUrl('https://abc.supabase.co', USER, SECRET);
    const res = await handleUnsubscribe(new Request(url), d);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('app.pumplo.com/odhlasit');
    expect(d.unsubscribe).not.toHaveBeenCalled();
    await handleUnsubscribe(new Request(url, { method: 'HEAD' }), d);
    expect(d.unsubscribe).not.toHaveBeenCalled();
  });

  it('one-click POST (RFC 8058, parametry v URL) odhlásí', async () => {
    const d = deps();
    const url = await buildUnsubscribeUrl('https://abc.supabase.co', USER, SECRET);
    const res = await handleUnsubscribe(new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'List-Unsubscribe=One-Click',
    }), d);
    expect(res.status).toBe(200);
    expect(d.unsubscribe).toHaveBeenCalledWith(USER);
  });

  it('POST z formuláře stránky /odhlasit odhlásí', async () => {
    const d = deps();
    const t = await signUnsubToken(USER, SECRET);
    const res = await handleUnsubscribe(new Request(FN, { method: 'POST', body: new URLSearchParams({ u: USER, t }) }), d);
    expect(res.status).toBe(200);
    expect(d.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('POST se špatným tokenem 400 a nic', async () => {
    const d = deps();
    const res = await handleUnsubscribe(new Request(`${FN}?u=${USER}&t=xxxxxxxxxxxxxxxxxxxxxxxxxxxx`, { method: 'POST' }), d);
    expect(res.status).toBe(400);
    expect(d.unsubscribe).not.toHaveBeenCalled();
  });

  it('chyba DB → 500; OPTIONS → CORS', async () => {
    const t = await signUnsubToken(USER, SECRET);
    const res = await handleUnsubscribe(new Request(`${FN}?u=${USER}&t=${t}`, { method: 'POST' }), {
      secret: SECRET, unsubscribe: async () => ({ error: 'boom' }),
    });
    expect(res.status).toBe(500);
    const opt = await handleUnsubscribe(new Request(FN, { method: 'OPTIONS' }), deps());
    expect(opt.status).toBe(204);
    expect(opt.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});

describe('stránka /odhlasit', () => {
  it('odkaz v patičce vede na stránku a parametry jdou přečíst', async () => {
    const url = new URL(await buildUnsubscribePageUrl(USER, SECRET));
    expect(url.origin + url.pathname).toBe('https://app.pumplo.com/odhlasit');
    expect(parseUnsubscribeParams(url.search)).toEqual({ u: USER, t: await signUnsubToken(USER, SECRET) });
    expect(parseUnsubscribeParams('?u=x&t=y')).toBeNull();
    expect(parseUnsubscribeParams('')).toBeNull();
  });

  it('tlačítko posílá POST a celý řetěz odhlásí', async () => {
    const d = deps();
    const params = parseUnsubscribeParams(new URL(await buildUnsubscribePageUrl(USER, SECRET)).search)!;
    const fetchImpl = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
      handleUnsubscribe(new Request(String(input), init), d)) as unknown as typeof fetch;
    expect(await confirmUnsubscribe('https://abc.supabase.co/', params, fetchImpl)).toBe('ok');
    const [calledUrl, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(calledUrl).toBe(FN);
    expect(init.method).toBe('POST');
    expect(d.unsubscribe).toHaveBeenCalledWith(USER);
    expect(await confirmUnsubscribe('https://abc.supabase.co', { u: USER, t: 'bad-token-bad-token-bad' }, fetchImpl)).toBe('invalid');
    const offline = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    expect(await confirmUnsubscribe('https://abc.supabase.co', params, offline)).toBe('error');
  });
});
