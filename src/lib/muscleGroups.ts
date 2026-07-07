// Hevy-like muscle groups mapped onto the messy real primary_muscles /
// secondary_muscles values. Shared by the Log Workout muscle-distribution sheet
// (and mirrors the private grouping used inside ExercisePicker's muscle filter).
// Group keys line up with the existing custom_plan.muscle_<key> i18n labels.

const norm = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const MUSCLE_GROUPS: { key: string; match: string[] }[] = [
  { key: 'chest', match: ['prsa', 'prsní', 'chest', 'horní prsa', 'spodní prsa', 'horni prsa', 'pectoral'] },
  { key: 'back', match: ['záda', 'back', 'laty', 'latisi', 'latysi', 'latissim', 'lopatky', 'trapéz', 'trapez', 'traps', 'pilovitý', 'pilovity', 'rhomboid', 'wide_back', 'střed zad', 'stred zad', 'serratus'] },
  { key: 'shoulders', match: ['ramena', 'shoulders', 'front_shoulders', 'side_shoulders', 'deltoid', 'deltov'] },
  { key: 'biceps', match: ['biceps'] },
  { key: 'triceps', match: ['triceps'] },
  { key: 'legs', match: ['nohy', 'nožní', 'kvadriceps', 'quadriceps', 'quads', 'dolní konč', 'dolni konc', 'hamstring', 'front_thigh', 'back_thigh', 'adduktor', 'abduktor', 'adductor', 'abductor'] },
  { key: 'glutes', match: ['zadek', 'glute', 'hýždě', 'hyzde'] },
  { key: 'calves', match: ['lýtka', 'lytka', 'calves', 'calf'] },
  { key: 'core', match: ['břišní', 'brisni', 'břicho', 'bricho', 'střed těla', 'stred tela', 'core', 'abs', 'bedra', 'šikmé', 'sikme', 'oblique', 'stabiliz'] },
  { key: 'arms', match: ['paže', 'paze', 'ruce', 'předloktí', 'predlokti', 'forearm'] },
];

// Returns the group key for a raw muscle string, or null when nothing matches
// (caller then falls back to the muscle's own translated label).
export const groupForMuscle = (muscle: string): string | null => {
  const text = norm(muscle);
  for (const g of MUSCLE_GROUPS) {
    if (g.match.some(m => text.includes(norm(m)))) return g.key;
  }
  return null;
};
