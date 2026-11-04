// Check-in pro trenéra — volání Supabase (migrace 20261030_trainer_checkins_weights).
// Tabulky nejsou ve vygenerovaných typech → netypovaný klient. Bez migrace dotazy
// selžou a volající je bere jako „nic k zobrazení“.
import { supabase } from '@/integrations/supabase/client';
import { compressImageToJpeg } from '@/lib/imageCompress';
import {
  CHECKIN_PHOTO_BUCKET,
  checkinPhotoPath,
  parseFormFields,
  type CheckinAnswers,
  type CheckinField,
} from '@/lib/trainerCheckin';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

type Err = { message: string } | null;
const toErr = (e: unknown): Err => (e ? { message: String((e as { message?: unknown }).message ?? e) } : null);

export interface CheckinForm {
  id: string;
  name: string;
  fields: CheckinField[];
}

export interface TrainerCheckinRow {
  id: string;
  trainer_client_id: string;
  trainer_user_id: string;
  form_id: string | null;
  form_snapshot: CheckinField[];
  week_start: string;
  answers: Record<string, unknown>;
  weight_kg: number | null;
  submitted_at: string;
  updated_at: string;
  trainer_seen_at: string | null;
  trainer_note: string | null;
}

export interface CheckinPhotoRow {
  id: string;
  checkin_id: string;
  field_id: string;
  storage_path: string;
}

export const fetchCheckinForm = async (formId: string): Promise<CheckinForm | null> => {
  const { data, error } = await db()
    .from('trainer_checkin_forms').select('id, name, fields').eq('id', formId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { id: data.id, name: data.name, fields: parseFormFields(data.fields) };
};

export const fetchMyCheckins = async (userId: string, limit = 60): Promise<TrainerCheckinRow[]> => {
  const { data, error } = await db()
    .from('trainer_checkins')
    .select('id, trainer_client_id, trainer_user_id, form_id, form_snapshot, week_start, answers, weight_kg, submitted_at, updated_at, trainer_seen_at, trainer_note')
    .eq('client_user_id', userId)
    .order('week_start', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as (Omit<TrainerCheckinRow, 'form_snapshot'> & { form_snapshot: unknown })[]).map((r) => ({
    ...r,
    form_snapshot: parseFormFields(r.form_snapshot),
    answers: r.answers && typeof r.answers === 'object' ? r.answers : {},
    weight_kg: r.weight_kg == null ? null : Number(r.weight_kg),
  }));
};

export const fetchCheckinPhotos = async (checkinIds: string[]): Promise<CheckinPhotoRow[]> => {
  if (checkinIds.length === 0) return [];
  const { data, error } = await db()
    .from('trainer_checkin_photos').select('id, checkin_id, field_id, storage_path')
    .in('checkin_id', checkinIds).order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as CheckinPhotoRow[];
};

/** Soukromý bucket → podepsané URL (1 h). Chyba = prázdná mapa (náhledy se neukážou). */
export const signedPhotoUrls = async (paths: string[]): Promise<Map<string, string>> => {
  const map = new Map<string, string>();
  if (paths.length === 0) return map;
  try {
    const { data, error } = await supabase.storage.from(CHECKIN_PHOTO_BUCKET).createSignedUrls(paths, 3600);
    if (error) return map;
    for (const r of data ?? []) if (r.path && r.signedUrl) map.set(r.path, r.signedUrl);
  } catch { /* offline */ }
  return map;
};

export interface SaveCheckinInput {
  existingId: string | null;
  linkId: string;
  trainerUserId: string;
  userId: string;
  formId: string | null;
  fields: CheckinField[];
  answers: CheckinAnswers;
  weightKg: number | null;
  weekStart: string;
}

/** Nový check-in (insert) nebo úprava existujícího v tomto týdnu (update obsahu). */
export const saveCheckin = async (input: SaveCheckinInput): Promise<{ id: string | null; error: Err }> => {
  const content = { form_snapshot: input.fields, answers: input.answers, weight_kg: input.weightKg };
  try {
    if (input.existingId) {
      const { error } = await db().from('trainer_checkins').update(content).eq('id', input.existingId);
      return { id: error ? null : input.existingId, error: toErr(error) };
    }
    const { data, error } = await db().from('trainer_checkins').insert({
      ...content,
      trainer_client_id: input.linkId,
      trainer_user_id: input.trainerUserId,
      client_user_id: input.userId,
      form_id: input.formId,
      week_start: input.weekStart,
    }).select('id').single();
    if (error) {
      // Souběh / dvojklik: řádek pro tento týden už existuje → upravit ho.
      if ((error as { code?: string }).code === '23505') {
        const { data: row } = await db().from('trainer_checkins').select('id')
          .eq('trainer_client_id', input.linkId).eq('week_start', input.weekStart).maybeSingle();
        if (row?.id) return saveCheckin({ ...input, existingId: row.id });
      }
      return { id: null, error: toErr(error) };
    }
    return { id: data.id as string, error: null };
  } catch (e) {
    return { id: null, error: toErr(e) };
  }
};

/** Zmenšit → nahrát do bucketu → zapsat řádek. Když řádek selže, soubor se uklidí. */
export const uploadCheckinPhoto = async (p: {
  userId: string; checkinId: string; fieldId: string; index: number; file: File;
}): Promise<{ path: string | null; error: Err }> => {
  try {
    let blob: Blob;
    try {
      blob = await compressImageToJpeg(p.file);
    } catch (e) {
      // Prohlížeč neumí dekódovat (např. HEIC v Chrome) — JPEG nahrát tak, jak je.
      if (p.file.type !== 'image/jpeg') return { path: null, error: toErr(e) };
      blob = p.file;
    }
    const path = checkinPhotoPath({ clientUid: p.userId, checkinId: p.checkinId, fieldId: p.fieldId, index: p.index, ts: Date.now() });
    const { error: upErr } = await supabase.storage.from(CHECKIN_PHOTO_BUCKET)
      .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (upErr) return { path: null, error: toErr(upErr) };
    const { error: rowErr } = await db().from('trainer_checkin_photos')
      .insert({ checkin_id: p.checkinId, field_id: p.fieldId, storage_path: path });
    if (rowErr) {
      await supabase.storage.from(CHECKIN_PHOTO_BUCKET).remove([path]).catch(() => undefined);
      return { path: null, error: toErr(rowErr) };
    }
    return { path, error: null };
  } catch (e) {
    return { path: null, error: toErr(e) };
  }
};

export const deleteCheckinPhoto = async (photo: CheckinPhotoRow): Promise<{ error: Err }> => {
  try {
    const { error } = await db().from('trainer_checkin_photos').delete().eq('id', photo.id);
    if (error) return { error: toErr(error) };
    // Soubor až po řádku — osiřelý soubor nevadí, osiřelý řádek by ukazoval rozbitý náhled.
    await supabase.storage.from(CHECKIN_PHOTO_BUCKET).remove([photo.storage_path]).catch(() => undefined);
    return { error: null };
  } catch (e) {
    return { error: toErr(e) };
  }
};
