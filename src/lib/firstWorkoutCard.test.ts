import { describe, it, expect } from 'vitest';
import { shouldShowFirstWorkoutCard, localDateKey, type FirstWorkoutCardInput } from './firstWorkoutCard';

const base: FirstWorkoutCardInput = {
  isSignedIn: true,
  isGuest: false,
  hasActivePlan: true,
  completedWorkouts: 0,
  hasPausedWorkout: false,
  dismissedOn: null,
  today: '2026-10-18',
};

describe('shouldShowFirstWorkoutCard', () => {
  it('0 tréninků + plán → ukázat', () => {
    expect(shouldShowFirstWorkoutCard(base)).toBe(true);
  });

  it('odloženo dnes → skrýt', () => {
    expect(shouldShowFirstWorkoutCard({ ...base, dismissedOn: '2026-10-18' })).toBe(false);
  });

  it('odloženo včera → zase ukázat', () => {
    expect(shouldShowFirstWorkoutCard({ ...base, dismissedOn: '2026-10-17' })).toBe(true);
  });

  it('≥1 dokončený trénink → skrýt', () => {
    expect(shouldShowFirstWorkoutCard({ ...base, completedWorkouts: 1 })).toBe(false);
    expect(shouldShowFirstWorkoutCard({ ...base, completedWorkouts: 12 })).toBe(false);
  });

  it('host → skrýt', () => {
    expect(shouldShowFirstWorkoutCard({ ...base, isSignedIn: false, isGuest: true })).toBe(false);
    expect(shouldShowFirstWorkoutCard({ ...base, isGuest: true })).toBe(false);
  });

  it('bez plánu → skrýt', () => {
    expect(shouldShowFirstWorkoutCard({ ...base, hasActivePlan: false })).toBe(false);
  });

  it('počet se ještě načítá → skrýt (žádné problikávání)', () => {
    expect(shouldShowFirstWorkoutCard({ ...base, completedWorkouts: null })).toBe(false);
  });

  it('rozpracovaný trénink → skrýt (patří tam Pokračovat)', () => {
    expect(shouldShowFirstWorkoutCard({ ...base, hasPausedWorkout: true })).toBe(false);
  });
});

describe('localDateKey', () => {
  it('formátuje lokální datum', () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});
