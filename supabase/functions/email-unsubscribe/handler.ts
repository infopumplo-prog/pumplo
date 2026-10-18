// Čistá logika odhlášení (bez Deno importů) — testy: src/lib/emailUnsubscribeHandler.test.ts.
//
//  GET     → jen krátká textová nápověda, NIC nemění. Odkazy v e-mailech otevírají
//            skenery (Outlook Safe Links, firemní filtry), GET proto nesmí odhlašovat.
//  POST    → odhlásí. Volá ho (a) poštovní klient přes List-Unsubscribe-Post (RFC 8058,
//            parametry v URL) a (b) stránka app.pumplo.com/odhlasit po kliknutí na tlačítko
//            (parametry ve formuláři nebo v URL).
//  OPTIONS → CORS preflight pro stránku v appce.
import { isUuid, verifyUnsubToken } from '../_shared/emailUnsubToken.ts';

export interface UnsubscribeDeps {
  secret: string;
  /** Nastaví user_profiles.email_unsubscribed_at (jen když je null). */
  unsubscribe: (userId: string) => Promise<{ error?: string | null }>;
}

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info',
};

export const TEXT_GET_HINT =
  'Odhlášení z e-mailů Pumpla se potvrzuje na stránce https://app.pumplo.com/odhlasit (odkaz v patičce e-mailu). ' +
  'Tento odkaz sám nic nemění.\n\n' +
  'To unsubscribe from Pumplo e-mails, use the link in the e-mail footer (https://app.pumplo.com/odhlasit). This URL changes nothing.\n';

const text = (body: string, status: number) =>
  new Response(body, {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });

async function readPostParams(req: Request): Promise<{ u: string | null; t: string | null }> {
  const url = new URL(req.url);
  let u = url.searchParams.get('u');
  let t = url.searchParams.get('t');
  if (!u || !t) {
    const ct = req.headers.get('content-type') ?? '';
    if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
      const form = await req.formData().catch(() => null);
      u = u || (form?.get('u')?.toString() ?? null);
      t = t || (form?.get('t')?.toString() ?? null);
    } else if (ct.includes('application/json')) {
      const body = (await req.json().catch(() => null)) as { u?: unknown; t?: unknown } | null;
      u = u || (typeof body?.u === 'string' ? body.u : null);
      t = t || (typeof body?.t === 'string' ? body.t : null);
    }
  }
  return { u, t };
}

export async function handleUnsubscribe(req: Request, deps: UnsubscribeDeps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  // GET (i HEAD) nikdy nic nemění — ani s platným tokenem.
  if (req.method === 'GET' || req.method === 'HEAD') return text(TEXT_GET_HINT, 200);
  if (req.method !== 'POST') return new Response(null, { status: 405, headers: { ...corsHeaders, Allow: 'GET, POST, OPTIONS' } });

  if (!deps.secret || deps.secret.length < 16) return text('server not configured', 500);
  const { u, t } = await readPostParams(req);
  if (!isUuid(u) || !(await verifyUnsubToken(u, t, deps.secret))) return text('invalid link', 400);

  const { error } = await deps.unsubscribe(u);
  if (error) return text('unsubscribe failed', 500);
  return text('ok', 200);
}
