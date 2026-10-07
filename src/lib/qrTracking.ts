// QR funnel logging (stickers on machines + flyers): scan → store_click land in
// qr_events through the public log-qr edge function. Fire-and-forget — tracking
// must never break the page or the store redirect.
import { Capacitor } from '@capacitor/core';
import type { LeadSkipReason } from './leadCapture';

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/log-qr`;

export const APP_STORE_URL = 'https://apps.apple.com/app/pumplo/id6768619318';
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.pumplo.app';

export type QrSource = 'station' | 'flyer';

export const detectPlatform = (): 'ios' | 'android' | 'other' => {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
};

// Inside the Pumplo app (Capacitor) the platform comes from the native shell, not the UA.
const nativePlatform = (): 'ios' | 'android' | null => {
  try {
    if (!Capacitor.isNativePlatform()) return null;
    const p = Capacitor.getPlatform();
    return p === 'ios' || p === 'android' ? p : null;
  } catch { return null; }
};

// The scan the current page-view came from, so a later store click pairs with it.
let lastScan: { code: string; sourceType: QrSource; scanId: string; playStoreUrl: string } | null = null;

// In-flight scan, so prompt events fired right after page load still pair with it.
let pendingScan: Promise<void> | null = null;

export const logQrScan = (sourceType: QrSource, code: string): Promise<void> => {
  const run = async () => {
    try {
      const native = nativePlatform();
      // `native` is sent only from the app: web bodies stay exactly as before.
      const body = native
        ? { action: 'scan', sourceType, code, platform: native, native: true }
        : { action: 'scan', sourceType, code, platform: detectPlatform() };
      const res = await fetch(FN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.scanId) lastScan = { code, sourceType, scanId: data.scanId, playStoreUrl: data.playStoreUrl };
    } catch { /* tracking never breaks the page */ }
  };
  const p = run();
  pendingScan = p;
  return p;
};

// Logs the click and returns the store URL to open (Play URL carries the
// install-referrer of the originating scan when known).
export const logStoreClick = (sourceType: QrSource, code: string): { appStoreUrl: string; playStoreUrl: string } => {
  const scan = lastScan && lastScan.code === code ? lastScan : null;
  try {
    fetch(FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'store_click', sourceType, code, scanId: scan?.scanId ?? null, platform: detectPlatform() }),
      keepalive: true,
    }).catch(() => {});
  } catch { /* noop */ }
  return { appStoreUrl: APP_STORE_URL, playStoreUrl: scan?.playStoreUrl ?? PLAY_STORE_URL };
};

export const getLastScanId = (code: string): string | null => (lastScan && lastScan.code === code ? lastScan.scanId : null);

// Funnel events of the e-mail prompt. Fire-and-forget; waits (bounded) for the
// page's scan so the event carries its scan id. `reason` only for lead_prompt_skipped.
export type LeadPromptAction = 'lead_prompt_shown' | 'lead_prompt_dismissed' | 'lead_prompt_skipped';
const SCAN_WAIT_MS = 3_000;
export const logLeadPromptEvent = async (
  code: string, action: LeadPromptAction,
  opts: { reason?: LeadSkipReason; sourceType?: QrSource } = {},
): Promise<void> => {
  try {
    if (pendingScan) await Promise.race([pendingScan, new Promise((r) => setTimeout(r, SCAN_WAIT_MS))]);
    const body: Record<string, unknown> = {
      action, sourceType: opts.sourceType ?? 'station', code, scanId: getLastScanId(code), platform: nativePlatform() ?? detectPlatform(),
    };
    if (action === 'lead_prompt_skipped' && opts.reason) body.reason = opts.reason;
    await fetch(FN_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
      body: JSON.stringify(body),
    }).catch(() => {});
  } catch { /* noop */ }
};

export const submitLead = async (
  code: string, email: string, lang: 'cs' | 'en', website: string, sourceType: QrSource = 'station',
): Promise<'ok' | 'bad_email' | 'error'> => {
  try {
    const res = await fetch(FN_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'lead', sourceType, code, scanId: getLastScanId(code), platform: detectPlatform(), email, lang, website }),
    });
    if (res.ok) return 'ok';
    if (res.status === 400) {
      const body = await res.json().catch(() => null);
      if (body?.error === 'bad email') return 'bad_email';
    }
    return 'error';
  } catch { return 'error'; }
};
