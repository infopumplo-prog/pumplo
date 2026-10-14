import { describe, expect, it } from 'vitest';
import { ACCENT_COLORS, ACCENT_SWATCH, DEFAULT_ACCENT, asAccent, isAccentColor } from './accentColors';

describe('accent colors', () => {
  it('has a swatch for every color and blue as default', () => {
    expect(DEFAULT_ACCENT).toBe('blue');
    for (const c of ACCENT_COLORS) expect(ACCENT_SWATCH[c].light).toMatch(/^\d+ \d+% \d+%$/);
  });

  it('falls back to default for unknown or missing values', () => {
    expect(asAccent('pink')).toBe('pink');
    expect(asAccent('rainbow')).toBe('blue');
    expect(asAccent(null)).toBe('blue');
    expect(isAccentColor('green')).toBe(true);
    expect(isAccentColor(42)).toBe(false);
  });

  it('matches the database check constraint', async () => {
    const { readFileSync } = await import('node:fs');
    const sql = readFileSync('supabase/migrations/20261008f_user_accent_color.sql', 'utf8');
    for (const c of ACCENT_COLORS) expect(sql).toContain(`'${c}'`);
  });
});
