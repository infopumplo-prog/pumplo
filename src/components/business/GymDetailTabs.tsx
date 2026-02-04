import { useState } from 'react';
import { Clock, ChevronDown, Dumbbell, CreditCard, Users } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { OpeningHours, GymMachine } from '@/hooks/useGym';
import { isGymCurrentlyOpen, getTodayOpeningStatus, isClosingSoon } from '@/lib/gymUtils';
import { cn } from '@/lib/utils';

const DAYS = [
  { key: 'monday', label: 'Pondělí' },
  { key: 'tuesday', label: 'Úterý' },
  { key: 'wednesday', label: 'Středa' },
  { key: 'thursday', label: 'Čtvrtek' },
  { key: 'friday', label: 'Pátek' },
  { key: 'saturday', label: 'Sobota' },
  { key: 'sunday', label: 'Neděle' },
];

// Keywords to identify free weights
const FREE_WEIGHT_KEYWORDS = [
  'barbell', 'dumbbell', 'kettlebell', 'činka', 
  'jednoručka', 'olymp', 'osa', 'kotouč', 'činky'
];

const isFreeWeight = (machineName: string): boolean => {
  const name = machineName.toLowerCase();
  return FREE_WEIGHT_KEYWORDS.some(kw => name.includes(kw));
};

interface GymDetailTabsProps {
  hours: OpeningHours;
  machines: GymMachine[];
  machinesLoading: boolean;
}

const GymDetailTabs = ({ hours, machines, machinesLoading }: GymDetailTabsProps) => {
  const [hoursOpen, setHoursOpen] = useState(false);
  const isOpen = isGymCurrentlyOpen(hours);
  const status = getTodayOpeningStatus(hours);
  const closingSoon = isClosingSoon(hours);

  // Categorize machines
  const freeWeights = machines.filter(m => isFreeWeight(m.machine?.name || ''));
  const machineEquipment = machines.filter(m => !isFreeWeight(m.machine?.name || ''));

  const renderEquipmentList = (items: GymMachine[]) => (
    <div className="space-y-1">
      {items.map((gm) => (
        <div 
          key={gm.id}
          className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/30 text-sm"
        >
          <span className="font-medium">{gm.machine?.name}</span>
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            {gm.quantity > 1 && <span>{gm.quantity}×</span>}
            {gm.max_weight_kg && <span>max {gm.max_weight_kg}kg</span>}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="w-full grid grid-cols-3 h-auto p-1">
        <TabsTrigger value="overview" className="text-xs py-2">Přehled</TabsTrigger>
        <TabsTrigger value="machines" className="text-xs py-2">Stroje</TabsTrigger>
        <TabsTrigger value="pricing" className="text-xs py-2">Ceník</TabsTrigger>
      </TabsList>

      {/* Overview Tab */}
      <TabsContent value="overview" className="mt-4 space-y-4">
        {/* Opening Hours Collapsible */}
        <Collapsible open={hoursOpen} onOpenChange={setHoursOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full py-3 px-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-muted-foreground" />
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  closingSoon ? "bg-amber-500 animate-pulse" : isOpen ? "bg-green-500" : "bg-destructive"
                )} />
                <span className={cn(
                  "font-medium",
                  closingSoon ? "text-amber-600" : isOpen ? "text-green-600" : "text-destructive"
                )}>
                  {isOpen ? "Otevřeno" : "Zavřeno"}
                </span>
                <span className="text-muted-foreground text-sm">• {status.text}</span>
              </div>
            </div>
            <ChevronDown className={cn(
              "w-5 h-5 text-muted-foreground transition-transform",
              hoursOpen && "rotate-180"
            )} />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="bg-muted/30 rounded-lg p-4 space-y-2">
              {DAYS.map((day) => {
                const dayHours = hours[day.key];
                const isClosed = dayHours?.closed;
                return (
                  <div key={day.key} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{day.label}</span>
                    {isClosed ? (
                      <span className="text-destructive">Zavřeno</span>
                    ) : (
                      <span className="font-medium">{dayHours?.open} - {dayHours?.close}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Attendance placeholder */}
        <div className="py-3 px-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Users className="w-5 h-5" />
            <span className="text-sm">Průměrná návštěvnost - připravujeme</span>
          </div>
        </div>
      </TabsContent>

      {/* Machines Tab */}
      <TabsContent value="machines" className="mt-4">
        {machinesLoading ? (
          <div className="text-sm text-muted-foreground py-4 text-center">Načítám...</div>
        ) : machines.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            Žádné vybavení není uvedeno
          </div>
        ) : (
          <div className="space-y-6">
            {/* Machines section */}
            {machineEquipment.length > 0 && (
              <div>
                <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                  <Dumbbell className="w-4 h-4" />
                  Stroje ({machineEquipment.length})
                </h5>
                {renderEquipmentList(machineEquipment)}
              </div>
            )}

            {/* Free weights section */}
            {freeWeights.length > 0 && (
              <div>
                <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                  💪 Volné váhy ({freeWeights.length})
                </h5>
                {renderEquipmentList(freeWeights)}
              </div>
            )}
          </div>
        )}
      </TabsContent>

      {/* Pricing Tab */}
      <TabsContent value="pricing" className="mt-4">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <CreditCard className="w-12 h-12 text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground text-sm">
            Ceník bude brzy dostupný
          </p>
        </div>
      </TabsContent>
    </Tabs>
  );
};

export default GymDetailTabs;
