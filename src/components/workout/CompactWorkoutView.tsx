import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Video, X, ChevronRight, Check, SkipForward, RefreshCw, Play, Square, Timer, Info, Trophy } from 'lucide-react';
import { TRAINING_ROLE_NAMES } from '@/lib/trainingRoles';
import { supabase } from '@/integrations/supabase/client';
import { announceExercise, playAlarmBeep, playAlarmFinish } from '@/lib/workoutAudio';

const SLOT_CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  main: { label: 'Hlavní', color: 'bg-primary/15 text-primary border-primary/30' },
  secondary: { label: 'Pomocný', color: 'bg-blue-500/15 text-blue-600 border-blue-500/30' },
  isolation: { label: 'Izolace', color: 'bg-purple-500/15 text-purple-600 border-purple-500/30' },
  core_or_compensatory: { label: 'Core', color: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
  conditioning: { label: 'Kardio', color: 'bg-green-500/15 text-green-600 border-green-500/30' },
};

interface SetData {
  completed: boolean;
  weight?: number;
  reps?: number;
  durationSeconds?: number;
}

interface WorkoutExerciseCompact {
  id: string;
  exerciseId: string | null;
  exerciseName?: string;
  roleId: string;
  machineName?: string | null;
  sets: number;
  repMin: number;
  repMax: number;
  slotCategory?: string | null;
  repsPerSet?: number[] | null;
  weightPerSet?: (number | null)[] | null;
  unit_type?: string | null;
  category?: string | null;
}

interface CompactWorkoutViewProps {
  exercises: WorkoutExerciseCompact[];
  currentExerciseIndex: number;
  setsDataByExercise: Map<number, SetData[]>;
  onCompleteSet: (exerciseIndex: number, setIndex: number, weight?: number, reps?: number, durationSeconds?: number) => void;
  onSelectExercise: (index: number) => void;
  onSwitchToVideo: () => void;
  onClose: () => void;
  onSkipExercise: () => void;
  onSwapExercise?: () => void;
  isSwapping?: boolean;
  totalExercises: number;
  showTimer?: boolean;
  onShowInfo?: (exerciseId: string) => void;
  onFinishWorkout?: () => void;
}

