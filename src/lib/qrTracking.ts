// QR funnel logging (stickers on machines + flyers): scan → store_click land in
// qr_events through the public log-qr edge function. Fire-and-forget — tracking
// must never break the page or the store redirect.
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

// The scan the current page-view came from, so a later store click pairs with it.
let lastScan: { code: string; sourceType: QrSource; scanId: string; playStoreUrl: string } | null = null;

export const logQrScan = async (sourceType: QrSource, code: string): Promise<void> => {
  try {
    const res = await fetch(FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'scan', sourceType, code, platform: detectPlatform() }),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data?.scanId) lastScan = { code, sourceType, scanId: data.scanId, playStoreUrl: data.playStoreUrl };
  } catch { /* tracking never breaks the page */ }
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
