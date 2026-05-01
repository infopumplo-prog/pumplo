import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Dumbbell, Calendar, CheckCircle, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface SharedPlanExercise {
  exercise_id: string;
  exercise_name: string;
  sets: number;
  reps: number;
  weight_kg: number | null;
  rest_seconds: number | null;
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
  if (unitType === 'time') {
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
  const [savedPlanId, setSavedPlanId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

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
            // exercise_id is the FK we need for saving — fetch it directly
            .select('day_id, exercise_id, sets, reps, weight_kg, rest_seconds, exercises(name, unit_type)')
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
            weight_kg: e.weight_kg ?? null,
            rest_seconds: e.rest_seconds ?? null,
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
          exercise_id: ex.exercise_id,   // use ID directly — no name lookup
          sets: ex.sets,
          reps: ex.reps,
          weight_kg: ex.weight_kg,
          rest_seconds: ex.rest_seconds,
          order_index: idx,
        }))
      );
    }

    sessionStorage.removeItem(PENDING_SAVE_KEY);
    setSaved(true);
    setSavedPlanId(newPlan.id);
    setIsSaving(false);
    toast({ title: 'Trénink uložen!', description: `"${plan.name}" přidán do tvých plánů.` });
    return newPlan.id;
  }, [user, plan, toast]);

  const handleSaveAndStart = useCallback(async () => {
    const planId = savedPlanId ?? await handleSave();
    if (planId) navigate(`/custom-workout/${planId}`);
  }, [savedPlanId, handleSave, navigate]);

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
                day.exercises.map((ex, j) => (
                  <div key={j} className="py-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{ex.exercise_name}</span>
                      <span className="text-xs font-semibold text-primary">
                        {ex.sets}×{formatReps(ex.reps, ex.unit_type)}
                      </span>
                    </div>
                    {(ex.weight_kg != null || ex.rest_seconds != null) && (
                      <div className="flex items-center gap-3 mt-0.5">
                        {ex.weight_kg != null && (
                          <span className="text-xs text-muted-foreground">{ex.weight_kg} kg</span>
                        )}
                        {ex.rest_seconds != null && (
                          <span className="text-xs text-muted-foreground">pauza {formatRest(ex.rest_seconds)}</span>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border px-6 pt-4 pb-8">
        {user ? (
          saved ? (
            <div className="space-y-2">
              <Button
                onClick={() => navigate(`/custom-workout/${savedPlanId}`)}
                className="w-full h-12 text-base font-semibold rounded-xl"
              >
                Spustit trénink
              </Button>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-1">
                <CheckCircle className="w-3.5 h-3.5 text-primary" />
                Uloženo do tvých plánů
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Button
                onClick={handleSaveAndStart}
                disabled={isSaving}
                className="w-full h-12 text-base font-semibold rounded-xl"
              >
                {isSaving ? 'Ukládám...' : 'Spustit trénink'}
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                variant="outline"
                className="w-full h-10 text-sm rounded-xl"
              >
                Jen uložit do plánů
              </Button>
            </div>
          )
        ) : (
          <div className="space-y-3">
            <p className="text-center text-sm text-muted-foreground">Přihlas se a spusť nebo ulož trénink</p>
            <Button
              onClick={handleLoginAndSave}
              className="w-full h-12 text-base font-semibold rounded-xl"
            >
              <LogIn className="w-5 h-5 mr-2" />
              Přihlásit se a spustit
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SharedPlan;
