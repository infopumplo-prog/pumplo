import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Dumbbell, Calendar, CheckCircle, LogIn, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface SharedPlanExercise {
  exercise_id: string;
  exercise_name: string;
  sets: number;
  reps: number;
  reps_per_set: number[] | null;
  weight_kg: number | null;
  weight_per_set: (number | null)[] | null;
  rest_seconds: number | null;
  rest_per_set: number[] | null;
  unit_type: string | null;
}

interface SharedPlanDay {
  id: string;
  day_number: number;
  name: string | null;
  exercises: SharedPlanExercise[];
}

interface SharedPlanData {
  id: string;
  name: string;
  user_id: string;
  days: SharedPlanDay[];
}

const PENDING_SAVE_KEY = 'pumplo_pending_plan_save';

const formatReps = (reps: number, unitType: string | null) => {
  if (unitType === 'time' || unitType === 'time_min') {
    const m = Math.floor(reps / 60);
    const s = reps % 60;
    return m > 0 ? (s > 0 ? `${m}min ${s}s` : `${m} min`) : `${s}s`;
  }
  return `${reps} opak`;
};

const formatRest = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? (s > 0 ? `${m}min ${s}s` : `${m} min`) : `${s}s`;
};

const SharedPlan = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [plan, setPlan] = useState<SharedPlanData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [expandedExerciseKey, setExpandedExerciseKey] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlan = async () => {
      if (!token) { setNotFound(true); setIsLoading(false); return; }

      const { data: planData } = await supabase
        .from('custom_plans')
        .select('id, name, user_id')
        .eq('share_token', token)
        .eq('is_public', true)
        .single();

      if (!planData) { setNotFound(true); setIsLoading(false); return; }

      const { data: daysData } = await supabase
        .from('custom_plan_days')
        .select('id, day_number, name')
        .eq('plan_id', planData.id)
        .order('day_number');

      const dayIds = (daysData || []).map(d => d.id);
      const { data: exercisesData } = dayIds.length
        ? await supabase
            .from('custom_plan_exercises')
            .select('day_id, exercise_id, sets, reps, reps_per_set, weight_kg, weight_per_set, rest_seconds, rest_per_set, exercises(name, unit_type)')
            .in('day_id', dayIds)
            .order('order_index')
        : { data: [] };

      const days: SharedPlanDay[] = (daysData || []).map(d => ({
        id: d.id,
        day_number: d.day_number,
        name: d.name,
        exercises: (exercisesData || [])
          .filter((e: any) => e.day_id === d.id)
          .map((e: any) => ({
            exercise_id: e.exercise_id,
            exercise_name: e.exercises?.name || 'Cvik',
            sets: e.sets,
            reps: e.reps,
            reps_per_set: e.reps_per_set ?? null,
            weight_kg: e.weight_kg ?? null,
            weight_per_set: e.weight_per_set ?? null,
            rest_seconds: e.rest_seconds ?? null,
            rest_per_set: e.rest_per_set ?? null,
            unit_type: e.exercises?.unit_type ?? null,
          })),
      }));

      setPlan({ ...planData, days });
      setIsLoading(false);
    };

    fetchPlan();
  }, [token]);

  const handleSave = useCallback(async () => {
    if (!user || !plan) return;
    setIsSaving(true);

    const { data: newPlan, error: planError } = await supabase
      .from('custom_plans')
      .insert({ user_id: user.id, name: plan.name })
      .select('id')
      .single();

    if (planError || !newPlan) {
      toast({ title: 'Chyba při ukládání', variant: 'destructive' });
      setIsSaving(false);
      return;
    }

    for (const day of plan.days) {
      const { data: newDay } = await supabase
        .from('custom_plan_days')
        .insert({ plan_id: newPlan.id, day_number: day.day_number, name: day.name })
        .select('id')
        .single();

      if (!newDay || !day.exercises.length) continue;

      await supabase.from('custom_plan_exercises').insert(
        day.exercises.map((ex, idx) => ({
          day_id: newDay.id,
          exercise_id: ex.exercise_id,
          sets: ex.sets,
          reps: ex.reps,
          reps_per_set: ex.reps_per_set,
          weight_kg: ex.weight_kg,
          weight_per_set: ex.weight_per_set,
          rest_seconds: ex.rest_seconds,
          rest_per_set: ex.rest_per_set,
          order_index: idx,
        }))
      );
    }

    sessionStorage.removeItem(PENDING_SAVE_KEY);
    setSaved(true);
    setIsSaving(false);
    toast({ title: 'Trénink uložen!', description: `"${plan.name}" přidán do tvých plánů.` });
  }, [user, plan, toast]);

  // Auto-save after login redirect
  useEffect(() => {
    if (!user || !plan || saved || isSaving) return;
    const pending = sessionStorage.getItem(PENDING_SAVE_KEY);
    if (pending === token) {
      handleSave();
    }
  }, [user, plan, saved, isSaving, token, handleSave]);

  const handleLoginAndSave = () => {
    sessionStorage.setItem(PENDING_SAVE_KEY, token!);
    navigate(`/auth?redirect=/plan/${token}`);
  };

  const totalExercises = plan?.days.reduce((sum, d) => sum + d.exercises.length, 0) || 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
        <Dumbbell className="w-12 h-12 text-muted-foreground" />
        <h1 className="text-xl font-bold">Trénink nenalezen</h1>
        <p className="text-sm text-muted-foreground">Tento trénink byl sdílen privátně nebo odkaz již není platný.</p>
        <Button onClick={() => navigate('/')} variant="outline">Zpět domů</Button>
      </div>
    );
  }

  if (!plan) return null;

  return (
    <div className="min-h-screen bg-background safe-top pb-32">
      {/* Header */}
      <div className="px-6 pt-8 pb-4">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/')}
            className="p-2 -ml-2 rounded-xl hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-sm text-muted-foreground">Sdílený trénink</span>
        </div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold mb-3">{plan.name}</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {plan.days.length} {plan.days.length === 1 ? 'den' : plan.days.length < 5 ? 'dny' : 'dní'}
            </span>
            <span className="flex items-center gap-1.5">
              <Dumbbell className="w-4 h-4" />
              {totalExercises} {totalExercises === 1 ? 'cvik' : totalExercises < 5 ? 'cviky' : 'cviků'}
            </span>
          </div>
        </motion.div>
      </div>

      {/* Days */}
      <div className="px-6 space-y-3 mb-8">
        {plan.days.map((day, i) => (
          <motion.div
            key={day.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="bg-card border border-border rounded-2xl overflow-hidden"
          >
            <div className="px-4 py-3 bg-muted/50 border-b border-border">
              <span className="text-sm font-semibold">{day.name || `Den ${day.day_number}`}</span>
            </div>
            <div className="px-4 py-2 divide-y divide-border/50">
              {day.exercises.length === 0 ? (
                <p className="py-3 text-sm text-muted-foreground">Žádné cviky</p>
              ) : (
                day.exercises.map((ex, j) => {
                  const key = `${day.id}-${j}`;
                  const isExpanded = expandedExerciseKey === key;
                  const isCardio = ex.unit_type === 'time' || ex.unit_type === 'time_min';

                  // weight_kg is often null — derive from weight_per_set
                  const displayWeight = ex.weight_per_set?.find(w => w != null) ?? ex.weight_kg;
                  // rest_seconds defaults to 120 — prefer first value from rest_per_set
                  const displayRest = ex.rest_per_set?.[0] ?? ex.rest_seconds;

                  return (
                    <div key={j} className="py-2.5">
                      {/* Exercise header row */}
                      <button
                        onClick={() => setExpandedExerciseKey(isExpanded ? null : key)}
                        className="w-full flex items-center justify-between text-left"
                      >
                        <span className="text-sm font-medium">{ex.exercise_name}</span>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="text-xs font-semibold text-primary">
                            {ex.sets}×{formatReps(ex.reps, ex.unit_type)}
                          </span>
                          <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
                        </div>
                      </button>

                      {/* Collapsed summary line */}
                      {!isExpanded && (displayWeight != null || displayRest != null) && (
                        <div className="flex items-center gap-3 mt-0.5">
                          {displayWeight != null && (
                            <span className="text-xs text-muted-foreground">{displayWeight} kg</span>
                          )}
                          {displayRest != null && (
                            <span className="text-xs text-muted-foreground">pauza {formatRest(displayRest)}</span>
                          )}
                        </div>
                      )}

                      {/* Expanded per-set rows */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-2 space-y-1.5">
                              {Array.from({ length: ex.sets }, (_, si) => {
                                const setReps = ex.reps_per_set?.[si] ?? ex.reps;
                                const setWeight = ex.weight_per_set?.[si] ?? ex.weight_kg;
                                const setRest = ex.rest_per_set?.[si] ?? ex.rest_seconds;
                                return (
                                  <div key={si} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5 flex-wrap">
                                    <span className="text-xs font-medium text-muted-foreground w-6 shrink-0">S{si + 1}</span>
                                    {isCardio ? (
                                      <span className="text-xs">{formatReps(setReps, ex.unit_type)}</span>
                                    ) : (
                                      <>
                                        <span className="text-xs text-muted-foreground">Opak: <span className="text-foreground font-medium">{setReps}</span></span>
                                        <span className="text-xs text-muted-foreground">kg: <span className="text-foreground font-medium">{setWeight != null ? setWeight : '–'}</span></span>
                                      </>
                                    )}
                                    {setRest != null && (
                                      <span className="text-xs text-muted-foreground">Pauza: <span className="text-foreground font-medium">{setRest}s</span></span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border px-6 pt-4 pb-8">
        {user ? (
          saved ? (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-3">
              <CheckCircle className="w-4 h-4 text-primary" />
              Uloženo do tvých plánů
            </div>
          ) : (
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full h-12 text-base font-semibold rounded-xl"
            >
              {isSaving ? 'Ukládám...' : 'Uložit do mých plánů'}
            </Button>
          )
        ) : (
          <div className="space-y-3">
            <p className="text-center text-sm text-muted-foreground">Přihlas se a ulož trénink do svých plánů</p>
            <Button
              onClick={handleLoginAndSave}
              className="w-full h-12 text-base font-semibold rounded-xl"
            >
              <LogIn className="w-5 h-5 mr-2" />
              Přihlásit se a uložit
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SharedPlan;
