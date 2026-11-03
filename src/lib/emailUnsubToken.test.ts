// Testy HMAC tokenu pro odhlášení z e-mailů (F0 18. 10.). Modul žije v edge
// funkcích (supabase/functions/_shared) bez Deno importů.
import { describe, it, expect } from 'vitest';
import {
  buildUnsubscribeUrl,
  isUuid,
  signUnsubToken,
  verifyUnsubToken,
} from '../../supabase/functions/_shared/emailUnsubToken';

const SECRET = 'test-secret-0123456789abcdef';
const USER = '3f2b8c1e-4a5d-4e6f-9a0b-1c2d3e4f5a6b';
const OTHER = '00000000-0000-4000-8000-000000000002';

describe('emailUnsubToken', () => {
  it('podepíše deterministicky a ověří vlastní token', async () => {
    const a = await signUnsubToken(USER, SECRET);
    const b = await signUnsubToken(USER, SECRET);
    expect(a).toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 B HMAC v base64url bez paddingu
    expect(await verifyUnsubToken(USER, a, SECRET)).toBe(true);
  });

  it('id nezávisí na velikosti písmen', async () => {
    const t = await signUnsubToken(USER, SECRET);
    expect(await verifyUnsubToken(USER.toUpperCase(), t, SECRET)).toBe(true);
  });

  it('odmítne token jiného uživatele, jiné tajemství a pozměněný token', async () => {
    const t = await signUnsubToken(USER, SECRET);
    expect(await verifyUnsubToken(OTHER, t, SECRET)).toBe(false);
    expect(await verifyUnsubToken(USER, t, 'another-secret-0123456789')).toBe(false);
    const flipped = (t[0] === 'A' ? 'B' : 'A') + t.slice(1);
    expect(await verifyUnsubToken(USER, flipped, SECRET)).toBe(false);
    expect(await verifyUnsubToken(USER, t.slice(0, -1), SECRET)).toBe(false);
  });

  it('chybějící vstupy a krátké tajemství nikdy neprojdou', async () => {
    const t = await signUnsubToken(USER, SECRET);
    expect(await verifyUnsubToken(null, t, SECRET)).toBe(false);
    expect(await verifyUnsubToken(USER, null, SECRET)).toBe(false);
    expect(await verifyUnsubToken(USER, t, '')).toBe(false);
    expect(await verifyUnsubToken(USER, t, 'short')).toBe(false);
    expect(await verifyUnsubToken('not-a-uuid', t, SECRET)).toBe(false);
    await expect(signUnsubToken(USER, 'short')).rejects.toThrow();
    await expect(signUnsubToken('x', SECRET)).rejects.toThrow();
  });

  it('postaví odkaz na funkci email-unsubscribe', async () => {
    const url = await buildUnsubscribeUrl('https://abc.supabase.co/', USER, SECRET);
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe('https://abc.supabase.co/functions/v1/email-unsubscribe');
    expect(u.searchParams.get('u')).toBe(USER);
    expect(await verifyUnsubToken(u.searchParams.get('u'), u.searchParams.get('t'), SECRET)).toBe(true);
  });

  it('isUuid', () => {
    expect(isUuid(USER)).toBe(true);
    expect(isUuid('nope')).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});
