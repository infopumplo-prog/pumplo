import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export interface GymFilters {
  openNow: boolean;
  verifiedOnly: boolean;
  hasMembership: boolean;
  maxDistance: number | null; // km, null = any
  maxSinglePrice: number | null; // CZK, null = any
  services: string[];
  cards: string[];
}

export const DEFAULT_FILTERS: GymFilters = {
  openNow: false,
  verifiedOnly: false,
  hasMembership: false,
  maxDistance: null,
  maxSinglePrice: null,
  services: [],
  cards: [],
};

export const countActiveFilters = (f: GymFilters) =>
  (f.openNow ? 1 : 0) +
  (f.verifiedOnly ? 1 : 0) +
  (f.hasMembership ? 1 : 0) +
  (f.maxDistance !== null ? 1 : 0) +
  (f.maxSinglePrice !== null ? 1 : 0) +
  f.services.length +
  f.cards.length;

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

const DISTANCES = [
  { value: 1, label: '< 1 km' },
  { value: 3, label: '< 3 km' },
  { value: 5, label: '< 5 km' },
  { value: 10, label: '< 10 km' },
];

const PRICES = [
  { value: 100, label: 'do 100 Kč' },
  { value: 130, label: 'do 130 Kč' },
  { value: 160, label: 'do 160 Kč' },
  { value: 200, label: 'do 200 Kč' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: GymFilters;
  onChange: (filters: GymFilters) => void;
  hasGps: boolean;
}

const Chip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
      active
        ? 'bg-primary text-primary-foreground border-primary'
        : 'bg-background text-foreground border-border'
    }`}
  >
    {children}
  </button>
);

const Toggle = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors border ${
      active
        ? 'bg-primary text-primary-foreground border-primary'
        : 'bg-background text-foreground border-border'
    }`}
  >
    {children}
  </button>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{title}</p>
    {children}
  </div>
);

export const GymFiltersDrawer = ({ open, onOpenChange, filters, onChange, hasGps }: Props) => {
  const set = (patch: Partial<GymFilters>) => onChange({ ...filters, ...patch });

  const toggleService = (key: string) =>
    set({ services: filters.services.includes(key) ? filters.services.filter(s => s !== key) : [...filters.services, key] });

  const toggleCard = (key: string) =>
    set({ cards: filters.cards.includes(key) ? filters.cards.filter(c => c !== key) : [...filters.cards, key] });

  const active = countActiveFilters(filters);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="flex items-center justify-between pb-0">
          <DrawerTitle>Filtrovat posilovny</DrawerTitle>
          {active > 0 && (
            <button
              onClick={() => onChange(DEFAULT_FILTERS)}
              className="text-sm text-primary font-medium"
            >
              Vymazat vše ({active})
            </button>
          )}
        </DrawerHeader>

        <div className="px-4 pb-8 pt-4 space-y-5 overflow-y-auto">
          {/* Dostupnost */}
          <Section title="Dostupnost">
            <div className="flex gap-2 flex-wrap">
              <Toggle active={filters.openNow} onClick={() => set({ openNow: !filters.openNow })}>
                Otevřeno teď
              </Toggle>
              <Toggle active={filters.hasMembership} onClick={() => set({ hasMembership: !filters.hasMembership })}>
                Permanentka
              </Toggle>
              <Toggle active={filters.verifiedOnly} onClick={() => set({ verifiedOnly: !filters.verifiedOnly })}>
                ✓ Ověřená
              </Toggle>
            </div>
          </Section>

          {/* Vzdálenost */}
          {hasGps && (
            <Section title="Vzdálenost od tebe">
              <div className="flex flex-wrap gap-2">
                {DISTANCES.map(d => (
                  <Chip
                    key={d.value}
                    active={filters.maxDistance === d.value}
                    onClick={() => set({ maxDistance: filters.maxDistance === d.value ? null : d.value })}
                  >
                    {d.label}
                  </Chip>
                ))}
              </div>
            </Section>
          )}

          {/* Cena */}
          <Section title="Jednorázový vstup">
            <div className="flex flex-wrap gap-2">
              {PRICES.map(p => (
                <Chip
                  key={p.value}
                  active={filters.maxSinglePrice === p.value}
                  onClick={() => set({ maxSinglePrice: filters.maxSinglePrice === p.value ? null : p.value })}
                >
                  {p.label}
                </Chip>
              ))}
            </div>
          </Section>

          {/* Platební karty */}
          <Section title="Platební karty">
            <div className="flex flex-wrap gap-2">
              {CARDS.map(c => (
                <Chip key={c.key} active={filters.cards.includes(c.key)} onClick={() => toggleCard(c.key)}>
                  {c.label}
                </Chip>
              ))}
            </div>
          </Section>

          {/* Služby */}
          <Section title="Vybavení a služby">
            <div className="flex flex-wrap gap-2">
              {SERVICES.map(s => (
                <Chip key={s.key} active={filters.services.includes(s.key)} onClick={() => toggleService(s.key)}>
                  {s.label}
                </Chip>
              ))}
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
