import { useNavigate } from 'react-router-dom';
import { Building2, ChevronRight, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { MachineGymEntry } from '@/hooks/useMachineGyms';

interface MachineGymsListProps {
  gyms: MachineGymEntry[];
  isLoading: boolean;
}

const BENCH_CONFIG_LABELS: Record<string, string> = {
  flat: 'Flat',
  incline: 'Incline',
  decline: 'Decline',
};

const MachineGymsList = ({ gyms, isLoading }: MachineGymsListProps) => {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Building2 className="w-4 h-4" />
          Posilovny s tímto strojem
        </div>
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Building2 className="w-4 h-4" />
        Posilovny s tímto strojem ({gyms.length})
      </div>

      {gyms.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          Žádná posilovna nemá tento stroj
        </p>
      ) : (
        <div className="space-y-1">
          {gyms.map((gym) => (
            <div
              key={gym.gym_id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
              onClick={() => navigate(`/admin/gyms/${gym.gym_id}`)}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{gym.gym_name}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant="secondary" className="text-xs">
                    {gym.quantity}x
                  </Badge>
                  {gym.max_weight_kg && (
                    <Badge variant="outline" className="text-xs">
                      max {gym.max_weight_kg} kg
                    </Badge>
                  )}
                  {gym.bench_configs && gym.bench_configs.length > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {gym.bench_configs
                        .map((c) => BENCH_CONFIG_LABELS[c] || c)
                        .join(', ')}
                    </Badge>
                  )}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MachineGymsList;
