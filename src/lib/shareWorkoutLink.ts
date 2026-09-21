import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { supabase } from '@/integrations/supabase/client';

// Sdílení odtrénovaného tréninku odkazem (David 21. 9.): z tréninku se vytvoří
// jednodenní vlastní plán, zveřejní se (is_public + share_token) a pošle se
// odkaz /plan/<token> přes systémové sdílení (SMS, WhatsApp, IG zpráva…).
// Příjemce otevře existující stránku SharedPlan a uloží si trénink jako vlastní.
// Stejný trénink se sdílí opakovaně přes týž plán (klíč v localStorage).

export interface ShareableExercise {
  exerciseId: string | null;
  name: string;
  sets: { reps: number; weightKg: number }[];
}

const KEY = (sessionKey: string) => `pumplo:shared-plan:${sessionKey}`;

function shareUrl(token: string): string {
  const base = Capacitor.isNativePlatform()
    ? (import.meta.env.VITE_WEB_APP_URL || 'https://app.pumplo.com')
    : window.location.origin;
  return `${base}/plan/${token}`;
}

async function ensurePlan(sessionKey: string, name: string, exercises: ShareableExercise[]): Promise<string> {
  try {
    const cached = localStorage.getItem(KEY(sessionKey));
    if (cached) {
      const { data } = await supabase.from('custom_plans').select('share_token, is_public').eq('id', cached).maybeSingle();
      if (data?.share_token) {
        if (!data.is_public) await supabase.from('custom_plans').update({ is_public: true }).eq('id', cached);
        return data.share_token as string;
      }
    }
  } catch { /* cache miss → nový plán */ }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not signed in');
  const usable = exercises.filter(e => e.exerciseId && e.sets.length > 0);
  if (!usable.length) throw new Error('no exercises');

  const { data: plan, error: pe } = await supabase
    .from('custom_plans')
    .insert({ user_id: user.id, name, is_public: true })
    .select('id, share_token')
    .single();
  if (pe || !plan) throw pe ?? new Error('plan insert failed');

  const { data: day, error: de } = await supabase
    .from('custom_plan_days')
    .insert({ plan_id: plan.id, day_number: 1, name })
    .select('id')
    .single();
  if (de || !day) throw de ?? new Error('day insert failed');

  const rows = usable.map((e, idx) => ({
    day_id: day.id,
    exercise_id: e.exerciseId,
    sets: e.sets.length,
    reps: e.sets[0]?.reps || 10,
    reps_per_set: e.sets.map(s => s.reps || 0),
    weight_kg: e.sets[0]?.weightKg || null,
    weight_per_set: e.sets.map(s => s.weightKg || null),
    order_index: idx,
  }));
  const { error: ee } = await supabase.from('custom_plan_exercises').insert(rows as never);
  if (ee) throw ee;

  try { localStorage.setItem(KEY(sessionKey), plan.id); } catch { /* noop */ }
  return (plan as { share_token: string }).share_token;
}

/** Vytvoří (nebo znovu použije) sdílený plán a otevře systémové sdílení. Vrací URL, nebo null při zrušení. */
export async function shareWorkoutAsLink(opts: {
  sessionKey: string;
  name: string;
  exercises: ShareableExercise[];
  title: string;
  text: string;
}): Promise<{ url: string; copied: boolean } | null> {
  const token = await ensurePlan(opts.sessionKey, opts.name, opts.exercises);
  const url = shareUrl(token);
  if (Capacitor.isNativePlatform()) {
    try { await Share.share({ title: opts.title, text: opts.text, url, dialogTitle: opts.title }); return { url, copied: false }; }
    catch (e) { if ((e as Error).message?.toLowerCase().includes('cancel')) return null; }
  }
  if (navigator.share) {
    try { await navigator.share({ title: opts.title, text: opts.text, url }); return { url, copied: false }; }
    catch (e) { if ((e as Error).name === 'AbortError') return null; }
  }
  await navigator.clipboard?.writeText(url);
  return { url, copied: true };
}
