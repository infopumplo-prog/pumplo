// Stránka se všemi trenéry (feedback 13. 10.): čistá logika bez Reactu — řazení,
// filtr demo posilovny a rozhodnutí, kam po registraci se zraněním.

export const PUMPLO_GYM_ID = 'f0f0f0f0-0000-4000-8000-000000000001';
export const DEMO_GYM_ID = 'deadbeef-0000-4000-8000-000000000001';

export const TRAINERS_ROUTE = '/trainers';
/** Query parametr pro úvodní banner „Máš zranění…" (feedback 13. 10.). */
export const TRAINERS_INJURY_INTRO_ROUTE = `${TRAINERS_ROUTE}?intro=injury`;

/** Skutečné zranění = něco vybráno a není to „nemám zranění". */
export const hasRealInjuries = (injuries: string[] | null | undefined): boolean =>
  !!injuries && injuries.length > 0 && !injuries.includes('none');

/** Po registraci se zraněním rovnou na trenéry, jinak cíl podle volby plánu (feedback 13. 10.). */
export const shouldRouteToTrainers = (injuries: string[] | null | undefined): boolean =>
  hasRealInjuries(injuries);

export interface DirectoryTrainerRow {
  id: string;
  gym_id: string;
  name: string;
  status: string | null;
  is_active: boolean | null;
  sort_order: number | null;
}

/** Jen schválení a aktivní; demo posilovnu vidí jen admin. */
export const filterVisibleTrainers = <T extends DirectoryTrainerRow>(rows: T[], isAdmin: boolean): T[] =>
  rows.filter(
    (r) => r.status === 'approved' && r.is_active === true && (isAdmin || r.gym_id !== DEMO_GYM_ID),
  );

/** Pořadí skupin: moje posilovna → Pumplo → ostatní (→ demo pro admina). */
const groupRank = (gymId: string, selectedGymId: string | null | undefined): number => {
  if (selectedGymId && gymId === selectedGymId) return 0;
  if (gymId === PUMPLO_GYM_ID) return 1;
  if (gymId === DEMO_GYM_ID) return 3;
  return 2;
};

export const sortTrainers = <T extends DirectoryTrainerRow>(
  rows: T[],
  selectedGymId: string | null | undefined,
  gymNames: Record<string, string> = {},
): T[] =>
  [...rows].sort((a, b) => {
    const g = groupRank(a.gym_id, selectedGymId) - groupRank(b.gym_id, selectedGymId);
    if (g !== 0) return g;
    // Ostatní posilovny abecedně, ať jsou trenéři jedné posilovny pohromadě.
    const gymCmp = (gymNames[a.gym_id] ?? '').localeCompare(gymNames[b.gym_id] ?? '', 'cs');
    if (gymCmp !== 0) return gymCmp;
    const s = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (s !== 0) return s;
    return a.name.localeCompare(b.name, 'cs');
  });

/** Instagram v kontaktu je někdy handle, někdy celá URL. */
export const instagramUrl = (value: string): string => {
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return v;
  return `https://instagram.com/${v.replace(/^@/, '')}`;
};

/** Jeden trenér může mít víc účtů (Pumplo: Apple + e-mail) → v seznamu jen jednou.
 *  Klíč = posilovna + jméno; přednost má záznam s fotkou (David 15. 10.: „Beníšek je tam dvakrát“). */
export const dedupeTrainers = <T extends DirectoryTrainerRow & { photo?: string | null }>(rows: T[]): T[] => {
  const byKey = new Map<string, T>();
  for (const r of rows) {
    const key = `${r.gym_id}|${r.name.trim().toLocaleLowerCase('cs')}`;
    const prev = byKey.get(key);
    if (!prev || (!prev.photo && r.photo)) byKey.set(key, r);
  }
  return rows.filter(r => byKey.get(`${r.gym_id}|${r.name.trim().toLocaleLowerCase('cs')}`) === r);
};
