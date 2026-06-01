import { X, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { changeLanguage } from '@/i18n';
import i18n from '@/i18n';

interface StationBannerProps {
  gymName: string;
  gymIsVerified?: boolean;
  onDismiss?: () => void;
}

export const StationBanner = ({ gymName, gymIsVerified, onDismiss }: StationBannerProps) => {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-3 py-2.5"
      style={{ background: '#0B1222', borderBottom: '1px solid rgba(76, 201, 255, 0.2)' }}>
      <div className="flex items-center gap-3">
        <img src="/pumplo-icon.png" alt="Pumplo" className="w-8 h-8 rounded-lg"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        <div>
          <p style={{ color: '#fff', fontSize: '13px', fontWeight: 600 }}>Pumplo</p>
          <div className="flex items-center gap-1">
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>{gymName}</p>
            {gymIsVerified && (
              <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex gap-0.5">
          {(['cs', 'en'] as const).map((lang) => (
            <button key={lang} onClick={() => changeLanguage(lang)}
              className="text-base transition-opacity"
              style={{ opacity: i18n.language === lang ? 1 : 0.35 }}>
              {lang === 'cs' ? '🇨🇿' : '🇬🇧'}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => { setDismissed(true); onDismiss?.(); }}
          className="p-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
