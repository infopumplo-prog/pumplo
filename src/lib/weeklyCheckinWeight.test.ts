import { describe, expect, it } from 'vitest';
import { parseWeightKg, weightChange } from './weeklyCheckin';

describe('parseWeightKg', () => {
  it('čárka i tečka, zaokrouhlení na desetiny', () => {
    expect(parseWeightKg('82,44')).toBe(82.4);
    expect(parseWeightKg(' 75.06 ')).toBe(75.1);
  });
  it('prázdné, nesmysl a mimo rozsah → null', () => {
    expect(parseWeightKg('')).toBeNull();
    expect(parseWeightKg('abc')).toBeNull();
    expect(parseWeightKg('12')).toBeNull();
    expect(parseWeightKg('820')).toBeNull();
  });
});

describe('weightChange', () => {
  it('bez předchozí váhy není co porovnat', () => {
    expect(weightChange(null, 80, 'fat_loss')).toBeNull();
    expect(weightChange(80, null, 'fat_loss')).toBeNull();
  });
  it('hubnutí: dolů je dobře, nahoru špatně', () => {
    expect(weightChange(82, 81.2, 'fat_loss')).toEqual({ delta: -0.8, trend: 'good' });
    expect(weightChange(82, 82.5, 'fat_loss')).toEqual({ delta: 0.5, trend: 'bad' });
  });
  it('nabírání svalů: nahoru je dobře', () => {
    expect(weightChange(70, 70.6, 'muscle_gain')).toEqual({ delta: 0.6, trend: 'good' });
    expect(weightChange(70, 69.5, 'muscle_gain')).toEqual({ delta: -0.5, trend: 'bad' });
  });
  it('síla / kondice a beze změny: neutrální', () => {
    expect(weightChange(80, 81, 'strength')).toEqual({ delta: 1, trend: 'neutral' });
    expect(weightChange(80, 80, 'fat_loss')).toEqual({ delta: 0, trend: 'neutral' });
  });
});

import { sanitizeWeightInput } from './weeklyCheckin';
describe('sanitizeWeightInput', () => {
  it('jen číslice a jedna čárka', () => {
    expect(sanitizeWeightInput('8a2.45')).toBe('82,4');
    expect(sanitizeWeightInput('82,,5')).toBe('82,5');
    expect(sanitizeWeightInput('1234')).toBe('123');
    expect(sanitizeWeightInput('-75 kg')).toBe('75');
    expect(sanitizeWeightInput('075')).toBe('75');
    expect(sanitizeWeightInput('')).toBe('');
  });
});
