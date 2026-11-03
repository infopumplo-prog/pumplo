/**
 * Vlastní vybavení pro lidi, kteří nechodí do žádné posilovny v appce
 * (feedback 13. 10.: „Nejsem v žádné z těchto posiloven").
 *
 * Člověk si odškrtá skupiny vybavení (jednoručky, hrazda, kladky…). Skupiny se
 * mapují na skutečné stroje z tabulky `machines` a generátor pak bere jen cviky,
 * jejichž stroj (i vedlejší stroj, např. osa u half racku) je v té množině.
 * Cviky bez stroje (čistě vlastní váha) jsou dostupné vždy.
 *
 * Čistá logika bez Supabase — testy v customEquipment.test.ts.
 */

export type EquipmentGroupId =
  | 'bodyweight'
  | 'dumbbells'
  | 'barbell'
  | 'bench'
  | 'pull_up_bar'
  | 'kettlebell'
  | 'bands'
  | 'trx'
  | 'cables'
  | 'smith'
  | 'leg_press'
  | 'machines'
  | 'cardio'
  | 'accessories';

/** Zvláštní volba „Všechno — chodím do běžné posilovny". */
export const ALL_EQUIPMENT = 'all';

export type EquipmentSection = 'home' | 'gym';

export interface EquipmentGroup {
  id: EquipmentGroupId;
  section: EquipmentSection;
  /** Název ikony z lucide-react (mapuje komponenta). */
  icon: string;
}

/** Pořadí = pořadí v pickeru. Popisky přes i18n `nogym.eq_<id>`. */
export const EQUIPMENT_GROUPS: EquipmentGroup[] = [
  { id: 'bodyweight', section: 'home', icon: 'PersonStanding' },
  { id: 'dumbbells', section: 'home', icon: 'Dumbbell' },
  { id: 'kettlebell', section: 'home', icon: 'Weight' },
  { id: 'bands', section: 'home', icon: 'Cable' },
  { id: 'pull_up_bar', section: 'home', icon: 'GripHorizontal' },
  { id: 'bench', section: 'home', icon: 'RectangleHorizontal' },
  { id: 'trx', section: 'home', icon: 'Link' },
  { id: 'accessories', section: 'home', icon: 'CircleDot' },
  { id: 'barbell', section: 'gym', icon: 'Weight' },
  { id: 'cables', section: 'gym', icon: 'Cable' },
  { id: 'smith', section: 'gym', icon: 'Columns2' },
  { id: 'leg_press', section: 'gym', icon: 'Footprints' },
  { id: 'machines', section: 'gym', icon: 'Cog' },
  { id: 'cardio', section: 'gym', icon: 'Bike' },
];

export const EQUIPMENT_GROUP_IDS = EQUIPMENT_GROUPS.map(g => g.id);

export interface MachineRow {
  id: string;
  name: string;
  equipment_category: string | null;
  is_cardio: boolean | null;
}

export interface EquipmentExercise {
  machine_id: string | null;
  secondary_machine_id?: string | null;
}

const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().trim().replace(/\s+/g, ' ');

// Přesné názvy strojů z DB (ověřeno 14. 10. 2026 nad tabulkou machines)
const NAMES: Partial<Record<EquipmentGroupId, string[]>> = {
  bodyweight: ['podložka', 'zeď'],
  dumbbells: ['jednoručky'],
  kettlebell: ['kettlebell'],
  bands: ['expander', 'guma'],
  pull_up_bar: ['hrazdy', 'multifunkční hrazda', 'bradla', 'žebřiny'],
  bench: ['šikmá lavička', 'lavice na hyperextenzi (45°)', 'stroj na hip thrust'],
  trx: ['trx'],
  accessories: [
    'gymball', 'overball', 'švihadlo', 'box (plyo box)', 'rozmasírování válcem',
    'kolečko', 'stalky', 'vysoké stalky',
  ],
  barbell: [
    'osa', 'ez osa', 'half rack', 'bench press', 'plošina', 'přítah v předklonu (osa)',
    'safetybar', 'landmine',
  ],
};

const MACHINE_CATEGORIES = new Set(['machine', 'selectorized', 'plate_loaded', 'cable']);

/**
 * Do které skupiny stroj patří (null = jen přes „Všechno").
 * Pořadí pravidel je důležité: kardio → multipress → leg press → kladky →
 * přesné názvy → ostatní posilovací stroje podle kategorie.
 */
export function classifyMachine(m: MachineRow): EquipmentGroupId | null {
  const name = norm(m.name);
  if (m.is_cardio) return 'cardio';
  if (name.includes('smith')) return 'smith';
  if (name.includes('leg press')) return 'leg_press';
  if (
    norm(m.equipment_category) === 'cable' ||
    name.includes('kladk') ||
    name.startsWith('lat pulldown') ||
    name.startsWith('stahovací věž')
  ) return 'cables';
  for (const [group, names] of Object.entries(NAMES) as [EquipmentGroupId, string[]][]) {
    if (names.includes(name)) return group;
  }
  if (MACHINE_CATEGORIES.has(norm(m.equipment_category))) return 'machines';
  return null;
}

/** Očistí uložený výběr od neznámých hodnot (stará verze appky, ruční zásah). */
export function sanitizeCustomEquipment(raw: string[] | null | undefined): string[] {
  if (!raw) return [];
  if (raw.includes(ALL_EQUIPMENT)) return [ALL_EQUIPMENT];
  const allowed = new Set<string>(EQUIPMENT_GROUP_IDS);
  return Array.from(new Set(raw.filter(x => allowed.has(x))));
}

/** Má profil aktivní režim „bez posilovny" (žádná posilovna + nějaké vybavení)? */
export function usesCustomEquipment(profile: {
  selected_gym_id?: string | null;
  custom_equipment?: string[] | null;
} | null | undefined): boolean {
  if (!profile || profile.selected_gym_id) return false;
  return sanitizeCustomEquipment(profile.custom_equipment).length > 0;
}

/** Množina strojů dostupných pro daný výběr skupin. */
export function resolveMachineIds(selected: string[], machines: MachineRow[]): Set<string> {
  const clean = sanitizeCustomEquipment(selected);
  if (clean.includes(ALL_EQUIPMENT)) return new Set(machines.map(m => m.id));
  const groups = new Set(clean);
  const out = new Set<string>();
  for (const m of machines) {
    const g = classifyMachine(m);
    if (g && groups.has(g)) out.add(m.id);
  }
  return out;
}

/** Jde cvik udělat s danými stroji? Bez stroje = vždy ano; vedlejší stroj musí být taky. */
export function isExerciseDoable(ex: EquipmentExercise, machineIds: Set<string>): boolean {
  if (ex.machine_id && !machineIds.has(ex.machine_id)) return false;
  if (ex.secondary_machine_id && !machineIds.has(ex.secondary_machine_id)) return false;
  return true;
}

export function filterExercisesByEquipment<T extends EquipmentExercise>(
  exercises: T[],
  machineIds: Set<string>,
): T[] {
  return exercises.filter(ex => isExerciseDoable(ex, machineIds));
}

/** Přepnutí skupiny v pickeru; „Všechno" je výlučné s ostatními. */
export function toggleEquipment(current: string[], id: string): string[] {
  if (id === ALL_EQUIPMENT) return current.includes(ALL_EQUIPMENT) ? [] : [ALL_EQUIPMENT];
  const base = current.filter(x => x !== ALL_EQUIPMENT);
  return base.includes(id) ? base.filter(x => x !== id) : [...base, id];
}
