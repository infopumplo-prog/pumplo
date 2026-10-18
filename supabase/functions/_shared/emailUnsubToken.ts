// HMAC token pro odhlášení z e-mailů (odkaz v patičce + List-Unsubscribe).
// Čistý modul bez Deno importů: běží v edge funkcích (Deno) i ve vitestu (Node 20,
// globální Web Crypto). Testy: src/lib/emailUnsubToken.test.ts.
//
// Token = base64url(HMAC-SHA256(secret, "pumplo-unsub:v1:" + user_id)).
// Neexpiruje — odkaz v e-mailu musí fungovat i po měsících. Tajemství je env
// EMAIL_UNSUB_SECRET; jeho změna zneplatní všechny staré odkazy.

const TOKEN_PREFIX = 'pumplo-unsub:v1:';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (s: unknown): s is string => typeof s === 'string' && UUID_RE.test(s);

const toBase64Url = (bytes: Uint8Array): string => {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

async function hmac(secret: string, message: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

/** Podepíše user_id. Bez tajemství nebo s neplatným id hází — nikdy nevydat slabý token. */
export async function signUnsubToken(userId: string, secret: string): Promise<string> {
  if (!secret || secret.length < 16) throw new Error('EMAIL_UNSUB_SECRET missing or too short');
  if (!isUuid(userId)) throw new Error('invalid user id');
  return toBase64Url(await hmac(secret, TOKEN_PREFIX + userId.toLowerCase()));
}

/** Porovnání v konstantním čase (délka tokenu je veřejná, obsah ne). */
const safeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

export async function verifyUnsubToken(
  userId: string | null | undefined,
  token: string | null | undefined,
  secret: string | null | undefined,
): Promise<boolean> {
  if (!userId || !token || !secret || secret.length < 16 || !isUuid(userId)) return false;
  const expected = await signUnsubToken(userId, secret);
  return safeEqual(expected, token);
}

/** Odkaz na odhlášení: <base>/functions/v1/email-unsubscribe?u=<id>&t=<token>. */
export async function buildUnsubscribeUrl(supabaseUrl: string, userId: string, secret: string): Promise<string> {
  const t = await signUnsubToken(userId, secret);
  const base = supabaseUrl.replace(/\/+$/, '');
  return `${base}/functions/v1/email-unsubscribe?u=${encodeURIComponent(userId)}&t=${encodeURIComponent(t)}`;
}
