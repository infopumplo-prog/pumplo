import type { TFunction } from 'i18next';

// Plan day names are stored in Czech in the DB (e.g. "Dolní tělo"). The UI must
// show them in the active language. This maps the stored Czech name to the
// localized label via i18n. Unknown / custom names pass through unchanged.
const KEY_MAP: Record<string, string> = {
  'Horní tělo': 'workout.day_upper_body',
  'Dolní tělo': 'workout.day_lower_body',
  'Celé tělo': 'workout.day_full_body',
  'Celotělový': 'workout.day_full_body',
  'Nohy': 'workout.day_leg_day',
  'Nožní den': 'workout.day_leg_day',
};

// Names that are the same in both languages (no i18n key needed).
const DIRECT: Record<string, string> = { 'Tlak': 'Push', 'Tah': 'Pull', 'Push': 'Push', 'Pull': 'Pull' };

export function localizeDayName(name: string | null | undefined, t: TFunction): string {
  if (!name) return '';
  if (DIRECT[name]) return DIRECT[name];
  if (KEY_MAP[name]) return t(KEY_MAP[name]);
  // Handle trailing " A" / " B" variants (e.g. "Celé tělo A").
  const m = name.match(/^(.+?)\s+([AB])$/);
  if (m && KEY_MAP[m[1]]) return `${t(KEY_MAP[m[1]])} ${m[2]}`;
  return name;
}
