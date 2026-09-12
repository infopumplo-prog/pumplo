import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import i18n from '@/i18n';
import { useAuth } from '@/contexts/AuthContext';

export interface CustomPlanDay {
  id: string;
  plan_id: string;
  day_number: number;
  name: string | null;
  exercises: CustomPlanExercise[];
}

export interface CustomPlanExercise {
  id: string;
  day_id: string;
  exercise_id: string;
  exercise_name?: string;
  exercise_name_en?: string | null;
  machine_name?: string | null;
  machine_name_en?: string | null;
  sets: number;
  reps: number;
  reps_per_set: number[] | null;
  weight_kg: number | null;
  weight_per_set: number[] | null;
  rest_seconds: number;
  rest_per_set: number[] | null;
  // Per-exercise note (P2). Stored in custom_plan_exercises.notes (text).
  notes: string | null;
  // Per-set type W/normal/F/D (P2). Stored in custom_plan_exercises.set_types (text[]).
  set_types: (string | null)[] | null;
  // Exercise demo video (from the exercises join) — used for the card thumbnail.
  video_path: string | null;
  order_index: number;
  unit_type: string;
  category: string;
}

export interface CustomPlan {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  share_token: string;
  is_public: boolean;
  days: CustomPlanDay[];
}

export interface CustomPlanSummary {
  id: string;
  name: string;
  created_at: string;
  day_count: number;
}

