// Barva appky (Onboarding 2.0, fáze 2 — 8. 10. 2026). Každý uživatel si vybere jednu barvu,
// celá appka ji používá místo Pumplo modré. Hodnoty jsou HSL bez `hsl()` (stejný formát jako
// --primary v index.css). CSS pravidla [data-accent=…] v index.css musí odpovídat této tabulce.

export const ACCENT_COLORS = ['blue', 'pink', 'purple', 'green', 'orange', 'red'] as const;
export type AccentColor = (typeof ACCENT_COLORS)[number];
export const DEFAULT_ACCENT: AccentColor = 'blue';

/** Náhled barvy ve výběru (světlý režim). */
export const ACCENT_SWATCH: Record<AccentColor, { light: string; dark: string }> = {
  blue: { light: '195 100% 59%', dark: '205 65% 42%' },
  pink: { light: '330 81% 60%', dark: '330 62% 48%' },
  purple: { light: '262 83% 66%', dark: '262 52% 52%' },
  green: { light: '152 62% 42%', dark: '152 52% 36%' },
  orange: { light: '25 95% 53%', dark: '25 78% 46%' },
  red: { light: '0 78% 58%', dark: '0 62% 48%' },
};

export const isAccentColor = (v: unknown): v is AccentColor =>
  typeof v === 'string' && (ACCENT_COLORS as readonly string[]).includes(v);

export const asAccent = (v: unknown): AccentColor => (isAccentColor(v) ? v : DEFAULT_ACCENT);
