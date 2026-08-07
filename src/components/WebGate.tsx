import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { isPlainBrowser, isPublicWebPath } from '@/lib/webGate';
import { openAppOrStore, APP_STORE_URL, PLAY_STORE_URL } from '@/lib/appRedirect';

const BG = '#0B1222';
const ACCENT = '#4CC9FF';

/**
 * Intercepts gated routes in a plain browser tab: pushes mobile users into the
 * app (or store) and shows desktop users a download screen. Public allowlist
 * paths, native builds and installed PWAs render their children normally.
 */
const WebGate = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const gated = isPlainBrowser() && !isPublicWebPath(pathname);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    if (!gated) return;
    // openAppOrStore returns false on desktop (no app to open) — show download
    // screen; on mobile it has already navigated to the app/store.
    const attempted = openAppOrStore('');
    setIsDesktop(!attempted);
  }, [gated, pathname]);

  if (!gated) return <>{children}</>;

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center px-6 text-center"
      style={{ background: BG, color: '#E6EDF7' }}
    >
      <div className="max-w-sm w-full">
        <div
          className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center text-2xl font-bold"
          style={{ background: `${ACCENT}1A`, color: ACCENT }}
        >
          P
        </div>

        <h1 className="text-2xl font-bold mb-2">Pokračujte v aplikaci Pumplo</h1>
        <p className="text-sm mb-8" style={{ color: '#9FB0C9' }}>
          {isDesktop
            ? 'Pumplo používejte v mobilní aplikaci. Stáhněte si ji zdarma:'
            : 'Otevíráme aplikaci… Pokud se neotevřela, stáhněte si ji:'}
        </p>

        {!isDesktop && (
          <button
            onClick={() => openAppOrStore('')}
            className="w-full rounded-xl py-3 px-4 font-semibold mb-4"
            style={{ background: ACCENT, color: BG }}
          >
            Otevřít aplikaci
          </button>
        )}

        <div className="flex flex-col gap-3">
          <a
            href={APP_STORE_URL}
            className="w-full rounded-xl py-3 px-4 font-medium border"
            style={{ borderColor: '#27324A', color: '#E6EDF7' }}
          >
            App Store (iOS)
          </a>
          <a
            href={PLAY_STORE_URL}
            className="w-full rounded-xl py-3 px-4 font-medium border"
            style={{ borderColor: '#27324A', color: '#E6EDF7' }}
          >
            Google Play (Android)
          </a>
        </div>
      </div>
    </div>
  );
};

export default WebGate;
