import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Check, X, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePublishedGyms } from '@/hooks/usePublishedGyms';
import { getTodayOpeningStatus } from '@/lib/gymUtils';
import { cn } from '@/lib/utils';

interface GymSelectorProps {
  onSelect: (gymId: string) => void;
  onCancel: () => void;
  selectedGymId?: string | null;
}

export const GymSelector = ({ onSelect, onCancel, selectedGymId }: GymSelectorProps) => {
  const { gyms, isLoading } = usePublishedGyms();
  const [selected, setSelected] = useState<string | null>(selectedGymId || null);

  // Filter to only show open gyms first
  const sortedGyms = [...gyms].sort((a, b) => {
    const aStatus = getTodayOpeningStatus(a.opening_hours as any);
    const bStatus = getTodayOpeningStatus(b.opening_hours as any);
    
    // Open gyms first
    if (aStatus.isOpen && !bStatus.isOpen) return -1;
    if (!aStatus.isOpen && bStatus.isOpen) return 1;
    
    return a.name.localeCompare(b.name);
  });

  const handleConfirm = () => {
    if (selected) {
      onSelect(selected);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold">Kde budeš cvičit?</h1>
          <p className="text-sm text-muted-foreground">Vyber posilovnu pro dnešní trénink</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Gym List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-32">
        {isLoading ? (
          <>
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </>
        ) : sortedGyms.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Žádné posilovny nejsou k dispozici</p>
          </div>
        ) : (
          sortedGyms.map((gym) => {
            const status = getTodayOpeningStatus(gym.opening_hours as any);
            const isSelected = selected === gym.id;
            const isDisabled = !status.isOpen;
            
            return (
              <motion.button
                key={gym.id}
                onClick={() => !isDisabled && setSelected(gym.id)}
                disabled={isDisabled}
                className={cn(
                  "w-full p-4 rounded-xl border-2 transition-all text-left",
                  isSelected
                    ? "border-primary bg-primary/5"
                    : isDisabled
                      ? "border-border bg-muted/30 opacity-50"
                      : "border-border bg-card hover:border-primary/50"
                )}
                whileTap={!isDisabled ? { scale: 0.98 } : undefined}
              >
                <div className="flex items-start gap-3">
                  {/* Logo/Icon */}
                  <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {gym.logo_url ? (
                      <img 
                        src={gym.logo_url} 
                        alt={gym.name} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Building2 className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{gym.name}</h3>
                    {gym.address && (
                      <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {gym.address}
                      </p>
                    )}
                    <p className={cn(
                      "text-xs mt-1",
                      status.isOpen 
                        ? status.closingSoon 
                          ? "text-orange-500" 
                          : "text-green-600"
                        : "text-destructive"
                    )}>
                      {status.text}
                    </p>
                  </div>

                  {/* Selection indicator */}
                  <div className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                    isSelected
                      ? "border-primary bg-primary"
                      : "border-muted-foreground"
                  )}>
                    {isSelected && (
                      <Check className="w-4 h-4 text-primary-foreground" />
                    )}
                  </div>
                </div>
              </motion.button>
            );
          })
        )}
      </div>

      {/* Confirm Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border safe-bottom">
        <Button 
          size="lg" 
          className="w-full gap-2"
          onClick={handleConfirm}
          disabled={!selected}
        >
          <MapPin className="w-5 h-5" />
          Potvrdit výběr
        </Button>
      </div>
    </motion.div>
  );
};
