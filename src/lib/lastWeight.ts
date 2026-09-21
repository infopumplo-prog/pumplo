import { supabase } from '@/integrations/supabase/client';
import { fetchWithCache } from '@/lib/offlineCache';

/**
 * Poslední zapsaná váha u cviku — s cache per uživatel, aby se předvyplnila
 * i bez signálu. Vrací stejný tvar jako Supabase dotaz ({ data }).
 */
export const fetchLastWeight = async (exerciseId: string): Promise<{ data: { weight_kg: number | null } | null }> => {
  const { data: { session } } = await supabase.auth.getSession();
  const scope = session?.user?.id ?? 'anon';
  const res = await fetchWithCache<{ weight_kg: number | null }>(scope, `lastWeight:${exerciseId}`, () =>
    supabase
      .from('workout_session_sets')
      .select('weight_kg')
      .eq('exercise_id', exerciseId)
      .not('weight_kg', 'is', null)
      .gt('weight_kg', 0)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  );
  console.info('[lastWeight] ' + JSON.stringify({ exerciseId, scope, source: res.source, data: res.data }));
  return { data: res.data };
};
