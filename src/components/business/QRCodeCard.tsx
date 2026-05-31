import { useRef, useEffect } from 'react';
import { Download } from 'lucide-react';
import { generateStationQR, downloadQRAsPNG } from '@/lib/qrGenerator';

interface QRCodeCardProps {
  shortCode: string;
  machineName: string;
  quantity: number;
}

export const QRCodeCard = ({ shortCode, machineName, quantity }: QRCodeCardProps) => {
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!qrRef.current) return;
    qrRef.current.innerHTML = '';
    const qr = generateStationQR(shortCode, 200);
    qr.append(qrRef.current);
  }, [shortCode]);

  return (
    <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <div className="flex items-start gap-4">
        <div ref={qrRef} className="shrink-0 rounded-lg overflow-hidden" style={{ width: '100px', height: '100px' }} />
        <div className="flex-1 min-w-0">
          <p style={{ color: '#fff', fontSize: '15px', fontWeight: 600 }}>{machineName}</p>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginTop: '2px' }}>
            {quantity}x samolepek
          </p>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginTop: '4px', fontFamily: 'monospace' }}>
            {shortCode}
          </p>
        </div>
        <button type="button" onClick={() => downloadQRAsPNG(shortCode, machineName)}
          className="shrink-0 p-2 rounded-lg"
          style={{ background: 'rgba(76, 201, 255, 0.1)', color: '#4CC9FF' }}>
          <Download className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