export const CompactWorkoutView = ({
  exercises,
  currentExerciseIndex,
  setsDataByExercise,
  onCompleteSet,
  onSelectExercise,
  onSwitchToVideo,
  onClose,
  onSkipExercise,
  onSwapExercise,
  isSwapping = false,
  totalExercises,
  showTimer = false,
  onShowInfo,
  onFinishWorkout,
}: CompactWorkoutViewProps) => {
  const [weight, setWeight] = useState<string>('');
  const [reps, setReps] = useState<string>('');
  const [expandedExercise, setExpandedExercise] = useState<number | null>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  // Timer state
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const currentExercise = exercises[currentExerciseIndex];
  const currentSets = setsDataByExercise.get(currentExerciseIndex) ||
    Array.from({ length: currentExercise?.sets || 0 }, () => ({ completed: false }));
  const currentSetIndex = currentSets.findIndex(s => !s.completed);
  const allSetsComplete = currentSetIndex === -1;

  // Scroll to active exercise
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentExerciseIndex]);

  // Announce exercise — triggered after weight is loaded
  const announcedExRef = useRef<number>(-1);
  const announceCurrentExercise = useCallback((w?: string, r?: string) => {
    if (!currentExercise || announcedExRef.current === currentExerciseIndex) return;
    announcedExRef.current = currentExerciseIndex;
    const name = currentExercise.exerciseName || TRAINING_ROLE_NAMES[currentExercise.roleId as keyof typeof TRAINING_ROLE_NAMES] || '';
    const wNum = w ? parseFloat(w) : undefined;
    announceExercise(name, wNum && wNum > 0 ? wNum : undefined, r || undefined);
  }, [currentExercise, currentExerciseIndex]);

  // Timer tick
  useEffect(() => {
    if (timerRunning) {
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
    } else if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [timerRunning]);

  // Reset timer when exercise or set changes
  useEffect(() => {
    setTimerRunning(false);
    setTimerSeconds(0);
  }, [currentExerciseIndex, currentSetIndex]);

  // Stable ref so the cardio auto-complete effect can call onCompleteSet without stale closure
  const onCompleteSetRef = useRef(onCompleteSet);
  onCompleteSetRef.current = onCompleteSet;

  // Cardio auto-complete: countdown beeps at T-3/2/1, auto-complete at target
  useEffect(() => {
    if (!timerRunning || !currentExercise || allSetsComplete) return;
    const isCardio = currentExercise.unit_type === 'time_min' || currentExercise.category === 'cardio';
    if (!isCardio) return;
    const targetSec = currentExercise.repMax;
    const remaining = targetSec - timerSeconds;
    if (remaining > 0 && remaining <= 3) {
      playAlarmBeep();
    }
    if (timerSeconds >= targetSec && targetSec > 0) {
      playAlarmFinish();
      setTimerRunning(false);
      setTimerSeconds(0);
      onCompleteSetRef.current(currentExerciseIndex, currentSetIndex, undefined, targetSec, timerSeconds);
    }
  }, [timerSeconds]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-fill reps and weight for current exercise, then announce
  useEffect(() => {
    if (!currentExercise) return;
    announcedExRef.current = -1; // Reset so new exercise gets announced

    // Per-set reps (if available), fallback to repMax
    const setIdx = currentSetIndex >= 0 ? currentSetIndex : 0;
    const r = `${currentExercise.repsPerSet?.[setIdx] ?? currentExercise.repMax}`;
    setReps(r);

    // Per-set weight (if available)
    const plannedWeight = currentExercise.weightPerSet?.[setIdx];
    if (plannedWeight != null) {
      const w = `${plannedWeight}`;
      setWeight(w);
      setTimeout(() => announceCurrentExercise(w, r), 300);
      return;
    }

    // Try weight from current session's completed sets
    const sets = setsDataByExercise.get(currentExerciseIndex);
    const lastCompleted = sets?.filter(s => s.completed).pop();
    if (lastCompleted?.weight != null) {
      const w = `${lastCompleted.weight}`;
      setWeight(w);
      setTimeout(() => announceCurrentExercise(w, r), 300);
      return;
    }

    // Otherwise fetch last weight from workout history
    if (currentExercise.exerciseId) {
      supabase
        .from('workout_session_sets')
        .select('weight_kg')
        .eq('exercise_id', currentExercise.exerciseId)
        .not('weight_kg', 'is', null)
        .gt('weight_kg', 0)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
        .then(({ data }) => {
          const w = data?.weight_kg ? `${data.weight_kg}` : '';
          setWeight(w);
          setTimeout(() => announceCurrentExercise(w, r), 300);
        });
    } else {
      setWeight('');
      setTimeout(() => announceCurrentExercise('', r), 300);
    }
  }, [currentExerciseIndex, currentExercise, currentSetIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatTimer = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, []);

  const handleCompleteCurrentSet = () => {
    if (allSetsComplete || !currentExercise) return;

    // Timer mode: first tap starts, second tap stops & completes
    if (showTimer && !timerRunning && timerSeconds === 0) {
      setTimerRunning(true);
      return;
    }

    setTimerRunning(false);
    const weightNum = weight ? parseFloat(weight) : undefined;
    const repsNum = reps ? parseInt(reps) : currentExercise.repMax;
    const duration = showTimer && timerSeconds > 0 ? timerSeconds : undefined;
    onCompleteSet(currentExerciseIndex, currentSetIndex, weightNum, repsNum, duration);
    setTimerSeconds(0);
  };

  const completedTotal = exercises.reduce((sum, _, idx) => {
    const sets = setsDataByExercise.get(idx) || [];
    return sum + sets.filter(s => s.completed).length;
  }, 0);
  const totalSetsAll = exercises.reduce((sum, ex) => sum + ex.sets, 0);
  const progressPercent = totalSetsAll > 0 ? (completedTotal / totalSetsAll) * 100 : 0;

  return (
    <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-none px-4 pt-4 pb-3 border-b border-border safe-top">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 -ml-1 rounded-xl text-foreground">
            <X className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {completedTotal}/{totalSetsAll}
          </span>
          <button
            onClick={onSwitchToVideo}
            className="p-2 rounded-xl bg-muted text-foreground"
            title="Přepnout na video"
          >
            <Video className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Exercise list */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3 space-y-2">
          {exercises.map((ex, idx) => {
            const sets = setsDataByExercise.get(idx) ||
              Array.from({ length: ex.sets }, () => ({ completed: false }));
            const completedSets = sets.filter(s => s.completed).length;
            const isActive = idx === currentExerciseIndex;
            const isDone = completedSets === ex.sets;
            const isExCardio = ex.unit_type === 'time_min' || ex.category === 'cardio';
            const exTargetSec = isExCardio ? ex.repMax : 0;
            const fmtExTarget = isExCardio ? `${Math.floor(exTargetSec / 60)}:${String(exTargetSec % 60).padStart(2, '0')}` : '';

            return (
              <div
                key={ex.id}
                ref={isActive ? activeRef : undefined}
                className={`rounded-xl border transition-all ${
                  isActive
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : isDone
                    ? 'border-border/50 bg-muted/30 opacity-60'
                    : 'border-border/50 bg-muted/50'
                }`}
              >
                {/* Exercise row - always visible */}
                <div className="flex items-center gap-3 py-3 px-3">
                  <button
                    onClick={() => onSelectExercise(idx)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  >
                  {/* Status indicator */}
                  <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${
                    isDone ? 'bg-green-500/20' : isActive ? 'bg-primary/20' : 'bg-muted'
                  }`}>
                    {isDone ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <span className={`font-bold text-sm ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                        {idx + 1}
                      </span>
                    )}
                  </div>

                  {/* Name + sets progress */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className={`font-medium text-sm truncate ${isDone ? 'line-through text-muted-foreground' : ''}`}>
                        {ex.exerciseName || TRAINING_ROLE_NAMES[ex.roleId as keyof typeof TRAINING_ROLE_NAMES] || ex.roleId}
                      </p>
                      {ex.slotCategory && SLOT_CATEGORY_LABELS[ex.slotCategory] && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border shrink-0 ${SLOT_CATEGORY_LABELS[ex.slotCategory].color}`}>
                          {SLOT_CATEGORY_LABELS[ex.slotCategory].label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-muted-foreground">
                        {completedSets}/{ex.sets} sérií
                        {ex.machineName && ` · ${ex.machineName}`}
                      </p>
                      {/* Mini set dots */}
                      <div className="flex gap-0.5">
                        {sets.map((s, si) => (
                          <div
                            key={si}
                            className={`w-2 h-2 rounded-full ${
                              s.completed ? 'bg-green-500' : 'bg-muted-foreground/20'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    {/* Show completed sets summary - tap to expand */}
                    {completedSets > 0 && !isActive && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedExercise(expandedExercise === idx ? null : idx);
                        }}
                        className="text-[10px] text-primary mt-0.5 font-medium"
                      >
                        {expandedExercise === idx ? 'Skrýt detail' : `Zobrazit ${completedSets} ${completedSets === 1 ? 'sérii' : 'série'}`}
                      </button>
                    )}
                  </div>
                  </button>
                  {onShowInfo && ex.exerciseId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onShowInfo(ex.exerciseId!);
                      }}
                      className="p-2 rounded-xl text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    >
                      <Info className="w-4.5 h-4.5" />
                    </button>
                  )}
                </div>

                {/* Expanded sets detail table */}
                {expandedExercise === idx && !isActive && sets.some(s => s.completed) && (
                  <div className="px-3 pb-3 pt-1 border-t border-border/50">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-muted-foreground text-[10px]">
                          <th className="text-left font-medium py-1">Série</th>
                          <th className="text-center font-medium py-1">Váha</th>
                          <th className="text-center font-medium py-1">Opak.</th>
                          {showTimer && <th className="text-center font-medium py-1">Čas</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {sets.map((s, si) =>
                          s.completed ? (
                            <tr key={si} className="border-t border-border/30">
                              <td className="py-1.5 text-muted-foreground">{si + 1}.</td>
                              <td className="py-1.5 text-center font-medium">{s.weight ? `${s.weight} kg` : '–'}</td>
                              <td className="py-1.5 text-center font-medium">{s.reps ?? '–'}</td>
                              {showTimer && (
                                <td className="py-1.5 text-center text-muted-foreground font-mono">
                                  {s.durationSeconds ? formatTimer(s.durationSeconds) : '–'}
                                </td>
                              )}
                            </tr>
                          ) : null
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Expanded: active exercise input area */}
                {isActive && !allSetsComplete && (
                  <div className="px-3 pb-3 pt-1 border-t border-border/50">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-muted-foreground">
                        {isExCardio
                          ? `Série ${currentSetIndex + 1} / ${ex.sets} · cíl ${fmtExTarget}`
                          : `Série ${currentSetIndex + 1} / ${ex.sets} · ${ex.repMin}-${ex.repMax} opak.`}
                      </p>
                      {timerRunning && (
                        <div className="flex items-center gap-1 text-xs font-mono font-semibold text-primary">
                          <Timer className="w-3.5 h-3.5" />
                          {formatTimer(timerSeconds)}
                        </div>
                      )}
                    </div>

                    <div className="flex items-end gap-2">
                      {isExCardio ? (
                        <div className="flex-1 flex items-center justify-center h-11 bg-muted rounded-xl">
                          <Timer className="w-4 h-4 text-muted-foreground mr-2" />
                          <span className="text-base font-semibold font-mono text-foreground">
                            {timerRunning ? formatTimer(timerSeconds) : fmtExTarget}
                          </span>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1">
                            <label className="text-[10px] text-muted-foreground mb-0.5 block">Váha (kg)</label>
                            <input
                              type="number"
                              inputMode="decimal"
                              placeholder="např. 60"
                              value={weight}
                              onChange={(e) => setWeight(e.target.value)}
                              className="w-full bg-muted text-foreground text-center text-base font-semibold rounded-xl h-11 border-0 outline-none focus:ring-2 focus:ring-primary/50"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-[10px] text-muted-foreground mb-0.5 block">Opakování</label>
                            <input
                              type="number"
                              inputMode="numeric"
                              value={reps}
                              onChange={(e) => setReps(e.target.value)}
                              className="w-full bg-muted text-foreground text-center text-base font-semibold rounded-xl h-11 border-0 outline-none focus:ring-2 focus:ring-primary/50"
                            />
                          </div>
                        </>
                      )}
                      <button
                        onClick={handleCompleteCurrentSet}
                        className={`w-12 h-11 rounded-xl flex items-center justify-center shadow-sm active:scale-95 transition-transform shrink-0 ${
                          timerRunning
                            ? 'bg-red-500'
                            : isExCardio || (showTimer && timerSeconds === 0)
                            ? 'bg-green-500'
                            : 'bg-primary'
                        }`}
                      >
                        {(!timerRunning && (isExCardio || timerSeconds === 0)) ? (
                          <Play className="w-5 h-5 text-white" />
                        ) : timerRunning ? (
                          <Square className="w-5 h-5 text-white" />
                        ) : (
                          <ChevronRight className="w-6 h-6 text-white" />
                        )}
                      </button>
                    </div>

                    {/* Completed sets table for active exercise */}
                    {currentSets.some(s => s.completed) && (
                      <table className="w-full text-xs mt-2">
                        <thead>
                          <tr className="text-muted-foreground text-[10px]">
                            <th className="text-left font-medium py-1">Série</th>
                            <th className="text-center font-medium py-1">Váha</th>
                            <th className="text-center font-medium py-1">Opak.</th>
                            {showTimer && <th className="text-center font-medium py-1">Čas</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {currentSets.map((s, si) =>
                            s.completed ? (
                              <tr key={si} className="border-t border-border/30">
                                <td className="py-1 text-muted-foreground">{si + 1}.</td>
                                <td className="py-1 text-center font-medium">{s.weight ? `${s.weight} kg` : '–'}</td>
                                <td className="py-1 text-center font-medium">{s.reps ?? '–'}</td>
                                {showTimer && (
                                  <td className="py-1 text-center text-muted-foreground font-mono">
                                    {s.durationSeconds ? formatTimer(s.durationSeconds) : '–'}
                                  </td>
                                )}
                              </tr>
                            ) : null
                          )}
                        </tbody>
                      </table>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2 mt-2">
                      {onSwapExercise && (
                        <button
                          onClick={onSwapExercise}
                          disabled={isSwapping}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-muted text-muted-foreground text-xs font-medium disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isSwapping ? 'animate-spin' : ''}`} />
                          Vyměnit
                        </button>
                      )}
                      <button
                        onClick={onSkipExercise}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-muted text-muted-foreground text-xs font-medium"
                      >
                        <SkipForward className="w-3.5 h-3.5" />
                        Přeskočit
                      </button>
                    </div>
                  </div>
                )}

                {/* Active exercise: all sets done */}
                {isActive && allSetsComplete && (
                  <div className="px-3 pb-3 pt-1 border-t border-border/50">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedExercise(expandedExercise === idx ? null : idx);
                      }}
                      className="text-sm text-green-600 font-medium text-center py-2 w-full"
                    >
                      {expandedExercise === idx ? 'Skrýt detail' : '✓ Všechny série hotové'}
                    </button>
                    {expandedExercise === idx && sets.some(s => s.completed) && (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-muted-foreground text-[10px]">
                            <th className="text-left font-medium py-1">Série</th>
                            <th className="text-center font-medium py-1">Váha</th>
                            <th className="text-center font-medium py-1">Opak.</th>
                            {showTimer && <th className="text-center font-medium py-1">Čas</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {sets.map((s, si) =>
                            s.completed ? (
                              <tr key={si} className="border-t border-border/30">
                                <td className="py-1.5 text-muted-foreground">{si + 1}.</td>
                                <td className="py-1.5 text-center font-medium">{s.weight ? `${s.weight} kg` : '–'}</td>
                                <td className="py-1.5 text-center font-medium">{s.reps ?? '–'}</td>
                                {showTimer && (
                                  <td className="py-1.5 text-center text-muted-foreground font-mono">
                                    {s.durationSeconds ? formatTimer(s.durationSeconds) : '–'}
                                  </td>
                                )}
                              </tr>
                            ) : null
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Finish workout button when all sets are done */}
          {onFinishWorkout && completedTotal >= totalSetsAll && totalSetsAll > 0 && (
            <button
              onClick={onFinishWorkout}
              className="w-full mt-4 flex items-center justify-center gap-2 py-4 rounded-2xl bg-primary text-white font-semibold text-base shadow-lg shadow-primary/30 active:scale-[0.98] transition-transform"
            >
              <Trophy className="w-5 h-5" />
              Dokončit trénink
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
