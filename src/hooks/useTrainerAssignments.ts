import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAssignmentProgress, fetchMyAssignments, fetchMyTrainers, fetchSessionTrainerFeedback } from '@/lib/trainerApi';
import { findLiveAssignmentForPlan, toLocalIsoDate, type MyTrainer, type TrainerAssignment } from '@/lib/trainerClient';

export const TRAINER_QUERY_ROOT = 'trainer-client';

interface TrainerClientData {
  assignments: TrainerAssignment[];
  trainers: MyTrainer[];
}

const EMPTY: TrainerClientData = { assignments: [], trainers: [] };

/**
 * Přiřazené plány od trenéra + moji trenéři. Plán, který klient trénuje, se tím
 * nemění — jen se podle toho ukazuje štítek „Od trenéra“ a dotaz po tréninku.
 * Chyby (offline, migrace ještě nenasazená) = prázdný stav, nikdy pád obrazovky.
 */
export const useTrainerAssignments = () => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const query = useQuery({
    queryKey: [TRAINER_QUERY_ROOT, 'assignments', userId],
    enabled: !!userId,
    retry: 1,
    queryFn: async (): Promise<TrainerClientData> => {
      if (!userId) return EMPTY;
      const [assignments, trainers] = await Promise.all([
        fetchMyAssignments(userId).catch((e) => { console.warn('[trainer] assignments not loaded', e); return [] as TrainerAssignment[]; }),
        fetchMyTrainers().catch((e) => { console.warn('[trainer] my_trainers not loaded', e); return [] as MyTrainer[]; }),
      ]);
      return { assignments, trainers };
    },
  });

  const data = query.data ?? EMPTY;
  const trainerNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const tr of data.trainers) map.set(tr.trainer_user_id, tr.trainer_name);
    return map;
  }, [data.trainers]);

  const assignmentForPlan = useCallback(
    (planId: string | null | undefined) => findLiveAssignmentForPlan(planId, data.assignments, toLocalIsoDate()),
    [data.assignments],
  );

  // Jméno trenéra: přiřazení od trenéra, se kterým spolupráce skončila, se neukazuje
  // (trainer_end_client přiřazení ukončí); kdyby my_trainers selhalo, štítek bez jména.
  const trainerNameFor = useCallback(
    (a: TrainerAssignment | null) => (a ? trainerNameById.get(a.trainer_user_id) ?? null : null),
    [trainerNameById],
  );

  return {
    assignments: data.assignments,
    trainers: data.trainers,
    isLoading: query.isLoading,
    assignmentForPlan,
    trainerNameFor,
    refetch: query.refetch,
  };
};

export const useAssignmentProgress = (assignmentId: string | null | undefined) =>
  useQuery({
    queryKey: [TRAINER_QUERY_ROOT, 'progress', assignmentId ?? null],
    enabled: !!assignmentId,
    retry: 1,
    queryFn: async () => {
      try {
        return await fetchAssignmentProgress(assignmentId!);
      } catch (e) {
        console.warn('[trainer] progress not loaded', e);
        return null;
      }
    },
  });

/** Po přijetí pozvánky / ukončení spolupráce / tréninku obnovit vše trenérské. */
export const useInvalidateTrainerData = () => {
  const queryClient = useQueryClient();
  return useCallback(() => queryClient.invalidateQueries({ queryKey: [TRAINER_QUERY_ROOT] }), [queryClient]);
};

/** Srdíčka od trenéra + vlastní hodnocení pro zobrazené tréninky (jeden dávkový dotaz). */
export const useSessionTrainerFeedback = (sessionIds: string[]) => {
  const key = [...sessionIds].sort().join(',');
  return useQuery({
    queryKey: [TRAINER_QUERY_ROOT, 'session-feedback', key],
    enabled: sessionIds.length > 0,
    retry: 1,
    // Srdíčka přibývají z trenérovy PWA → kratší čerstvost než výchozích 5 min.
    staleTime: 60_000,
    queryFn: () => fetchSessionTrainerFeedback(sessionIds),
  });
};
