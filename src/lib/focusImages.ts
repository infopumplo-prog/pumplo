// Fotky partií pro výběr tréninku / cviků (feedback 13. 10.).
//
// Jediné místo, kde se mapuje partie → fotka. Fotky leží v public/img/workouts/
// a jsou součástí buildu. Novou fotku stačí nahrát pod přesným jménem souboru
// (JPG, ideálně ~600×800 px na výšku, do 50 kB) a přepsat cestu níže:
//
//   focus-full_body.jpg   celé tělo
//   focus-glutes.jpg      zadek
//   focus-legs.jpg        nohy
//   focus-chest.jpg       prsa
//   focus-back.jpg        záda
//   focus-shoulders.jpg   ramena
//   focus-arms.jpg        paže (zatím i biceps / triceps)
//   focus-core.jpg        střed těla / břicho
//   focus-cardio.jpg      kardio
//   focus-biceps.jpg      (zatím chybí → použije se focus-arms.jpg)
//   focus-triceps.jpg     (zatím chybí → použije se focus-arms.jpg)
//   focus-calves.jpg      lýtka
//
// Sada 15. 10. 2026: jednotný styl (tmavá posilovna, boční světlo, neutrální barvy),
// vygenerováno v Higgsfieldu (Nano Banana), originály ve vaultu pumplo/assets/focus-2026-10-15.
//
// Hodnota null = fotka zatím není, dlaždice ukáže ikonu na barvě appky.
// Když soubor chybí nebo se nenačte, dlaždice taky spadne na ikonu (onError).

const BASE = '/img/workouts';

export const FOCUS_IMAGES: Record<string, string | null> = {
  // Partie veřejných tréninků (WORKOUT_FOCUSES)
  full_body: `${BASE}/focus-full_body.jpg`,
  glutes: `${BASE}/focus-glutes.jpg`,
  legs: `${BASE}/focus-legs.jpg`,
  chest: `${BASE}/focus-chest.jpg`,
  back: `${BASE}/focus-back.jpg`,
  shoulders: `${BASE}/focus-shoulders.jpg`,
  arms: `${BASE}/focus-arms.jpg`,
  core: `${BASE}/focus-core.jpg`,
  cardio: `${BASE}/focus-cardio.jpg`,
  // Svalové skupiny výběru cviků (ExercisePicker)
  biceps: `${BASE}/focus-arms.jpg`,
  triceps: `${BASE}/focus-arms.jpg`,
  calves: `${BASE}/focus-calves.jpg`,
};

/** Fotka partie, nebo null (→ fallback ikona). */
export const focusImageFor = (key: string | null | undefined): string | null =>
  (key && FOCUS_IMAGES[key]) || null;
