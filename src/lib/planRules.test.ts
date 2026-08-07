import { describe, it, expect } from 'vitest';
import {
  getCurrentDayLetter,
  getNextDayLetter,
  getRestSecondsForCategory,
  getRIRGuidance,
} from './planRules';

// Tahle pravidla čte appka i serverová funkce pro hodinky. Testy tu nejsou
// kvůli složitosti, ale proto, že tichá změna rozejde hodinky s telefonem.

describe('rotace dní', () => {
  it('cycles the letter through the day count', () => {
    expect(getCurrentDayLetter(3, 0)).toBe('A');
    expect(getCurrentDayLetter(3, 2)).toBe('C');
    expect(getCurrentDayLetter(3, 3)).toBe('A');
  });
  it('keeps the index growing while the letter wraps', () => {
    expect(getNextDayLetter(2, 5)).toEqual({ letter: 'B', nextIndex: 6 });
  });
  it('survives nonsense input', () => {
    expect(getCurrentDayLetter(0, -4)).toBe('A');
    expect(getCurrentDayLetter(99, 26)).toBe('A');
  });
});

describe('pauzy podle kategorie', () => {
  it('gives the main lift the longest rest for strength', () => {
    expect(getRestSecondsForCategory('strength', 'main')).toBe(300);
    expect(getRestSecondsForCategory('strength', 'secondary')).toBe(180);
    expect(getRestSecondsForCategory('strength', 'isolation')).toBe(120);
  });
  it('shortens rest for muscle gain', () => {
    expect(getRestSecondsForCategory('muscle_gain', 'main')).toBe(180);
    expect(getRestSecondsForCategory('muscle_gain', 'secondary')).toBe(120);
    expect(getRestSecondsForCategory('muscle_gain', 'core')).toBe(90);
  });
  it('uses one minute for the remaining goals', () => {
    expect(getRestSecondsForCategory('fat_loss', 'main')).toBe(60);
    expect(getRestSecondsForCategory('general_fitness', 'main')).toBe(60);
    expect(getRestSecondsForCategory('nonsense', 'main')).toBe(60);
  });
  it('treats a missing category as secondary', () => {
    expect(getRestSecondsForCategory('strength', null)).toBe(180);
  });
});

describe('RIR podle týdne', () => {
  it('walks the eight week block', () => {
    expect(getRIRGuidance(1).rir).toBe(3);
    expect(getRIRGuidance(5).rir).toBe(1);
    expect(getRIRGuidance(7).label).toBe('Deload');
  });
  it('cycles after eight weeks', () => {
    expect(getRIRGuidance(9).rir).toBe(3);
    expect(getRIRGuidance(15).label).toBe('Deload');
  });
});
