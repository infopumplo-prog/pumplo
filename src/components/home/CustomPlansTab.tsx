import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Calendar, ChevronRight, Trash2, Dumbbell, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCustomPlans } from '@/hooks/useCustomPlans';
import { usePausedCustomWorkout, PausedCustomWorkoutState } from '@/hooks/usePausedCustomWorkout';
import { cn } from '@/lib/utils';

const CustomPlansTab = () => {
  const navigate = useNavigate();
  const { plans, isLoading, createPlan, deletePlan } = useCustomPlans();
  const { pausedWorkout, clearPausedWorkout } = usePausedCustomWorkout();
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!newPlanName.trim()) return;
    setCreating(true);
    const planId = await createPlan(newPlanName.trim());
    setCreating(false);
    setNewPlanName('');
    setShowNewPlan(false);
    if (planId) {
      navigate(`/custom-plan/${planId}`);
    }
  };

  const handleDelete = async (e: React.MouseEvent, planId: string) => {
    e.stopPropagation();
    if (confirm('Opravdu chceš smazat tento plán?')) {
      await deletePlan(planId);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => (
          <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* New plan input */}
      {showNewPlan ? (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl p-4 space-y-3"
        >
          <input
            type="text"
            placeholder="Název plánu..."
            value={newPlanName}
            onChange={(e) => setNewPlanName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
            className="w-full bg-muted rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!newPlanName.trim() || creating}
              className="flex-1 rounded-xl"
            >
              {creating ? 'Vytvářím...' : 'Vytvořit'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setShowNewPlan(false); setNewPlanName(''); }}
              className="rounded-xl"
            >
              Zrušit
            </Button>
          </div>
        </motion.div>
      ) : (
        <Button
          onClick={() => setShowNewPlan(true)}
          variant="outline"
          className="w-full gap-2 rounded-2xl h-12 border-dashed border-2"
        >
          <Plus className="w-5 h-5" />
          Nový plán
        </Button>
      )}

      {/* Paused workout card */}
      {pausedWorkout && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/90 to-yellow-500/90 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
              <Play className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-sm truncate">{pausedWorkout.planName}</p>
              <p className="text-white/80 text-xs">{pausedWorkout.dayName} · Pozastaveno</p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => navigate(`/custom-workout/${pausedWorkout.planId}?resume=true`)}
              className="flex-1 py-2.5 rounded-xl bg-white text-amber-600 font-bold text-sm hover:bg-white/90 transition-colors"
            >
              Pokračovat v tréninku
            </button>
            <button
              onClick={clearPausedWorkout}
              className="px-4 py-2.5 rounded-xl bg-white/20 text-white font-medium text-sm hover:bg-white/30 transition-colors"
            >
              Zrušit
            </button>
          </div>
        </motion.div>
      )}

      {/* Plans list */}
      {plans.length === 0 && !showNewPlan ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Dumbbell className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">Žádné vlastní plány</h3>
          <p className="text-sm text-muted-foreground">
            Vytvoř si vlastní tréninkový plán
          </p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => navigate(`/custom-plan/${plan.id}`)}
              className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors active:scale-[0.98]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Dumbbell className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-semibold text-sm truncate">{plan.name}</h4>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {plan.day_count} {plan.day_count === 1 ? 'den' : plan.day_count < 5 ? 'dny' : 'dní'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => handleDelete(e, plan.id)}
                  className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomPlansTab;
