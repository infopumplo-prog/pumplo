// Home „Vlastní trénink“: velká karta pro naposledy používaný plán (David 17. 10.).
// Čistá funkce bez Supabase, aby šla otestovat.

export interface HeroCandidate {
  id: string;
  created_at: string;
  /** Kdy byl z plánu naposledy dokončen trénink (null = nikdy). */
  last_completed_at: string | null;
}

const ts = (iso: string | null | undefined): number => {
  const n = iso ? new Date(iso).getTime() : NaN;
  return Number.isFinite(n) ? n : -Infinity;
};

/**
 * Naposledy používaný plán = nejnovější dokončený trénink; když žádný plán
 * odcvičený není, nejnověji vytvořený. Zbytek v původním pořadí.
 */
export const pickHeroPlan = <T extends HeroCandidate>(plans: T[]): { hero: T | null; others: T[] } => {
  if (plans.length === 0) return { hero: null, others: [] };
  let hero = plans[0];
  for (const p of plans) {
    const a = ts(p.last_completed_at);
    const b = ts(hero.last_completed_at);
    if (a > b || (a === b && ts(p.created_at) > ts(hero.created_at))) hero = p;
  }
  return { hero, others: plans.filter(p => p !== hero) };
};
