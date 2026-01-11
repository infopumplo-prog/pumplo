import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format day_letter for display - handles extension workouts
 * e.g., "A_EXT" becomes "A+" or "A (EXT)"
 */
export function formatDayLetter(dayLetter: string, format: 'badge' | 'full' = 'badge'): string {
  if (dayLetter.includes('_EXT')) {
    const baseLetter = dayLetter.replace('_EXT', '');
    return format === 'badge' ? `${baseLetter}+` : `Den ${baseLetter} (rozšírenie)`;
  }
  return format === 'badge' ? dayLetter : `Den ${dayLetter}`;
}

/**
 * Check if a workout session is an extension workout
 */
export function isExtensionWorkout(dayLetter: string): boolean {
  return dayLetter.includes('_EXT');
}
