// Pravidla plánu, která musí znát BOTH webová appka i serverová funkce pro
// hodinky. Schválně bez importů, aby to snesl Vite i Deno.
//
// Tenhle soubor je JEDINÉ místo, kde ta pravidla žijí. `src/lib/planRules.ts`
// z něj jen re-exportuje, aby appka měla čistý import. Nikdy sem nekopírovat
// druhou verzi — rozdíl mezi hodinkami a appkou se pozná až tím, že uživateli
// svítí jiná čísla na zápěstí než na displeji.

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Písmeno aktuálního dne rotace (bez posunu indexu). */
export const getCurrentDayLetter = (dayCount: number, currentIndex: number): string => {
  const safeDayCount = Math.max(1, Math.min(dayCount, 26));
  const safeIndex = Math.max(0, currentIndex);
  return ALPHABET[safeIndex % safeDayCount];
};

/** Písmeno následujícího dne a nový index. Index roste monotónně. */
export const getNextDayLetter = (
  dayCount: number,
  currentIndex: number
): { letter: string; nextIndex: number } => {
  const safeIndex = Math.max(0, currentIndex);
  const safeDayCount = Math.max(1, Math.min(dayCount, 26)); // max 26 dní (A-Z)

  const letter = ALPHABET[safeIndex % safeDayCount];
  const nextIndex = safeIndex + 1; // Monotonically increasing — modulo only for letter

  return { letter, nextIndex };
};

// Pauza podle kategorie slotu a cíle (trainer rules v3): hlavní cvik dostane
// plnou pauzu, pomocný zkrácenou, izolace a core krátkou.
export const getRestSecondsForCategory = (goalId: string, slotCategory?: string | null): number => {
  const cat = slotCategory || 'secondary';
  switch (goalId) {
    case 'strength':
      if (cat === 'main') return 300;              // 5 min
      if (cat === 'secondary') return 180;          // 3 min
      return 120;                                   // isolation/core/conditioning: 2 min
    case 'muscle_gain':
      if (cat === 'main') return 180;              // 3 min
      if (cat === 'secondary') return 120;          // 2 min
      return 90;                                    // isolation/core/conditioning: 1.5 min
    case 'fat_loss':
    case 'general_fitness':
    default:
      return 60;                                    // 1 min for all categories
  }
};

export const RIR_BY_WEEK: Record<number, { rir: number; label: string; description: string }> = {
  1: { rir: 3, label: 'RIR 3', description: 'Pohodlné - mohli byste udělat ještě 3 opakování' },
  2: { rir: 3, label: 'RIR 3', description: 'Pohodlné - mohli byste udělat ještě 3 opakování' },
  3: { rir: 2, label: 'RIR 2', description: 'Náročné - mohli byste udělat ještě 2 opakování' },
  4: { rir: 2, label: 'RIR 2', description: 'Náročné - mohli byste udělat ještě 2 opakování' },
  5: { rir: 1, label: 'RIR 1', description: 'Velmi těžké - mohli byste udělat ještě 1 opakování' },
  6: { rir: 1, label: 'RIR 1', description: 'Velmi těžké - mohli byste udělat ještě 1 opakování' },
  7: { rir: 5, label: 'Deload', description: 'Regenerační týden - snižte váhu o 30-40%' },
  8: { rir: 5, label: 'Deload', description: 'Regenerační týden - snižte váhu o 30-40%' },
};

export const getRIRGuidance = (weekNumber: number): { rir: number; label: string; description: string } => {
  // Cycle through 8-week blocks
  const adjustedWeek = ((weekNumber - 1) % 8) + 1;
  return RIR_BY_WEEK[adjustedWeek] || RIR_BY_WEEK[1];
};
