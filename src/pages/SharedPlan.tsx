import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Dumbbell, Calendar, CheckCircle, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface SharedPlanDay {
  id: string;
  day_number: number;
  name: string | null;
  exercises: { exercise_name: string; sets: number; reps: number }[];
}

interface SharedPlanData {
  id: string;
  name: string;
  user_id: string;
  days: SharedPlanDay[];
}

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
            .select('day_id, sets, reps, exercises(name)')
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
            exercise_name: e.exercises?.name || 'Cvik',
            sets: e.sets,
            reps: e.reps,
          })),
      }));

      setPlan({ ...planData, days });
      setIsLoading(false);
    };

    fetchPlan();
  }, [token]);

  const totalExercises = plan?.days.reduce((sum, d) => sum + d.exercises.length, 0) || 0;

  const handleSave = async () => {
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

      if (!newDay) continue;

      const exerciseRows = day.exercises.map((ex, idx) => ({
        day_id: newDay.id,
        exercise_id: ex.exercise_name,
        sets: ex.sets,
        reps: ex.reps,
        order_index: idx,
      }));

      if (exerciseRows.length) {
        // Re-fetch exercise IDs from names
        const { data: exData } = await supabase
          .from('exercises')
          .select('id, name')
          .in('name', day.exercises.map(e => e.exercise_name));

        const nameToId = Object.fromEntries((exData || []).map(e => [e.name, e.id]));

        const rows = day.exercises
          .map((ex, idx) => ({
            day_id: newDay.id,
            exercise_id: nameToId[ex.exercise_name],
            sets: ex.sets,
            reps: ex.reps,
            order_index: idx,
          }))
          .filter(r => r.exercise_id);

        if (rows.length) {
          await supabase.from('custom_plan_exercises').insert(rows);
        }
      }
    }

    setSaved(true);
    setIsSaving(false);
    toast({ title: 'Trénink uložen!', description: `"${plan.name}" přidán do tvých plánů.` });
  };

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
                  <div key={j} className="py-2.5 flex items-center justify-between">
                    <span className="text-sm">{ex.exercise_name}</span>
                    <span className="text-xs text-muted-foreground">{ex.sets}×{ex.reps}</span>
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
            <div className="flex items-center justify-center gap-2 text-primary font-semibold py-3">
              <CheckCircle className="w-5 h-5" />
              Uloženo do tvých plánů
            </div>
          ) : (
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full h-12 text-base font-semibold rounded-xl"
            >
              {isSaving ? 'Ukládám...' : 'Uložit trénink do svých plánů'}
            </Button>
          )
        ) : (
          <div className="space-y-3">
            <p className="text-center text-sm text-muted-foreground">Přihlas se a ulož si tento trénink</p>
            <Button
              onClick={() => navigate(`/auth?redirect=/plan/${token}`)}
              className="w-full h-12 text-base font-semibold rounded-xl"
            >
              <LogIn className="w-5 h-5 mr-2" />
              Přihlásit se
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SharedPlan;
