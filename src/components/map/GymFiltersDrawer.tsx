import { useState, useRef, useEffect } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

const stripDiacritics = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const levenshtein = (a: string, b: string): number => {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[a.length][b.length];
};

// Each group: any term matches any other term in the group (bidirectional)
// Terms are pre-normalized (no diacritics, lowercase) to match stripDiacritics output
const SYNONYM_GROUPS: string[][] = [
  // Jednoručky / činky / dumbbells
  ['dumbbell', 'dumbbells', 'cinky', 'cinka', 'jednorucky', 'jednoruky', 'jednoruek', 'hantel', 'hantle', 'jednoruci'],
  // Osy / EZ osy / barbells
  ['barbell', 'barbells', 'osa', 'osy', 'tyc', 'tyce', 'olympijska', 'ez osy', 'ez osa', 'ez'],
  // Lavička / bench press
  ['bench', 'lavicka', 'lavicky', 'benchpress', 'bench press', 'lavice'],
  // Kladka / cable — kladka veslování, křížová kladka, horní/dolní kladka
  ['cable', 'cables', 'kladka', 'kladky', 'kabelova', 'krizova', 'crossover', 'lanko', 'krizovy'],
  // Dřepový stojan / squat rack / power rack / half rack
  ['squat', 'drep', 'drepy', 'power rack', 'half rack', 'drepovy', 'rack', 'stojan'],
  // Běžecký pás / treadmill
  ['treadmill', 'bezecky', 'bezak', 'bezaky', 'beh', 'running'],
  // Rotoped / kolo / bike / air bike
  ['bike', 'bicycle', 'kolo', 'kola', 'cyklo', 'rotoped', 'spinning', 'spinningove', 'air bike', 'airbike'],
  // Veslařský / veslovací / rowing machine
  ['rowing', 'rower', 'veslovaci', 'veslarsky', 'veslar', 'veslo', 'veslak', 'concept', 'ergometr', 'veslovan'],
  // Prsa / pektorální / chest — vertikální tlak na prsa, peck deck
  ['chest', 'hrudni', 'prsni', 'prsa', 'pec', 'pecdeck', 'motyl', 'butterfly', 'pektoral', 'vertikalni tlak', 'prsni stroj'],
  // Ramena / deltoid / shoulder press
  ['shoulder', 'shoulders', 'ramena', 'ramenni', 'deltoid', 'deltoidni', 'delta', 'trapy', 'trapez', 'deltoid press'],
  // Biceps / curling stroj / preacher
  ['bicep', 'biceps', 'bicepsovy', 'scott', 'larry', 'preacher', 'modlitebna', 'curling'],
  // Triceps
  ['tricep', 'triceps', 'tricepsovy', 'french'],
  // Lat pulldown / stahování / kruhové stahování
  ['pulldown', 'stazeni', 'stahovan', 'lat', 'latissimu', 'dorsi', 'siroka', 'uzka', 'kruhove', 'lat pulldown'],
  // Přítahy / přítah stroj / row / mid row / high row / T-bar
  ['row', 'rows', 'pritahy', 'pritah', 'mid row', 'high row', 'veslovan', 't-bar', 'tbar', 'predklon'],
  // Hip thrust / kyčel / glute bridge
  ['hip', 'kycle', 'kycelni', 'hipthrust', 'hip thrust', 'glutebridge', 'thrust'],
  // Hýžďový / glute / kickback — stroj na hýždě, kickback stroj
  ['glute', 'glutes', 'hyzde', 'hyzdovy', 'hyzd', 'zadecek', 'kickback'],
  // Hyperextenze / záda / roman chair — záda a záklony
  ['back', 'zada', 'zadovy', 'hyperextenze', 'hyperex', 'roman', 'zaklony', 'mrtvak', 'deadlift', 'mrtvy', 'hyperex'],
  // Abdukce / únos / abduktor — únos stroj, únos vstoje
  ['abduction', 'abdukce', 'abduktor', 'unos', 'odtazeni', 'rozkrok'],
  // Addukce / adduktor
  ['adduction', 'addukce', 'adduktor', 'pritazeni'],
  // Lýtka / calf — lýtka vsedě, stroj na lýtka, Viking press a lýtka
  ['calf', 'calves', 'lytko', 'lytka', 'lytkovy', 'gastro', 'soleus', 'viking'],
  // Břicho / abs / stroj na břicho
  ['abs', 'abdominal', 'brisni', 'bricho', 'core', 'briska', 'crunch', 'plank'],
  // Eliptický / orbitrek / elliptical
  ['elliptical', 'elipticky', 'elipsa', 'elipticka', 'cross', 'orbitrek', 'orbit'],
  // Smith stroj
  ['smith', 'smithuv', 'smituv', 'vyvazeny'],
  // Leg press — leg press, leg press 45°, horizontální leg press
  ['leg press', 'legpress', 'nozni lis', 'nozak', 'horizontalni', 'leglis'],
  // Leg extension / extenze nohou — kvadriceps, stehna
  ['extension', 'extenze', 'extenzni', 'kvadriceps', 'quads', 'quad', 'stehno', 'leg extension'],
  // Leg curl / hamstringy
  ['curl', 'hamstring', 'hamstringy', 'stehenni', 'zakoleni', 'lying', 'leg curl'],
  // Hrazda / hrazdy / pull-up / shyby / pull assist
  ['hrazda', 'hrazdy', 'hrazd', 'pullup', 'pull-up', 'chinup', 'chin-up', 'shyby', 'pull assist', 'asistovana'],
  // Bradla / dip station / paralelní tyče
  ['dip', 'dipy', 'bradla', 'paralelni', 'paralely', 'paralelky', 'dipovadlo'],
  // Kettlebell
  ['kettlebell', 'kettlebells', 'kettlebely', 'zvon', 'zvony'],
  // TRX / suspension
  ['trx', 'suspension', 'zavesny'],
  // Schody / stepper / stairmaster
  ['stairs', 'schody', 'schod', 'stepper', 'stairmaster', 'step'],
  // Šikmá lavička / incline / super šikmý bench
  ['incline', 'decline', 'sikma', 'naklonena', 'sikmý'],
  // Medicinbal
  ['medicine', 'medicinbal', 'medibal'],
  // Fly / rozpažení / peck deck / vertikální pek dek
  ['fly', 'rozpazeni', 'rozpazen', 'motyl', 'pecdeck', 'pec deck', 'pek dek'],
  // Pullover stroj
  ['pullover'],
  // Rotační stroj
  ['rotation', 'rotacni', 'rotacni stroj', 'twist'],
  // Funkční / functional trainer / pinnacle
  ['functional', 'funkcni', 'multipress', 'pinnacle'],
  // Hack squat
  ['hack', 'hack squat', 'hacksquat'],
  // Super dřep / pendulový dřep
  ['pendulum', 'pendulovy', 'super drep', 'super power'],
  // Sissy squat
  ['sissy'],
  // Závaží / kotouče / weight plates
  ['plates', 'kotouče', 'kotoucy', 'zavazi', 'weights'],
];

