// Tělesná váha (body_weight_entries, migrace 20261030). JEDINÉ místo, které do
// tabulky zapisuje — ruční zápis, check-in pro trenéra a (další krok) import ze
// Zdraví (Apple Health / Health Connect) přes upsertWeightEntries.
// Tabulka zatím není ve vygenerovaných typech → netypovaný klient.
import { supabase } from '@/integrations/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

export type WeightSource = 'manual' | 'checkin' | 'apple_health' | 'health_connect';

export interface BodyWeightEntry {
  id: string;
  measured_at: string;
  weight_kg: number;
  source: WeightSource;
  external_id: string | null;
}

export interface WeightEntryInput {
  measuredAt: Date | string;
  weightKg: number;
  source: WeightSource;
  /** ID záznamu ve zdroji (check-in id, HealthKit UUID…) — opakovaný zápis pak záznam upraví, nezdvojí. */
  externalId?: string | null;
}

type Err = { message: string } | null;
const toErr = (e: unknown): Err => (e ? { message: String((e as { message?: unknown }).message ?? e) } : null);
const iso = (d: Date | string) => (typeof d === 'string' ? d : d.toISOString());
const round1 = (n: number) => Math.round(n * 10) / 10;

export const fetchWeightEntries = async (userId: string, limit = 120): Promise<BodyWeightEntry[]> => {
  const { data, error } = await db()
    .from('body_weight_entries')
    .select('id, measured_at, weight_kg, source, external_id')
    .eq('user_id', userId)
    .order('measured_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as BodyWeightEntry[]).map((e) => ({ ...e, weight_kg: Number(e.weight_kg) }));
};

/**
 * Zápis jedné váhy. S externalId = „upsert“ ručně (unikátní index je částečný,
 * PostgREST on_conflict na něj nejde): najít (user, source, external_id) → update, jinak insert.
 */
export const upsertWeightEntry = async (userId: string, input: WeightEntryInput): Promise<{ error: Err }> => {
  try {
    const row = { measured_at: iso(input.measuredAt), weight_kg: round1(input.weightKg) };
    if (input.externalId) {
      const { data: existing, error: selErr } = await db()
        .from('body_weight_entries').select('id')
        .eq('user_id', userId).eq('source', input.source).eq('external_id', input.externalId)
        .maybeSingle();
      if (selErr) return { error: toErr(selErr) };
      if (existing?.id) {
        const { error } = await db().from('body_weight_entries').update(row).eq('id', existing.id);
        return { error: toErr(error) };
      }
    }
    const { error } = await db().from('body_weight_entries')
      .insert({ ...row, user_id: userId, source: input.source, external_id: input.externalId ?? null });
    return { error: toErr(error) };
  } catch (e) {
    return { error: toErr(e) };
  }
};

/** Dávkový zápis (import ze Zdraví). Sekvenčně, vrací počet chyb. */
export const upsertWeightEntries = async (userId: string, inputs: WeightEntryInput[]): Promise<{ failed: number }> => {
  let failed = 0;
  for (const input of inputs) {
    const { error } = await upsertWeightEntry(userId, input);
    if (error) failed += 1;
  }
  return { failed };
};

/** Váha z check-inu pro trenéra — jedna položka na check-in (úprava check-inu ji přepíše). */
export const upsertCheckinWeight = (userId: string, checkinId: string, weightKg: number, measuredAt: Date | string = new Date()) =>
  upsertWeightEntry(userId, { source: 'checkin', externalId: checkinId, weightKg, measuredAt });

/** Check-in bez váhy (klient ji smazal při úpravě) → odebrat i jeho záznam. */
export const removeCheckinWeight = async (userId: string, checkinId: string): Promise<{ error: Err }> => {
  try {
    const { error } = await db().from('body_weight_entries').delete()
      .eq('user_id', userId).eq('source', 'checkin').eq('external_id', checkinId);
    return { error: toErr(error) };
  } catch (e) {
    return { error: toErr(e) };
  }
};

export const deleteWeightEntry = async (id: string): Promise<{ error: Err }> => {
  try {
    const { error } = await db().from('body_weight_entries').delete().eq('id', id);
    return { error: toErr(error) };
  } catch (e) {
    return { error: toErr(e) };
  }
};
