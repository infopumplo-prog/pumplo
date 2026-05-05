import { useState } from 'react';
import { Clock, ChevronDown, Dumbbell, CreditCard, Users, Search, Sun, Sparkles } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { OpeningHours, GymMachine } from '@/hooks/useGym';
import { isGymCurrentlyOpen, getTodayOpeningStatus, isClosingSoon } from '@/lib/gymUtils';
import { cn } from '@/lib/utils';
import GymPricingDisplay from './GymPricingDisplay';
import { GymPricing } from '@/contexts/GymContext';
import GymTrainersTab from './GymTrainersTab';
import GymAttendanceChart from './GymAttendanceChart';
import { useTranslation } from 'react-i18next';

const DAYS = [
  { key: 'monday', labelKey: 'business.day_mon' },
  { key: 'tuesday', labelKey: 'business.day_tue' },
  { key: 'wednesday', labelKey: 'business.day_wed' },
  { key: 'thursday', labelKey: 'business.day_thu' },
  { key: 'friday', labelKey: 'business.day_fri' },
  { key: 'saturday', labelKey: 'business.day_sat' },
  { key: 'sunday', labelKey: 'business.day_sun' },
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
  pricing?: GymPricing | null;
  gymId?: string;
  services?: string[] | null;
}

const GymDetailTabs = ({ hours, machines, machinesLoading, pricing, gymId, services }: GymDetailTabsProps) => {
  const { t } = useTranslation();
  const [hoursOpen, setHoursOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [machineSearch, setMachineSearch] = useState('');
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
      <TabsList className="w-full grid grid-cols-4 h-auto p-1">
        <TabsTrigger value="overview" className="text-xs py-2">{t('business.tab_overview')}</TabsTrigger>
        <TabsTrigger value="machines" className="text-xs py-2">{t('business.tab_machines')}</TabsTrigger>
        <TabsTrigger value="pricing" className="text-xs py-2">{t('business.tab_pricing')}</TabsTrigger>
        <TabsTrigger value="trainers" className="text-xs py-2">{t('business.tab_trainers')}</TabsTrigger>
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
                  {isOpen ? t('business.open') : t('business.closed')}
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
                    <span className="text-muted-foreground">{t(day.labelKey)}</span>
                    {isClosed ? (
                      <span className="text-destructive">{t('business.closed')}</span>
                    ) : (
                      <span className="font-medium">{dayHours?.open} - {dayHours?.close === '00:00' ? '24:00' : dayHours?.close}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Services Collapsible */}
        <Collapsible open={servicesOpen} onOpenChange={setServicesOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full py-3 px-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-muted-foreground" />
              <span className="font-medium">{t('business.services')}</span>
            </div>
            <ChevronDown className={cn(
              "w-5 h-5 text-muted-foreground transition-transform",
              servicesOpen && "rotate-180"
            )} />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="bg-muted/30 rounded-lg p-4">
              {services && services.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {services.map((s) => (
                    <span key={s} className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">{s}</span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t('business.services')}</p>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Attendance Chart */}
        <div className="py-3 px-4 bg-muted/50 rounded-lg space-y-3">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm font-medium">{t('business.avg_attendance')}</span>
          </div>
          <GymAttendanceChart gymId={gymId} />
        </div>
      </TabsContent>

      {/* Machines Tab */}
      <TabsContent value="machines" className="mt-4">
        {machinesLoading ? (
          <div className="text-sm text-muted-foreground py-4 text-center">{t('business.loading')}</div>
        ) : machines.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            {t('business.no_equipment_listed')}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('business.search_machine')}
                value={machineSearch}
                onChange={(e) => setMachineSearch(e.target.value)}
                className="pl-9 h-10"
              />
            </div>

            {(() => {
              const query = machineSearch.toLowerCase();
              const filteredMachines = machineEquipment.filter(m =>
                (m.machine?.name || '').toLowerCase().includes(query)
              );
              const filteredFreeWeights = freeWeights.filter(m =>
                (m.machine?.name || '').toLowerCase().includes(query)
              );

              if (filteredMachines.length === 0 && filteredFreeWeights.length === 0) {
                return (
                  <div className="text-sm text-muted-foreground py-4 text-center">
                    {t('business.no_results_for', { q: machineSearch })}
                  </div>
                );
              }

              return (
                <div className="space-y-6">
                  {filteredMachines.length > 0 && (
                    <div>
                      <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                        <Dumbbell className="w-4 h-4" />
                        {t('business.machines_section', { n: filteredMachines.length })}
                      </h5>
                      {renderEquipmentList(filteredMachines)}
                    </div>
                  )}
                  {filteredFreeWeights.length > 0 && (
                    <div>
                      <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                        <Dumbbell className="w-4 h-4" />
                        {t('business.free_weights', { n: filteredFreeWeights.length })}
                      </h5>
                      {renderEquipmentList(filteredFreeWeights)}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Brand logos */}
            <div className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">{t('business.equipment_brands')}</p>
              <div className="flex items-center gap-6 justify-center opacity-60">
                <span className="text-sm font-bold tracking-wider">PANNATA</span>
                <span className="text-sm font-bold tracking-wider">ZIVA</span>
                <span className="text-sm font-bold tracking-wider text-pink-500">BootyBuilder</span>
              </div>
            </div>
          </div>
        )}
      </TabsContent>

      {/* Pricing Tab */}
      <TabsContent value="pricing" className="mt-4">
        <GymPricingDisplay pricing={pricing ?? null} />
      </TabsContent>

      {/* Trainers Tab */}
      <TabsContent value="trainers" className="mt-4">
        <GymTrainersTab gymId={gymId} />
      </TabsContent>
    </Tabs>
  );
};

export default GymDetailTabs;
