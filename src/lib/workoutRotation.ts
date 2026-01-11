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

// Day order for sorting
const DAY_ORDER: Record<string, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6
};

/**
 * Získá aktuální den v týdnu jako string
 */
export const getCurrentWeekday = (): string => {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[new Date().getDay()];
};

/**
 * Vypočítá, který den v týdnu bude další trénink
 * Dni jsou seřazeny tak, že první je nejbližší aktuálnímu dni
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
  
  // Sort training days by their order in the week
  const sortedDays = [...trainingDays].sort((a, b) => 
    (DAY_ORDER[a] ?? 0) - (DAY_ORDER[b] ?? 0)
  );
  
  // Find today and rotate the array so nearest day comes first
  const today = getCurrentWeekday();
  const todayIndex = DAY_ORDER[today] ?? 0;
  
  // Find the first training day that is >= today
  let startIndex = sortedDays.findIndex(day => (DAY_ORDER[day] ?? 0) >= todayIndex);
  if (startIndex === -1) startIndex = 0; // All days are before today, wrap to next week
  
  // Rotate array so the nearest upcoming day is first
  const rotatedDays = [...sortedDays.slice(startIndex), ...sortedDays.slice(0, startIndex)];
  
  const schedule: { dayOfWeek: string; dayLetter: string }[] = [];
  
  // Use getCurrentDayLetter for the first day (current position in rotation)
  // Then calculate subsequent days based on position in sequence
  rotatedDays.forEach((dayOfWeek, index) => {
    // Current day letter is at currentDayIndex, next ones follow in sequence
    const dayLetter = getCurrentDayLetter(dayCount, currentDayIndex + index);
    schedule.push({ dayOfWeek, dayLetter });
  });
  
  return schedule;
};
