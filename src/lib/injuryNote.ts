import { supabase } from '@/integrations/supabase/client';

// Popis zranění je zdravotní údaj (GDPR čl. 9) — žije ve vlastní tabulce user_injury_notes,
// kterou majitel posilovny nevidí; jen uživatel a admin Pumpla (David 17. 10.).
// Tabulka není ve vygenerovaných typech, proto `as any` jako u weekly_checkins.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const notes = () => (supabase as any).from('user_injury_notes');

/** null = žádný popis, undefined = načtení selhalo (stav neznámý — nesmí se brát jako „nic“). */
export async function loadInjuryNote(userId: string): Promise<string | null | undefined> {
  const { data, error } = await notes().select('note').eq('user_id', userId).maybeSingle();
  if (error) {
    console.error('Injury note not loaded:', error);
    return undefined;
  }
  return (data?.note as string | undefined) ?? null;
}

/** null = smazat (bez zranění nebo prázdný text), jinak uložit/přepsat. */
export async function saveInjuryNote(userId: string, note: string | null): Promise<boolean> {
  const { error } = note
    ? await notes().upsert({ user_id: userId, note, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    : await notes().delete().eq('user_id', userId);
  if (error) console.error('Injury note not saved:', error);
  return !error;
}
