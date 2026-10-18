// Karta „Tvůj první trénink“ na Home (David 18. 10.).
// Ze 136 lidí po dotazníku jen 32 kdy dokončilo trénink a nikdo trénink nezačal
// a nedokončil — prostě nezmáčknou Začít. Karta je proto první věc na Home,
// dokud nemají první dokončený trénink. Čistá logika bez Reactu → testy.

export const FIRST_WORKOUT_DISMISS_KEY = 'pumplo_first_workout_dismissed';

export interface FirstWorkoutCardInput {
  /** Přihlášený uživatel (host = false). */
  isSignedIn: boolean;
  isGuest?: boolean;
  /** Aktivní Pumplo plán. */
  hasActivePlan: boolean;
  /** Počet dokončených tréninků (completed_at not null); null = ještě se načítá. */
  completedWorkouts: number | null;
  /** Rozpracovaný trénink — pak patří nahoru karta Pokračovat, ne tahle. */
  hasPausedWorkout?: boolean;
  /** Den, kdy uživatel kartu odložil („Až budu v posilovně“), formát YYYY-MM-DD. */
  dismissedOn: string | null;
  /** Dnešek v lokálním čase, YYYY-MM-DD. */
  today: string;
}

export const shouldShowFirstWorkoutCard = (i: FirstWorkoutCardInput): boolean => {
  if (!i.isSignedIn || i.isGuest) return false;
  if (!i.hasActivePlan) return false;
  // Dokud nevíme počet, kartu neukazujeme — stávajícím by jinak problikla.
  if (i.completedWorkouts === null || i.completedWorkouts > 0) return false;
  if (i.hasPausedWorkout) return false;
  if (i.dismissedOn === i.today) return false;
  return true;
};

/** Lokální datum YYYY-MM-DD (odložení platí do půlnoci, ne 24 h). */
export const localDateKey = (d: Date = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const readFirstWorkoutDismissed = (): string | null => {
  try {
    return localStorage.getItem(FIRST_WORKOUT_DISMISS_KEY);
  } catch {
    return null;
  }
};

export const dismissFirstWorkoutForToday = (today: string = localDateKey()): void => {
  try {
    localStorage.setItem(FIRST_WORKOUT_DISMISS_KEY, today);
  } catch {
    /* bez localStorage se karta jen neodloží */
  }
};
