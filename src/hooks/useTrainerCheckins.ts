import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { TRAINER_QUERY_ROOT, useTrainerAssignments } from '@/hooks/useTrainerAssignments';
import { fetchCheckinForm, fetchMyCheckins, type TrainerCheckinRow } from '@/lib/trainerCheckinApi';
import { checkinWeekStart, hasCheckinConfigured, isCheckinDue } from '@/lib/trainerCheckin';
import { fetchWeightEntries } from '@/lib/bodyWeight';
import type { MyTrainer } from '@/lib/trainerClient';

const RECHECK_MS = 5 * 60 * 1000;

/** „Teď“, které se samo posouvá (aby karta naskočila o půlnoci i bez reloadu). */
const useNow = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), RECHECK_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') setNow(new Date()); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, []);
  return now;
};

/**
 * Check-iny pro trenéry. Bez trenéra s nastaveným check-inem se nic nenačítá
 * a vše je prázdné; chyba (offline, chybí migrace) = prázdno, nikdy pád.
 */
export const useTrainerCheckins = () => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { trainers, isLoading: trainersLoading } = useTrainerAssignments();
  const now = useNow();

  const configured = useMemo(() => trainers.filter((tr) => hasCheckinConfigured(tr)), [trainers]);

  const query = useQuery({
    queryKey: [TRAINER_QUERY_ROOT, 'checkins', userId],
    enabled: !!userId && configured.length > 0,
    retry: 1,
    staleTime: 60_000,
    queryFn: async (): Promise<TrainerCheckinRow[] | null> => {
      try {
        return await fetchMyCheckins(userId!);
      } catch (e) {
        console.warn('[trainer] check-ins not loaded', e);
        return null; // null = nevíme → kartu neukazovat (nepřemlouvat k duplicitě)
      }
    },
  });

  const checkins = useMemo(() => query.data ?? [], [query.data]);
  const byLink = useMemo(() => {
    const map = new Map<string, TrainerCheckinRow[]>();
    for (const c of checkins) {
      const list = map.get(c.trainer_client_id) ?? [];
      list.push(c);
      map.set(c.trainer_client_id, list);
    }
    return map;
  }, [checkins]);

  const due: MyTrainer[] = useMemo(() => {
    if (!query.data) return [];
    return configured.filter((tr) => isCheckinDue(tr, now, (byLink.get(tr.link_id) ?? []).map((c) => c.week_start)));
  }, [configured, byLink, now, query.data]);

  const weekStart = checkinWeekStart(now);
  const thisWeekFor = (linkId: string) => (byLink.get(linkId) ?? []).find((c) => c.week_start === weekStart) ?? null;

  return {
    configured,
    due,
    byLink,
    thisWeekFor,
    weekStart,
    now,
    /** Stav je známý (pro rozhodnutí, jestli smí naskočit osobní check-in). */
    settled: !trainersLoading && (configured.length === 0 || !query.isLoading),
    refetch: query.refetch,
  };
};

export const useCheckinForm = (formId: string | null | undefined) =>
  useQuery({
    queryKey: [TRAINER_QUERY_ROOT, 'checkin-form', formId ?? null],
    enabled: !!formId,
    retry: 1,
    queryFn: async () => {
      try {
        return await fetchCheckinForm(formId!);
      } catch (e) {
        console.warn('[trainer] check-in form not loaded', e);
        return null;
      }
    },
  });

export const useBodyWeights = (enabled = true) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  return useQuery({
    queryKey: [TRAINER_QUERY_ROOT, 'body-weights', userId],
    enabled: enabled && !!userId,
    retry: 1,
    queryFn: () => fetchWeightEntries(userId!),
  });
};
