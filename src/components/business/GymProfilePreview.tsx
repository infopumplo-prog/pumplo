import { useState } from 'react';
import { Gym, OpeningHours, GymMachine } from '@/hooks/useGym';
import { PublicGym } from '@/hooks/usePublishedGyms';
import { useGymMachines } from '@/hooks/useGymMachines';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, ChevronDown, Dumbbell, AlertTriangle } from 'lucide-react';
import { isGymCurrentlyOpen, getTodayOpeningStatus, isClosingSoon } from '@/lib/gymUtils';
import { getEquipmentTypeLabel } from '@/lib/equipmentTypes';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

const DAYS = [
  { key: 'monday', label: 'Pondělí' },
  { key: 'tuesday', label: 'Úterý' },
  { key: 'wednesday', label: 'Středa' },
  { key: 'thursday', label: 'Čtvrtek' },
  { key: 'friday', label: 'Pátek' },
  { key: 'saturday', label: 'Sobota' },
  { key: 'sunday', label: 'Neděle' },
];

const DAYS_SHORT = [
  { key: 'monday', label: 'Po' },
  { key: 'tuesday', label: 'Út' },
  { key: 'wednesday', label: 'St' },
  { key: 'thursday', label: 'Čt' },
  { key: 'friday', label: 'Pá' },
  { key: 'saturday', label: 'So' },
  { key: 'sunday', label: 'Ne' },
];

// Accept both Gym (with owner_id) and PublicGym (without owner_id)
type GymData = Gym | PublicGym;

interface GymProfilePreviewProps {
  gym: GymData;
  variant?: 'default' | 'drawer';
  showBadge?: boolean;
}

