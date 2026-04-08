import { useGym } from '@/contexts/GymContext';
import { useGymMachines } from '@/hooks/useGymMachines';
import { QRCodeCard } from '@/components/business/QRCodeCard';
import { QrCode, Loader2 } from 'lucide-react';

const GymQRCodes = () => {
  const { gym } = useGym();
  const { machines, isLoading } = useGymMachines(gym?.id || null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#4CC9FF' }} />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <QrCode className="w-6 h-6" style={{ color: '#4CC9FF' }} />
        <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: 700 }}>QR kódy</h1>
      </div>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '24px' }}>
        QR kódy pro vaše cvičiště. Stáhněte a vytiskněte na samolepky.
      </p>
      {machines.length === 0 ? (
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
          Zatím nemáte přidané žádné stroje.
        </p>
      ) : (
        <div className="space-y-3">
          {machines.map((m) => (
            <QRCodeCard
              key={m.id}
              shortCode={m.short_code}
              machineName={m.machine?.name || 'Stroj'}
              quantity={m.quantity || 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default GymQRCodes;
