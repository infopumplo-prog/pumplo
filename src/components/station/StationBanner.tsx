import { X } from 'lucide-react';
import { useState } from 'react';

interface StationBannerProps {
  gymName: string;
  onDismiss?: () => void;
}

export const StationBanner = ({ gymName, onDismiss }: StationBannerProps) => {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const getStoreLink = () => {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(ua)) return '/auth';
    if (/Android/i.test(ua)) return '/auth';
    return '/auth';
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-3 py-2.5"
      style={{ background: '#0B1222', borderBottom: '1px solid rgba(76, 201, 255, 0.2)' }}>
      <div className="flex items-center gap-3">
        <img src="/pumplo-icon.png" alt="Pumplo" className="w-8 h-8 rounded-lg"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        <div>
          <p style={{ color: '#fff', fontSize: '13px', fontWeight: 600 }}>Pumplo</p>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>{gymName}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <a href={getStoreLink()}
          className="px-4 py-1.5 rounded-full text-sm font-semibold"
          style={{ background: '#4CC9FF', color: '#fff', fontSize: '13px' }}>
          Otevřít
        </a>
        <button type="button" onClick={() => { setDismissed(true); onDismiss?.(); }}
          className="p-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