const GymProfilePreview = ({ gym, variant = 'default', showBadge = true }: GymProfilePreviewProps) => {
  const hours = gym.opening_hours as OpeningHours;
  const isOpen = isGymCurrentlyOpen(hours);
  const status = getTodayOpeningStatus(hours);
  const closingSoon = isClosingSoon(hours);
  const { machines, isLoading: machinesLoading } = useGymMachines(gym.id);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [machinesOpen, setMachinesOpen] = useState(false);

  const isDrawer = variant === 'drawer';

  // Group machines by equipment type
  const groupedMachines = machines.reduce((acc, gm) => {
    const type = gm.machine?.equipment_type || 'Ostatní';
    if (!acc[type]) acc[type] = [];
    acc[type].push(gm);
    return acc;
  }, {} as Record<string, GymMachine[]>);

  return (
    <div className={cn(
      "overflow-hidden bg-background",
      !isDrawer && "rounded-xl border shadow-sm",
      isDrawer && "rounded-t-[10px]"
    )}>
      {/* Cover Photo with Gradient */}
      <div className={cn("relative", isDrawer ? "h-48" : "h-40")}>
        {gym.cover_photo_url ? (
          <img 
            src={gym.cover_photo_url} 
            alt={gym.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5" />
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        
        {/* Logo */}
        <div className="absolute bottom-0 left-4 translate-y-1/2">
          {gym.logo_url ? (
            <img 
              src={gym.logo_url}
              alt={`${gym.name} logo`}
              className="w-20 h-20 rounded-full border-4 border-background object-cover shadow-lg"
            />
          ) : (
            <div className="w-20 h-20 rounded-full border-4 border-background bg-primary/10 flex items-center justify-center shadow-lg">
              <MapPin className="w-8 h-8 text-primary" />
            </div>
          )}
        </div>
        
        {/* Status Badge */}
        {showBadge && (
          <div className="absolute top-3 right-3">
            <Badge variant={gym.is_published ? 'default' : 'secondary'}>
              {gym.is_published ? 'Veřejná' : 'Soukromá'}
            </Badge>
          </div>
        )}

        {/* Closing Soon Badge */}
        {closingSoon && (
          <div className="absolute top-3 left-3">
            <Badge variant="outline" className="bg-amber-500/90 text-white border-amber-500 animate-pulse">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Brzy zavírá
            </Badge>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="pt-12 pb-4 px-4 space-y-3">
        <div>
          <h3 className="font-bold text-lg">{gym.name}</h3>
          {gym.address && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
              <MapPin className="w-3.5 h-3.5" />
              {gym.address}
            </div>
          )}
        </div>

        {/* Today's Status */}
        <div className={cn(
          "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-sm font-medium",
          closingSoon ? "bg-amber-100 text-amber-700" : isOpen ? "bg-green-100 text-green-700" : "bg-destructive/10 text-destructive"
        )}>
          <div className={cn(
            "w-2 h-2 rounded-full",
            closingSoon ? "bg-amber-500 animate-pulse" : isOpen ? "bg-green-500" : "bg-destructive"
          )} />
          {status.text}
        </div>

        {gym.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{gym.description}</p>
        )}

        {/* Opening Hours - Interactive */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground text-xs">Klikni na den pro zobrazení hodin</span>
          </div>
          <div className="flex gap-1 flex-wrap">
            {DAYS_SHORT.map((day, index) => {
              const dayHours = hours[day.key];
              const isClosed = dayHours?.closed;
              const isSelected = selectedDay === day.key;
              return (
                <button
                  key={day.key}
                  onClick={() => setSelectedDay(isSelected ? null : day.key)}
                  className={cn(
                    "px-2 py-1 text-xs rounded transition-all",
                    isClosed 
                      ? 'bg-destructive/10 text-destructive hover:bg-destructive/20' 
                      : 'bg-primary/10 text-primary hover:bg-primary/20',
                    isSelected && !isClosed && 'bg-primary text-primary-foreground',
                    isSelected && isClosed && 'bg-destructive text-destructive-foreground'
                  )}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
          
          {/* Selected Day Hours */}
          {selectedDay && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm animate-in fade-in-0 slide-in-from-top-2">
              <div className="font-medium">
                {DAYS.find(d => d.key === selectedDay)?.label}
              </div>
              {hours[selectedDay]?.closed ? (
                <span className="text-destructive">Zavřeno</span>
              ) : (
                <span className="text-foreground">
                  {hours[selectedDay]?.open} - {hours[selectedDay]?.close}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Machines Collapsible */}
        <Collapsible open={machinesOpen} onOpenChange={setMachinesOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium hover:bg-muted/50 rounded-lg px-2 transition-colors">
            <div className="flex items-center gap-2">
              <Dumbbell className="w-4 h-4 text-muted-foreground" />
              <span>Vybavení posilovny ({machines.length})</span>
            </div>
            <ChevronDown className={cn(
              "w-4 h-4 text-muted-foreground transition-transform",
              machinesOpen && "rotate-180"
            )} />
          </CollapsibleTrigger>
          <CollapsibleContent className="animate-in fade-in-0 slide-in-from-top-2">
            <div className="pt-2 space-y-4">
              {machinesLoading ? (
                <div className="text-sm text-muted-foreground">Načítám...</div>
              ) : machines.length === 0 ? (
                <div className="text-sm text-muted-foreground">Žádné vybavení není uvedeno</div>
              ) : (
                Object.entries(groupedMachines).map(([type, items]) => (
                  <div key={type}>
                    <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      {getEquipmentTypeLabel(type)}
                    </h5>
                    <div className="space-y-1">
                      {items.map((gm) => (
                        <div 
                          key={gm.id}
                          className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/30 text-sm"
                        >
                          <span className="font-medium">{gm.machine?.name}</span>
                          <div className="flex items-center gap-2 text-muted-foreground text-xs">
                            {gm.quantity > 1 && <span>{gm.quantity}×</span>}
                            {gm.max_weight_kg && <span>max {gm.max_weight_kg}kg</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
};

export default GymProfilePreview;
