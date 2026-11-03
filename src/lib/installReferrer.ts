// Google Play install referrer → install source. QR posters link to Play with
// `&referrer=pumplo_scan_<scanId>` (supabase/functions/log-qr).
export type InstallAttribution = { installSource: string | null; scanId: string | null };

const SCAN_PREFIX = 'pumplo_scan_';
// GA4 user property values are limited to 36 characters.
const MAX_SOURCE = 36;

const decode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };

export const parseInstallReferrer = (raw: string | null | undefined): InstallAttribution => {
  const none = { installSource: null, scanId: null };
  if (!raw) return none;
  const referrer = decode(raw.trim());
  if (referrer.startsWith(SCAN_PREFIX)) {
    const scanId = referrer.slice(SCAN_PREFIX.length).split('&')[0].replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
    return scanId ? { installSource: 'qr_scan', scanId } : none;
  }
  const source = new URLSearchParams(referrer).get('utm_source')?.trim();
  return source ? { installSource: source.slice(0, MAX_SOURCE), scanId: null } : none;
};
