// Potvrzení odhlášení z e-mailů na stránce /odhlasit (F0 e-maily, 18. 10. 2026).
// Odhlašuje jen POST na edge funkci email-unsubscribe; otevření stránky nic nemění.

export type UnsubscribeParams = { u: string; t: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Parametry z odkazu v patičce; neúplný nebo zjevně špatný odkaz → null. */
export function parseUnsubscribeParams(search: string): UnsubscribeParams | null {
  const p = new URLSearchParams(search);
  const u = p.get('u') ?? '';
  const t = p.get('t') ?? '';
  if (!UUID_RE.test(u) || !/^[A-Za-z0-9_-]{20,}$/.test(t)) return null;
  return { u, t };
}

/**
 * POST jako form-urlencoded = „simple request“ bez CORS preflightu a bez apikey.
 * Vrací 'ok' | 'invalid' (neplatný odkaz) | 'error'.
 */
export async function confirmUnsubscribe(
  supabaseUrl: string,
  params: UnsubscribeParams,
  fetchImpl: typeof fetch = fetch,
): Promise<'ok' | 'invalid' | 'error'> {
  try {
    const res = await fetchImpl(`${supabaseUrl.replace(/\/+$/, '')}/functions/v1/email-unsubscribe`, {
      method: 'POST',
      body: new URLSearchParams({ u: params.u, t: params.t }),
    });
    if (res.ok) return 'ok';
    return res.status === 400 ? 'invalid' : 'error';
  } catch {
    return 'error';
  }
}
