// Volání trenérské platformy (migrace 20261026_trainer_platform). Tabulky a RPC
// zatím nejsou ve vygenerovaných typech → netypovaný klient. Pozor: `rpc` volat
// vždy přes objekt klienta (odtržené `supabase.rpc` ztratí `this`).
import { supabase } from '@/integrations/supabase/client';
import type { MyTrainer, SessionFeedbackUpdate, TrainerAssignment } from '@/lib/trainerClient';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const untyped = () => supabase as any;

export interface TrainerInviteInfo {
  trainer_name: string;
  trainer_photo: string | null;
  is_valid: boolean;
}

export interface AcceptInviteResult {
  link_id: string;
  trainer_name: string;
  status: string;
}

export interface AssignmentProgress {
  done_sessions: number;
  target_sessions: number;
  progress_pct: number;
  end_date: string | null;
}

type Result<T> = { data: T; error: null } | { data: null; error: { message: string; code?: string } };

const firstRow = <T,>(data: unknown): T | null => {
  if (Array.isArray(data)) return (data[0] as T) ?? null;
  return (data as T) ?? null;
};

const asError = (e: unknown): { message: string; code?: string } => {
  if (e && typeof e === 'object' && 'message' in e) {
    const err = e as { message?: unknown; code?: unknown };
    return { message: String(err.message ?? ''), code: typeof err.code === 'string' ? err.code : undefined };
  }
  return { message: String(e ?? 'unknown') };
};

/** Info o pozvánce (volatelné i nepřihlášeným). data = null → token neexistuje. */
export const fetchTrainerInviteInfo = async (token: string): Promise<Result<TrainerInviteInfo | null>> => {
  try {
    const { data, error } = await untyped().rpc('trainer_invite_info', { p_token: token });
    if (error) return { data: null, error: asError(error) };
    return { data: firstRow<TrainerInviteInfo>(data), error: null };
  } catch (e) {
    return { data: null, error: asError(e) };
  }
};

export const acceptTrainerInvite = async (token: string): Promise<Result<AcceptInviteResult | null>> => {
  try {
    const { data, error } = await untyped().rpc('trainer_accept_invite', { p_token: token });
    if (error) return { data: null, error: asError(error) };
    return { data: firstRow<AcceptInviteResult>(data), error: null };
  } catch (e) {
    return { data: null, error: asError(e) };
  }
};

export const fetchMyTrainers = async (): Promise<MyTrainer[]> => {
  const { data, error } = await untyped().rpc('my_trainers');
  if (error) throw error;
  return (data ?? []) as MyTrainer[];
};

export const fetchMyAssignments = async (userId: string): Promise<TrainerAssignment[]> => {
  const { data, error } = await untyped()
    .from('trainer_plan_assignments')
    .select('id, trainer_client_id, trainer_user_id, plan_id, plan_name, start_date, weeks, sessions_per_week, ended_at')
    .eq('client_user_id', userId)
    .is('ended_at', null)
    .order('start_date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as TrainerAssignment[];
};

export const fetchAssignmentProgress = async (assignmentId: string): Promise<AssignmentProgress | null> => {
  const { data, error } = await untyped().rpc('trainer_assignment_progress', { p_assignment: assignmentId });
  if (error) throw error;
  return firstRow<AssignmentProgress>(data);
};

export const endTrainerCooperation = async (linkId: string): Promise<{ error: { message: string } | null }> => {
  try {
    const { error } = await untyped().rpc('trainer_end_client', { p_link: linkId });
    return { error: error ? asError(error) : null };
  } catch (e) {
    return { error: asError(e) };
  }
};

export const saveSessionFeedback = async (sessionId: string, update: SessionFeedbackUpdate): Promise<{ error: { message: string } | null }> => {
  try {
    const { error } = await untyped().from('workout_sessions').update(update).eq('id', sessionId);
    return { error: error ? asError(error) : null };
  } catch (e) {
    return { error: asError(e) };
  }
};

export interface SessionTrainerFeedback {
  /** session_id → trenér dal srdíčko */
  hearts: Set<string>;
  /** session_id → vlastní hodnocení klienta */
  own: Map<string, { difficulty: number | null; note: string | null }>;
}

/** Srdíčka a vlastní hodnocení pro viditelné tréninky — dva dávkové dotazy, chyby = prázdno. */
export const fetchSessionTrainerFeedback = async (sessionIds: string[]): Promise<SessionTrainerFeedback> => {
  const result: SessionTrainerFeedback = { hearts: new Set(), own: new Map() };
  if (sessionIds.length === 0) return result;
  const [reactions, own] = await Promise.all([
    untyped().from('trainer_session_reactions').select('session_id').in('session_id', sessionIds)
      .then((r: { data: { session_id: string }[] | null; error: unknown }) => r, () => ({ data: null, error: true })),
    untyped().from('workout_sessions').select('id, client_difficulty, client_note').in('id', sessionIds)
      .then((r: { data: { id: string; client_difficulty: number | null; client_note: string | null }[] | null; error: unknown }) => r, () => ({ data: null, error: true })),
  ]);
  if (!reactions.error) for (const r of reactions.data ?? []) result.hearts.add(r.session_id);
  if (!own.error) {
    for (const s of own.data ?? []) {
      if (s.client_difficulty != null || (s.client_note && s.client_note.trim())) {
        result.own.set(s.id, { difficulty: s.client_difficulty ?? null, note: s.client_note ?? null });
      }
    }
  }
  return result;
};

/** Souhlas klienta: trenér vidí jeho váhy (vč. dat ze Zdraví). Migrace 20261030. */
export const setWeightSharing = async (linkId: string, share: boolean): Promise<{ error: { message: string } | null }> => {
  try {
    const { error } = await untyped().rpc('set_weight_sharing', { p_link: linkId, p_share: share });
    return { error: error ? asError(error) : null };
  } catch (e) {
    return { error: asError(e) };
  }
};
