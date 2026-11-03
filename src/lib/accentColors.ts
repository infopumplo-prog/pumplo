// Barva appky (Onboarding 2.0, fáze 2 — 8. 10. 2026). Každý uživatel si vybere jednu barvu,
// celá appka ji používá místo Pumplo modré. Hodnoty jsou HSL bez `hsl()` (stejný formát jako
// --primary v index.css). CSS pravidla [data-accent=…] v index.css musí odpovídat této tabulce.

export const ACCENT_COLORS = ['blue', 'pink', 'purple', 'green', 'orange', 'red'] as const;
export type AccentColor = (typeof ACCENT_COLORS)[number];
export const DEFAULT_ACCENT: AccentColor = 'blue';

/** Náhled barvy ve výběru (světlý režim). */
export const ACCENT_SWATCH: Record<AccentColor, { light: string; dark: string }> = {
  blue: { light: '195 100% 59%', dark: '199 95% 48%' },
  pink: { light: '330 90% 56%', dark: '330 88% 55%' },
  purple: { light: '265 90% 63%', dark: '265 85% 62%' },
  green: { light: '150 80% 40%', dark: '150 75% 40%' },
  orange: { light: '22 100% 52%', dark: '22 100% 52%' },
  red: { light: '0 88% 56%', dark: '0 88% 56%' },
};

export const isAccentColor = (v: unknown): v is AccentColor =>
  typeof v === 'string' && (ACCENT_COLORS as readonly string[]).includes(v);

export const asAccent = (v: unknown): AccentColor => (isAccentColor(v) ? v : DEFAULT_ACCENT);