export function useCustomPlans() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<CustomPlanSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPlans = useCallback(async () => {
    if (!user) {
      setPlans([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase
      .from('custom_plans')
      .select('id, name, created_at, custom_plan_days(id)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPlans(
        data.map((p) => ({
          id: p.id,
          name: p.name,
          created_at: p.created_at,
          day_count: (p.custom_plan_days as { id: string }[] | null)?.length || 0,
        }))
      );
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const createPlan = async (name: string): Promise<string | null> => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('custom_plans')
      .insert({ user_id: user.id, name })
      .select('id')
      .single();

    if (error || !data) return null;
    await fetchPlans();
    return data.id;
  };

  const deletePlan = async (planId: string) => {
    await supabase.from('custom_plans').delete().eq('id', planId);
    await fetchPlans();
  };

  const renamePlan = async (planId: string, name: string) => {
    await supabase.from('custom_plans').update({ name }).eq('id', planId);
    await fetchPlans();
  };

  return { plans, isLoading, fetchPlans, createPlan, deletePlan, renamePlan };
}

export function useCustomPlanDetail(planId: string | null) {
  const [plan, setPlan] = useState<CustomPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Latest plan snapshot, so a refetch can fall back to in-memory notes/set_types
  // when those columns aren't present in the DB yet (graceful pre-DDL behaviour).
  const planRef = useRef<CustomPlan | null>(null);
  useEffect(() => { planRef.current = plan; }, [plan]);

  const fetchPlan = useCallback(async () => {
    if (!planId) {
      setPlan(null);
      return;
    }
    // Full-screen loading only on the FIRST load. Refetches after mutations run
    // silently in the background — flipping isLoading here made the editor flash
    // its loading screen on every change (feels like a reload, not an edit).
    if (!planRef.current) setIsLoading(true);

    const { data: planData } = await supabase
      .from('custom_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (!planData) {
      setIsLoading(false);
      return;
    }

    const { data: daysData } = await supabase
      .from('custom_plan_days')
      .select('*')
      .eq('plan_id', planId)
      .order('day_number');

    const { data: exercisesData } = await supabase
      .from('custom_plan_exercises')
      .select('*, exercises(name, name_en, unit_type, category, video_path, machines!exercises_machine_id_fkey(name, name_en))')
      .in('day_id', (daysData || []).map(d => d.id))
      .order('order_index');

    type ExerciseWithJoin = {
      id: string;
      day_id: string;
      exercise_id: string;
      sets: number;
      reps: number;
      reps_per_set: number[] | null;
      weight_kg: number | null;
      weight_per_set: number[] | null;
      rest_seconds: number | null;
      rest_per_set: number[] | null;
      notes?: string | null;
      set_types?: (string | null)[] | null;
      order_index: number;
      exercises: { name: string; name_en: string | null; unit_type: string; category: string; video_path: string | null; machines: { name: string; name_en: string | null } | null } | null;
    };

    // In-memory fallback for notes/set_types (survives a refetch before the DDL
    // that adds those columns has been applied).
    const prevById = new Map<string, CustomPlanExercise>();
    planRef.current?.days.forEach(d => d.exercises.forEach(e => prevById.set(e.id, e)));

    const days: CustomPlanDay[] = (daysData || []).map(d => ({
      ...d,
      exercises: (exercisesData || [])
        .filter((e: ExerciseWithJoin) => e.day_id === d.id)
        .map((e: ExerciseWithJoin) => ({
          id: e.id,
          day_id: e.day_id,
          exercise_id: e.exercise_id,
          exercise_name: e.exercises?.name,
          exercise_name_en: e.exercises?.name_en ?? null,
          machine_name: e.exercises?.machines?.name ?? null,
          machine_name_en: e.exercises?.machines?.name_en ?? null,
          sets: e.sets,
          reps: e.reps,
          reps_per_set: e.reps_per_set || null,
          weight_kg: e.weight_kg,
          weight_per_set: e.weight_per_set || null,
          rest_seconds: e.rest_seconds ?? 120,
          rest_per_set: e.rest_per_set || null,
          notes: e.notes ?? prevById.get(e.id)?.notes ?? null,
          set_types: e.set_types ?? prevById.get(e.id)?.set_types ?? null,
          video_path: e.exercises?.video_path ?? null,
          order_index: e.order_index,
          unit_type: e.exercises?.unit_type || 'reps',
          category: e.exercises?.category || '',
        })),
    }));

    setPlan({ ...planData, days });
    setIsLoading(false);
  }, [planId]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  const addDay = async (name?: string) => {
    if (!planId) return;
    const nextNumber = (plan?.days.length || 0) + 1;
    await supabase.from('custom_plan_days').insert({
      plan_id: planId,
      day_number: nextNumber,
      name: name || `Den ${nextNumber}`,
    });
    await fetchPlan();
  };

  const removeDay = async (dayId: string) => {
    await supabase.from('custom_plan_days').delete().eq('id', dayId);
    await fetchPlan();
  };

  const renameDay = async (dayId: string, name: string) => {
    const snapshot = planRef.current;
    setPlan(prev => prev ? { ...prev, days: prev.days.map(d => d.id === dayId ? { ...d, name } : d) } : prev);
    const { error } = await supabase.from('custom_plan_days').update({ name }).eq('id', dayId);
    if (error) { setPlan(snapshot); toast.error(i18n.t('custom_plan.save_failed')); }
  };

  const addExercise = async (dayId: string, exerciseId: string, sets = 3, reps = 10, weightKg: number | null = null) => {
    const dayExercises = plan?.days.find(d => d.id === dayId)?.exercises || [];
    const nextOrder = dayExercises.length;
    await supabase.from('custom_plan_exercises').insert({
      day_id: dayId,
      exercise_id: exerciseId,
      sets,
      reps,
      weight_kg: weightKg,
      order_index: nextOrder,
    });
    await fetchPlan();
  };

  // Add several exercises to a day at once (Hevy-style multi-select), preserving
  // the order they were picked in.
  const addExercisesBatch = async (dayId: string, exerciseIds: string[], sets = 3, reps = 10) => {
    if (exerciseIds.length === 0) return;
    const dayExercises = plan?.days.find(d => d.id === dayId)?.exercises || [];
    const startOrder = dayExercises.length;
    const rows = exerciseIds.map((exercise_id, i) => ({
      day_id: dayId,
      exercise_id,
      sets,
      reps,
      weight_kg: null,
      order_index: startOrder + i,
    }));
    await supabase.from('custom_plan_exercises').insert(rows);
    await fetchPlan();
  };

  const updateExercise = async (exerciseId: string, updates: { sets?: number; reps?: number; reps_per_set?: number[]; weight_kg?: number | null; weight_per_set?: (number | null)[]; rest_seconds?: number; rest_per_set?: number[] | null; exercise_id?: string; exercise_name?: string; exercise_name_en?: string | null; notes?: string | null; set_types?: (string | null)[] | null }) => {
    // notes / set_types live in columns that may not exist yet (P2 DDL). Persist
    // them separately (best-effort) so a missing column can't fail the whole
    // update, and apply them optimistically so the UI reflects the change even
    // before the DDL is applied.
    // exercise_name / exercise_name_en jsou jen pro optimistické překreslení —
    // v tabulce custom_plan_exercises takové sloupce nejsou (zápis by spadl:
    // „Saving failed“ při výměně cviku, nález 12. 9.). Do DB jde jen exercise_id.
    const { notes, set_types, exercise_name: _n, exercise_name_en: _ne, video_path: _vp, ...known } = updates as typeof updates & { exercise_name?: string; exercise_name_en?: string | null; video_path?: string | null };
    const hasMeta = notes !== undefined || set_types !== undefined;

    // Optimistic update for EVERYTHING — every field here maps 1:1 onto the
    // local exercise row, so the UI updates instantly and no refetch is needed.
    setPlan(prev => prev ? {
      ...prev,
      days: prev.days.map(d => ({
        ...d,
        exercises: d.exercises.map(e => e.id === exerciseId ? { ...e, ...updates } : e),
      })),
    } : prev);

    if (Object.keys(known).length > 0) {
      const { error } = await supabase.from('custom_plan_exercises').update(known).eq('id', exerciseId);
      if (error) {
        console.warn('[customPlan] update failed ' + JSON.stringify({ exerciseId, known, error }));
        toast.error(i18n.t('custom_plan.save_failed'));
        fetchPlan();
      }
    }
    if (hasMeta) {
      const meta: Record<string, unknown> = {};
      if (notes !== undefined) meta.notes = notes;
      if (set_types !== undefined) meta.set_types = set_types;
      const { error } = await supabase.from('custom_plan_exercises').update(meta).eq('id', exerciseId);
      if (error) console.warn('[custom_plan] notes/set_types not persisted — apply P2 DDL:', error.message);
    }
    // Swapping the exercise itself changes joined data (video, muscles) the
    // optimistic merge can't know — refresh silently in the background.
    if (updates.exercise_id !== undefined) fetchPlan();
  };

  const removeExercise = async (exerciseId: string) => {
    // Optimistic removal — the row disappears immediately; roll back on failure.
    const snapshot = planRef.current;
    setPlan(prev => prev ? {
      ...prev,
      days: prev.days.map(d => ({ ...d, exercises: d.exercises.filter(e => e.id !== exerciseId) })),
    } : prev);
    const { error } = await supabase.from('custom_plan_exercises').delete().eq('id', exerciseId);
    if (error) { setPlan(snapshot); toast.error(i18n.t('custom_plan.save_failed')); }
  };

  const duplicateExercise = async (exerciseId: string) => {
    // Find the exercise to duplicate
    const exercise = plan?.days.flatMap(d => d.exercises).find(e => e.id === exerciseId);
    if (!exercise) return;
    const dayExercises = plan?.days.find(d => d.id === exercise.day_id)?.exercises || [];
    const nextOrder = dayExercises.length;
    await supabase.from('custom_plan_exercises').insert({
      day_id: exercise.day_id,
      exercise_id: exercise.exercise_id,
      sets: exercise.sets,
      reps: exercise.reps,
      weight_kg: exercise.weight_kg,
      order_index: nextOrder,
    });
    await fetchPlan();
  };

  const renamePlan = async (name: string) => {
    if (!planId) return;
    const snapshot = planRef.current;
    setPlan(prev => prev ? { ...prev, name } : prev);
    const { error } = await supabase.from('custom_plans').update({ name }).eq('id', planId);
    if (error) { setPlan(snapshot); toast.error(i18n.t('custom_plan.save_failed')); }
  };

  const sharePlan = async (): Promise<string | null> => {
    if (!planId) return null;
    const { data, error } = await supabase
      .from('custom_plans')
      .update({ is_public: true })
      .eq('id', planId)
      .select('share_token')
      .single();
    if (error || !data) return null;
    await fetchPlan();
    return (data as { share_token: string }).share_token;
  };

  const unsharePlan = async () => {
    if (!planId) return;
    await supabase.from('custom_plans').update({ is_public: false }).eq('id', planId);
    await fetchPlan();
  };

  const reorderExercises = async (dayId: string, orderedIds: string[]) => {
    if (!plan) return;
    // Optimistic update
    setPlan(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        days: prev.days.map(d => {
          if (d.id !== dayId) return d;
          const reordered = orderedIds
            .map((id, idx) => {
              const ex = d.exercises.find(e => e.id === id);
              return ex ? { ...ex, order_index: idx } : null;
            })
            .filter(Boolean) as CustomPlanExercise[];
          return { ...d, exercises: reordered };
        }),
      };
    });
    // Persist to DB
    await Promise.all(
      orderedIds.map((id, idx) =>
        supabase.from('custom_plan_exercises').update({ order_index: idx }).eq('id', id)
      )
    );
  };

  return {
    plan,
    isLoading,
    fetchPlan,
    addDay,
    removeDay,
    renameDay,
    addExercise,
    addExercisesBatch,
    updateExercise,
    removeExercise,
    renamePlan,
    reorderExercises,
    duplicateExercise,
    sharePlan,
    unsharePlan,
  };
}
