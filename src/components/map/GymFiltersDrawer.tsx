import { useState } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export interface GymFilters {
  openNow: boolean;
  verifiedOnly: boolean;
  privateOnly: boolean;
  distanceLimit: number | null;
  singlePriceLimit: number | null;
  membershipPriceLimit: number | null;
  services: string[];
  cards: string[];
  machines: string[];
}

export const DEFAULT_FILTERS: GymFilters = {
  openNow: false,
  verifiedOnly: false,
  privateOnly: false,
  distanceLimit: null,
  singlePriceLimit: null,
  membershipPriceLimit: null,
  services: [],
  cards: [],
  machines: [],
};

export const countActiveFilters = (f: GymFilters) =>
  (f.openNow ? 1 : 0) +
  (f.verifiedOnly ? 1 : 0) +
  (f.privateOnly ? 1 : 0) +
  (f.distanceLimit !== null ? 1 : 0) +
  (f.singlePriceLimit !== null ? 1 : 0) +
  (f.membershipPriceLimit !== null ? 1 : 0) +
  f.services.length +
  f.cards.length +
  f.machines.length;

const SERVICES = [
  { key: 'parkování', label: 'Parkování' },
  { key: 'solárium', label: 'Solárium' },
  { key: 'sauna', label: 'Sauna' },
  { key: 'sprchy', label: 'Sprchy' },
  { key: 'personal training', label: 'Personal training' },
  { key: 'dětský koutek', label: 'Dětský koutek' },
  { key: 'šatny', label: 'Šatny' },
  { key: 'bar', label: 'Protein bar' },
  { key: 'kardio zóna', label: 'Kardio zóna' },
  { key: 'skupinové lekce', label: 'Skupinové lekce' },
];

const CARDS = [
  { key: 'multisport', label: 'MultiSport' },
  { key: 'benefit plus', label: 'Benefit Plus' },
  { key: 'sodexo', label: 'Sodexo' },
  { key: 'edenred', label: 'Edenred' },
];

const DIST_STEPS = [0.05, 0.1, 0.2, 0.5, 1, 2, 3];
const distLabel = (v: number) => v < 1 ? `${v * 1000} m` : `${v} km`;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: GymFilters;
  onChange: (filters: GymFilters) => void;
  hasGps: boolean;
  maxSinglePrice: number;
  maxMembershipPrice: number;
  availableMachines: string[];
}

const Toggle = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button onClick={onClick} className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors border ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border'}`}>
    {children}
  </button>
);

const Chip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button onClick={onClick} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border'}`}>
    {children}
  </button>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{title}</p>
    {children}
  </div>
);

const RangeSlider = ({ label, value, max, step, unit, noLimitLabel = 'Bez omezení', onChange }: {
  label: string; value: number | null; max: number; step: number; unit: string; noLimitLabel?: string; onChange: (v: number | null) => void;
}) => {
  const display = value ?? max;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
        <span className={`text-sm font-semibold ${value === null ? 'text-muted-foreground' : 'text-primary'}`}>
          {value === null ? noLimitLabel : `do ${value} ${unit}`}
        </span>
      </div>
      <input type="range" min={step} max={max} step={step} value={display}
        onChange={e => { const v = parseInt(e.target.value); onChange(v >= max ? null : v); }}
        className="w-full accent-primary cursor-pointer" />
      <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
        <span>{step} {unit}</span>
        <span>{noLimitLabel}</span>
      </div>
    </div>
  );
};

const DistanceSlider = ({ value, onChange, hasGps }: { value: number | null; onChange: (v: number | null) => void; hasGps: boolean }) => {
  if (!hasGps) return null;
  const idx = value === null ? DIST_STEPS.length : Math.max(0, DIST_STEPS.indexOf(value));
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vzdálenost od tebe</p>
        <span className={`text-sm font-semibold ${value === null ? 'text-muted-foreground' : 'text-primary'}`}>
          {value === null ? 'Bez omezení' : `do ${distLabel(value)}`}
        </span>
      </div>
      <input type="range" min={0} max={DIST_STEPS.length} step={1} value={idx}
        onChange={e => { const i = parseInt(e.target.value); onChange(i >= DIST_STEPS.length ? null : DIST_STEPS[i]); }}
        className="w-full accent-primary cursor-pointer" />
      <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
        <span>50 m</span><span>Bez omezení</span>
      </div>
    </div>
  );
};

