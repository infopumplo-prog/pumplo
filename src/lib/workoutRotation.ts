// Workout Day Rotation - generická logika pro rotaci dní
// Podporuje libovolný počet dní (A, B, C, D, E, F, G...)

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Získá písmeno dne podle indexu a počtu dní v rotaci
 * @param dayCount - počet unikátních dní v rotaci (z training_goals.day_count)
 * @param currentIndex - aktuální index v rotaci (0-based)
 * @returns písmeno dne a další index
 */
export const getNextDayLetter = (
  dayCount: number,
  currentIndex: number
): { letter: string; nextIndex: number } => {
  const safeIndex = Math.max(0, currentIndex);
  const safeDayCount = Math.max(1, Math.min(dayCount, 26)); // max 26 dní (A-Z)
  
  const letter = ALPHABET[safeIndex % safeDayCount];
  const nextIndex = (safeIndex + 1) % safeDayCount;
  
  return { letter, nextIndex };
};

/**
 * Získá aktuální písmeno dne (bez posunu indexu)
 */
export const getCurrentDayLetter = (
  dayCount: number,
  currentIndex: number
): string => {
  const safeDayCount = Math.max(1, Math.min(dayCount, 26));
  const safeIndex = Math.max(0, currentIndex);
  return ALPHABET[safeIndex % safeDayCount];
};

/**
 * Získá seznam všech písmen dní pro daný goal
 * @param dayCount - počet dní
 * @returns pole písmen ['A', 'B', 'C', ...]
 */
export const getAllDayLetters = (dayCount: number): string[] => {
  const safeDayCount = Math.max(1, Math.min(dayCount, 26));
  return ALPHABET.slice(0, safeDayCount).split('');
};

/**
 * Vypočítá, který den v týdnu bude další trénink
 * @param trainingDays - pole dnů kdy uživatel trénuje ['monday', 'wednesday', 'friday']
 * @param dayCount - počet unikátních dní v rotaci
 * @param currentDayIndex - aktuální index rotace
 */
export const getTrainingSchedule = (
  trainingDays: string[],
  dayCount: number,
  currentDayIndex: number
): { dayOfWeek: string; dayLetter: string }[] => {
  if (trainingDays.length === 0) return [];
  
  const schedule: { dayOfWeek: string; dayLetter: string }[] = [];
  let rotationIndex = currentDayIndex;
  
  trainingDays.forEach(dayOfWeek => {
    const { letter, nextIndex } = getNextDayLetter(dayCount, rotationIndex);
    schedule.push({ dayOfWeek, dayLetter: letter });
    rotationIndex = nextIndex;
  });
  
  return schedule;
};
