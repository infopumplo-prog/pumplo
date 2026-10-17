import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Plus, Calendar, ChevronRight, ChevronDown, Trash2, Dumbbell, Play, Globe, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCustomPlans } from '@/hooks/useCustomPlans';
import { usePausedCustomWorkout, PausedCustomWorkoutState } from '@/hooks/usePausedCustomWorkout';
import { cycleLetter, fetchLastCustomPlanSession, type CustomPlanSessionRow } from '@/lib/customPlanCycle';
import { customDayName, useDayLabel } from '@/components/workout/CustomPlanDayChips';
import { pickHeroPlan } from '@/lib/customPlanHero';
import { useAuth } from '@/contexts/AuthContext';
import { WorkoutSessionCard } from '@/components/workout/WorkoutSessionCard';
import { cn } from '@/lib/utils';
import type { CustomPlanSummary } from '@/hooks/useCustomPlans';

const CustomPlansTab = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  // „Další: B · Pull“ — den kruhu po naposledy odcvičeném (feedback 13. 10.).
  const nextDayText = (next: NonNullable<CustomPlanSummary['next_day']>) => {
    const letter = cycleLetter(next.index);
    const name = customDayName(next, i18n.language);
    return name ? `${letter} · ${name}` : t('custom_plan.day_letter_name', { letter });
  };
  const { plans, isLoading, createPlan, deletePlan } = useCustomPlans();
  const { pausedWorkout, clearPausedWorkout } = usePausedCustomWorkout();
  const { user } = useAuth();
  const dayLabel = useDayLabel();
  const dayWord = (n: number) => n === 1 ? t('messages.day_singular') : n < 5 ? t('messages.day_2_4') : t('messages.day_plural');

  // Nahoře velká karta naposledy používaného plánu, pod ní ostatní (David 17. 10.).
  const { hero, others } = useMemo(() => pickHeroPlan(plans), [plans]);
  const [historyExpanded, setHistoryExpanded] = useState(true);
  const [lastSession, setLastSession] = useState<CustomPlanSessionRow | null>(null);
  const heroId = hero?.id ?? null;
  const heroLastAt = hero?.last_completed_at ?? null;
  useEffect(() => {
    setLastSession(null);
    if (!user || !heroId || !heroLastAt) return;
    let cancelled = false;
    fetchLastCustomPlanSession(user.id, heroId).then(row => { if (!cancelled) setLastSession(row); });
    return () => { cancelled = true; };
  }, [user, heroId, heroLastAt]);
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
    if (confirm(t('custom_plan.delete_confirm'))) {
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

  const newPlanForm = showNewPlan ? (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-2xl p-4 space-y-3"
    >
      <input
        type="text"
        placeholder={t('home.plan_name_placeholder')}
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
          {creating ? t('business.creating') : t('custom_plan.create_btn')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => { setShowNewPlan(false); setNewPlanName(''); }}
          className="rounded-xl"
        >
          {t('custom_plan.cancel_btn')}
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
      {t('custom_plan.new_plan')}
    </Button>
  );

  // Hero karta — vzhled stejný jako karta Pumplo plánu v Home.tsx.
  const renderHero = (plan: CustomPlanSummary) => {
    const days = plan.cycle_days;
    const playable = days.filter(d => d.exerciseCount > 0);
    // Víc dnů → další den kruhu; jeden den → ten jediný hratelný.
    const target = plan.next_day
      ? { id: plan.next_day.id, index: plan.next_day.index, day: plan.next_day }
      : playable[0]
        ? { id: playable[0].id, index: days.indexOf(playable[0]), day: playable[0] }
        : null;
    const isCycle = plan.day_count >= 2;
    const rowTitle = target
      ? (isCycle ? nextDayText({ ...target.day, index: target.index }) : dayLabel(target.day, target.index))
      : t('custom_plan.hero_add_exercises');
    const canStart = !!target && !pausedWorkout;
    const startPath = target ? `/custom-workout/${plan.id}?day=${target.id}` : null;
    const sessionDayIdx = lastSession?.custom_plan_day_id ? days.findIndex(d => d.id === lastSession.custom_plan_day_id) : -1;
    const sessionTitle = sessionDayIdx >= 0
      ? (() => {
          const d = days[sessionDayIdx];
          const letter = cycleLetter(sessionDayIdx);
          const custom = customDayName(d, i18n.language);
          return isCycle ? (custom ? `${letter} · ${custom}` : t('custom_plan.day_letter_name', { letter })) : (custom ?? plan.name);
        })()
      : plan.name;

    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="rounded-3xl bg-[hsl(var(--hero-card))] overflow-hidden">
          {/* Hlavička: název plánu + počet dnů → detail plánu */}
          <div
            role="button"
            tabIndex={0}
            aria-label={t('custom_plan.open_plan')}
            onClick={() => navigate(`/custom-plan/${plan.id}`)}
            className="p-6 pb-4 cursor-pointer active:opacity-90"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                  <Dumbbell className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-2xl font-bold text-white truncate flex items-center gap-1.5">
                    <span className="truncate">{plan.name}</span>
                    {plan.published_at && <Globe className="w-4 h-4 text-white/80 shrink-0" aria-label={t('public_workouts.published_badge')} />}
                  </h3>
                  <p className="text-white/70 text-sm">
                    {isCycle
                      ? t('custom_plan.hero_days_cycle', { count: plan.day_count, days: dayWord(plan.day_count) })
                      : `${plan.day_count} ${dayWord(plan.day_count)}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Smazání plánu zůstává i u hero karty (detail plánu ho nemá). */}
                <button
                  onClick={(e) => handleDelete(e, plan.id)}
                  aria-label={t('custom_plan.delete_plan')}
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-white/70 hover:bg-white/20 active:bg-white/30 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <span className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center text-white">
                  <ChevronRight className="w-5 h-5" />
                </span>
              </div>
            </div>
          </div>

          {/* Další den kruhu + ▶ spustí přímo ten den */}
          <div className="mx-3 mb-3">
            <div
              role="button"
              tabIndex={0}
              onClick={() => (canStart && startPath ? navigate(startPath) : navigate(`/custom-plan/${plan.id}`))}
              className="flex items-center gap-3 rounded-2xl p-3.5 bg-white dark:bg-[hsl(var(--hero-card-inner))] cursor-pointer active:scale-[0.98] active:brightness-95 transition-transform"
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 bg-primary text-white">
                {target ? cycleLetter(target.index) : <Plus className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate text-[#1F2937] dark:text-white">{rowTitle}</p>
                {target && (
                  <p className="text-xs text-[#6B7280] dark:text-white/60">{t('home.next_workout')}</p>
                )}
              </div>
              {canStart && (
                <span
                  aria-label={t('custom_plan.hero_start_day', { day: rowTitle })}
                  className="w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0"
                >
                  <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
                </span>
              )}
            </div>
          </div>

          {/* Poslední trénink tohoto plánu — sbalitelný jako u Pumplo plánu */}
          {lastSession && (
            <div className="mx-3 mb-3">
              <div className="flex items-center gap-3 mb-2 px-1">
                <button onClick={() => setHistoryExpanded(v => !v)} className="min-h-[44px] flex items-center gap-1.5 text-white font-semibold text-sm active:opacity-70">
                  {t('home.last_workout')}
                  <ChevronDown className={cn('w-4 h-4 transition-transform', historyExpanded && 'rotate-180')} />
                </button>
                <button onClick={() => navigate('/profile/history?tab=sessions')} className="min-h-[44px] px-2 -mr-2 ml-auto text-white/80 text-xs font-medium flex items-center gap-0.5 active:opacity-70">
                  {t('home.see_all')} <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              {historyExpanded && (
                <WorkoutSessionCard key={lastSession.id} session={lastSession} variant="compact" titleOverride={sessionTitle} hideStatsWhenCollapsed className="dark:bg-[hsl(var(--hero-card-inner))] dark:border-white/10" />
              )}
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-4">
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
              <p className="text-white/80 text-xs">{t('workout.day_paused', { day: pausedWorkout.dayName })}</p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => navigate(`/custom-workout/${pausedWorkout.planId}?resume=true`)}
              className="flex-1 py-2.5 rounded-xl bg-white text-amber-600 font-bold text-sm hover:bg-white/90 transition-colors"
            >
              {t('workout.continue_workout')}
            </button>
            <button
              onClick={clearPausedWorkout}
              className="px-4 py-2.5 rounded-xl bg-white/20 text-white font-medium text-sm hover:bg-white/30 transition-colors"
            >
              {t('custom_plan.cancel_btn')}
            </button>
          </div>
        </motion.div>
      )}

      {plans.length === 0 ? (
        <>
          {newPlanForm}
          {!showNewPlan && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Dumbbell className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">{t('home.no_custom_plans')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('home.no_custom_plans_desc')}
              </p>
            </motion.div>
          )}
        </>
      ) : (
        <>
          {hero && renderHero(hero)}

          {others.length > 0 && (
            <div className="space-y-2">
              <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('custom_plan.other_plans')}</p>
              {others.map((plan, index) => (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => navigate(`/custom-plan/${plan.id}`)}
                  className="bg-card border border-border rounded-2xl px-3.5 py-3 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Dumbbell className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-sm truncate flex items-center gap-1.5">
                        <span className="truncate">{plan.name}</span>
                        {plan.published_at && <Globe className="w-3.5 h-3.5 text-primary shrink-0" aria-label={t('public_workouts.published_badge')} />}
                      </h4>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 min-w-0">
                        <Calendar className="w-3 h-3 shrink-0" />
                        <span className="shrink-0">{plan.day_count} {dayWord(plan.day_count)}</span>
                        {plan.next_day && (
                          <span className="font-semibold text-primary flex items-center gap-1 min-w-0 ml-1">
                            <Repeat className="w-3 h-3 shrink-0" />
                            <span className="truncate">{t('custom_plan.next_day', { day: nextDayText(plan.next_day) })}</span>
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleDelete(e, plan.id)}
                      aria-label={t('custom_plan.delete_plan')}
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

          {newPlanForm}
        </>
      )}
    </div>
  );
};

export default CustomPlansTab;