export const GymFiltersDrawer = ({ open, onOpenChange, filters, onChange, hasGps, maxSinglePrice, maxMembershipPrice, availableMachines }: Props) => {
  const [machineSearch, setMachineSearch] = useState('');
  const set = (patch: Partial<GymFilters>) => onChange({ ...filters, ...patch });
  const toggleService = (key: string) => set({ services: filters.services.includes(key) ? filters.services.filter(s => s !== key) : [...filters.services, key] });
  const toggleCard = (key: string) => set({ cards: filters.cards.includes(key) ? filters.cards.filter(c => c !== key) : [...filters.cards, key] });
  const toggleMachine = (key: string) => set({ machines: filters.machines.includes(key) ? filters.machines.filter(m => m !== key) : [...filters.machines, key] });
  const active = countActiveFilters(filters);

  const filteredMachines = machineSearch.trim()
    ? availableMachines.filter(m => m.toLowerCase().includes(machineSearch.toLowerCase()))
    : [];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="flex items-center justify-between pb-0">
          <DrawerTitle>Filtrovat posilovny</DrawerTitle>
          {active > 0 && (
            <button onClick={() => onChange(DEFAULT_FILTERS)} className="text-sm text-primary font-medium">
              Vymazat vše ({active})
            </button>
          )}
        </DrawerHeader>

        <div className="px-4 pb-4 pt-4 space-y-5 overflow-y-auto">
          {/* Dostupnost */}
          <Section title="Dostupnost">
            <div className="flex gap-2 flex-wrap">
              <Toggle active={filters.openNow} onClick={() => set({ openNow: !filters.openNow })}>Otevřeno teď</Toggle>
              <Toggle active={filters.privateOnly} onClick={() => set({ privateOnly: !filters.privateOnly })}>Soukromý gym</Toggle>
              <Toggle active={filters.verifiedOnly} onClick={() => set({ verifiedOnly: !filters.verifiedOnly })}>✓ Ověřená</Toggle>
            </div>
          </Section>

          {/* Vzdálenost */}
          <DistanceSlider value={filters.distanceLimit} onChange={v => set({ distanceLimit: v })} hasGps={hasGps} />

          {/* Jednorázový vstup */}
          <RangeSlider label="Jednorázový vstup" value={filters.singlePriceLimit} max={maxSinglePrice} step={10} unit="Kč" onChange={v => set({ singlePriceLimit: v })} />

          {/* Permanentka */}
          <RangeSlider label="Permanentka (měsíčně)" value={filters.membershipPriceLimit} max={maxMembershipPrice} step={50} unit="Kč/měs." onChange={v => set({ membershipPriceLimit: v })} />

          {/* Stroje — vyhledávání */}
          <Section title="Stroje a cvičiště">
            {filters.machines.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {filters.machines.map(m => (
                  <button key={m} onClick={() => toggleMachine(m)} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary text-primary-foreground">
                    {m} <X className="w-3 h-3" />
                  </button>
                ))}
              </div>
            )}
            <input
              type="text"
              placeholder="Hledat stroj nebo cvičiště..."
              value={machineSearch}
              onChange={e => setMachineSearch(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-xl bg-background outline-none focus:ring-2 focus:ring-primary/30"
            />
            {filteredMachines.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {filteredMachines.slice(0, 20).map(m => (
                  <Chip key={m} active={filters.machines.includes(m)} onClick={() => toggleMachine(m)}>{m}</Chip>
                ))}
              </div>
            )}
          </Section>

          {/* Platební karty */}
          <Section title="Platební karty">
            <div className="flex flex-wrap gap-2">
              {CARDS.map(c => <Chip key={c.key} active={filters.cards.includes(c.key)} onClick={() => toggleCard(c.key)}>{c.label}</Chip>)}
            </div>
          </Section>

          {/* Služby */}
          <Section title="Vybavení a služby">
            <div className="flex flex-wrap gap-2">
              {SERVICES.map(s => <Chip key={s.key} active={filters.services.includes(s.key)} onClick={() => toggleService(s.key)}>{s.label}</Chip>)}
            </div>
          </Section>
        </div>

        <div className="px-4 pb-8">
          <Button className="w-full" onClick={() => onOpenChange(false)}>
            Použít filtry{active > 0 ? ` (${active})` : ''}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