const SYNONYM_MAP = new Map<string, string[]>();
for (const group of SYNONYM_GROUPS) {
  for (const term of group) SYNONYM_MAP.set(term, group);
}

const machineMatches = (machine: string, query: string): boolean => {
  const normMachine = stripDiacritics(machine);
  const words = stripDiacritics(query).split(/\s+/).filter(Boolean);
  return words.every(word => {
    if (normMachine.includes(word)) return true;
    const group = SYNONYM_MAP.get(word) ?? [];
    if (group.some(syn => syn !== word && normMachine.includes(syn))) return true;
    if (word.length >= 4) {
      const tolerance = word.length >= 7 ? 2 : 1;
      return normMachine.split(/\s+/).some(part => levenshtein(word, part) <= tolerance);
    }
    return false;
  });
};

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
  const machineInputRef = useRef<HTMLInputElement>(null);

  // iOS Chrome: keyboard appearance scrolls window even inside fixed drawers — reset it
  useEffect(() => {
    if (!open) return;
    const resetScroll = () => { if (window.scrollY !== 0) window.scrollTo(0, 0); };
    window.visualViewport?.addEventListener('resize', resetScroll);
    return () => window.visualViewport?.removeEventListener('resize', resetScroll);
  }, [open]);
  const set = (patch: Partial<GymFilters>) => onChange({ ...filters, ...patch });
  const toggleService = (key: string) => set({ services: filters.services.includes(key) ? filters.services.filter(s => s !== key) : [...filters.services, key] });
  const toggleCard = (key: string) => set({ cards: filters.cards.includes(key) ? filters.cards.filter(c => c !== key) : [...filters.cards, key] });
  const toggleMachine = (key: string) => set({ machines: filters.machines.includes(key) ? filters.machines.filter(m => m !== key) : [...filters.machines, key] });
  const active = countActiveFilters(filters);

  const filteredMachines = machineSearch.trim()
    ? availableMachines.filter(m => machineMatches(m, machineSearch))
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
              ref={machineInputRef}
              type="text"
              placeholder="Hledat stroj nebo cvičiště..."
              value={machineSearch}
              onChange={e => setMachineSearch(e.target.value)}
              onFocus={() => setTimeout(() => machineInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 350)}
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
