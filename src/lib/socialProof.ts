import { supabase } from '@/integrations/supabase/client';

// Social proof v dotazníku (Onboarding 2.0, 8. 10. 2026): JEN skutečná čísla z databáze.
// Zaokrouhluje se DOLŮ na kulatou hranici s „+“ (254 → „250+“) — zní dobře a zůstává pravdivé.
// Čísla se nikdy nenavyšují.

export interface SocialProof {
  exercisesWithVideo: number;
  gyms: number;
  members: number;
  /** Tréninky od trenérů, které uvidí běžný nový uživatel (0 = volba „od trenéra“ se nenabídne). */
  trainerWorkouts: number;
  /** Podíl členů podle cíle, 0–1. */
  goalShare: Record<string, number>;
}

/** 254 → „250+“, 1 234 → „1 200+“, 47 → „40+“, 7 → „7“. Nikdy nevrátí víc než skutečnost. */
export const floorPlus = (n: number, locale = 'cs'): string => {
  if (!Number.isFinite(n) || n < 0) return '0';
  if (n < 10) return String(Math.floor(n));
  const step = n < 100 ? 10 : n < 1000 ? 50 : 100;
  const floored = Math.floor(n / step) * step;
  return floored === n ? floored.toLocaleString(locale) : `${floored.toLocaleString(locale)}+`;
};

/** Podíl v procentech, zaokrouhlený dolů (0,379 → 37). */
export const sharePercent = (share: number | undefined): number | null =>
  typeof share === 'number' && share > 0 ? Math.floor(share * 100) : null;

export const fetchSocialProof = async (): Promise<SocialProof | null> => {
  // Funkce zatím není ve vygenerovaných typech Supabase; volat přes klienta (ne odpojeně).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('onboarding_social_proof');
  if (error || !data) return null;
  const goalShare: Record<string, number> = {};
  for (const [k, v] of Object.entries((data.goal_share ?? {}) as Record<string, unknown>)) goalShare[k] = Number(v);
  return {
    exercisesWithVideo: Number(data.exercises_with_video) || 0,
    gyms: Number(data.gyms) || 0,
    members: Number(data.members) || 0,
    trainerWorkouts: Number(data.trainer_workouts) || 0,
    goalShare,
  };
};
