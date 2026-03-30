import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
  sets: number;
  reps: number;
  weight_kg: number | null;
  rest_seconds: number;
  rest_per_set: number[] | null;
  order_index: number;
}

export interface CustomPlan {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
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
        data.map((p: any) => ({
          id: p.id,
          name: p.name,
          created_at: p.created_at,
          day_count: p.custom_plan_days?.length || 0,
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

  const fetchPlan = useCallback(async () => {
    if (!planId) {
      setPlan(null);
      return;
    }
    setIsLoading(true);

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
      .select('*, exercises(name)')
      .in('day_id', (daysData || []).map(d => d.id))
      .order('order_index');

    const days: CustomPlanDay[] = (daysData || []).map(d => ({
      ...d,
      exercises: (exercisesData || [])
        .filter((e: any) => e.day_id === d.id)
        .map((e: any) => ({
          id: e.id,
          day_id: e.day_id,
          exercise_id: e.exercise_id,
          exercise_name: e.exercises?.name,
          sets: e.sets,
          reps: e.reps,
          weight_kg: e.weight_kg,
          rest_seconds: e.rest_seconds || 120,
          rest_per_set: e.rest_per_set || null,
          order_index: e.order_index,
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
    await supabase.from('custom_plan_days').update({ name }).eq('id', dayId);
    await fetchPlan();
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

  const updateExercise = async (exerciseId: string, updates: { sets?: number; reps?: number; weight_kg?: number | null; rest_seconds?: number; rest_per_set?: number[] }) => {
    await supabase.from('custom_plan_exercises').update(updates).eq('id', exerciseId);
    await fetchPlan();
  };

  const removeExercise = async (exerciseId: string) => {
    await supabase.from('custom_plan_exercises').delete().eq('id', exerciseId);
    await fetchPlan();
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
    await supabase.from('custom_plans').update({ name }).eq('id', planId);
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
    updateExercise,
    removeExercise,
    renamePlan,
    reorderExercises,
    duplicateExercise,
  };
}
