import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Video, X, ChevronRight, Check, SkipForward, RefreshCw, Play, Pause, Square, Timer, Info, Trophy, Plus } from 'lucide-react';
import { TRAINING_ROLE_NAMES } from '@/lib/trainingRoles';
import { supabase } from '@/integrations/supabase/client';
import { playCountdown3, playCountdown2, playCountdown1, playAlarmFinish, playBeep, unlockAudio } from '@/lib/workoutAudio';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { setBadgeLabel, setBadgeColor, getSetType } from '@/lib/setTypes';
import { getVideoThumbUrl } from '@/lib/videoUtils';
import { useLongPress } from '@/lib/useLongPress';

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
  exerciseNameEn?: string | null;
  roleId: string;
  machineName?: string | null;
  machineNameEn?: string | null;
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
  onSwapLongPress?: () => void;
  isSwapping?: boolean;
  totalExercises: number;
  showTimer?: boolean;
  onShowInfo?: (exerciseId: string) => void;
  onFinishWorkout?: () => void;
  onAddExercise?: () => void;
  // External cardio timer — when provided, CompactWorkoutView delegates timer control to parent
  externalCardioSecondsRemaining?: number;
  externalCardioPaused?: boolean;
  onToggleCardioPause?: () => void;
  // Controlled weight/reps — when provided, parent is single source of truth
  currentSetWeight?: string;
  currentSetReps?: string;
  onCurrentSetWeightChange?: (v: string) => void;
  onCurrentSetRepsChange?: (v: string) => void;
  // Optional per-exercise set types (W/normal/F/D) for badges + ? explanations.
  setTypesByExercise?: Map<number, (string | null)[]>;
  onExplainSetType?: (type: string) => void;
  // Workout start (drives the Doba stat, Log Workout header parity)
  startTime?: Date;
  // Read-only per-exercise rest length (Pumplo drives rests, no editing)
  restSecondsByIndex?: number[];
  // Edit weight/reps of an already completed set (Hevy parity: going back to
  // a finished exercise and fixing the numbers).
  onEditSet?: (exerciseIndex: number, setIndex: number, weight?: number, reps?: number) => void;
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
  onSwapLongPress,
  isSwapping = false,
  totalExercises,
  showTimer = false,
  onShowInfo,
  onFinishWorkout,
  onAddExercise,
  externalCardioSecondsRemaining,
  externalCardioPaused,
  onToggleCardioPause,
  currentSetWeight,
  currentSetReps,
  onCurrentSetWeightChange,
  onCurrentSetRepsChange,
  setTypesByExercise,
  onExplainSetType,
  startTime,
  restSecondsByIndex,
  onEditSet,
}: CompactWorkoutViewProps) => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';

  // SÉRIE-column label: a coloured W/F/D/number badge when set types exist,
  // otherwise the plain "1." numbering used by the generated-plan player.
  const renderSetLabel = (exIdx: number, si: number) => {
    const types = setTypesByExercise?.get(exIdx);
    if (!types) return `${si + 1}.`;
    return <span className={cn('font-bold', setBadgeColor(types, si))}>{setBadgeLabel(types, si)}</span>;
  };

  const slotCategoryLabels: Record<string, { label: string; color: string }> = {
    main: { label: t('slot.main'), color: 'bg-primary/15 text-primary border-primary/30' },
    secondary: { label: t('slot.secondary'), color: 'bg-blue-500/15 text-blue-600 border-blue-500/30' },
    isolation: { label: t('slot.isolation'), color: 'bg-purple-500/15 text-purple-600 border-purple-500/30' },
    core_or_compensatory: { label: t('slot.core'), color: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
    conditioning: { label: t('slot.conditioning'), color: 'bg-green-500/15 text-green-600 border-green-500/30' },
  };

  const [weight, setWeight] = useState<string>('');
  const [reps, setReps] = useState<string>('');

  // When parent passes controlled weight/reps, use those as source of truth
  const effectiveWeight = currentSetWeight !== undefined ? currentSetWeight : weight;
  const effectiveReps = currentSetReps !== undefined ? currentSetReps : reps;
  const setEffectiveWeight = (v: string) => onCurrentSetWeightChange ? onCurrentSetWeightChange(v) : setWeight(v);
  const setEffectiveReps = (v: string) => onCurrentSetRepsChange ? onCurrentSetRepsChange(v) : setReps(v);
  const activeRef = useRef<HTMLDivElement>(null);

  // Timer state
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerStartRef = useRef<number | null>(null);

  const currentExercise = exercises[currentExerciseIndex];
  const currentSets = setsDataByExercise.get(currentExerciseIndex) ||
    Array.from({ length: currentExercise?.sets || 0 }, () => ({ completed: false }));
  const currentSetIndex = currentSets.findIndex(s => !s.completed);
  const allSetsComplete = currentSetIndex === -1;

  // Scroll to active exercise
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentExerciseIndex]);


  // Timer tick — timestamp-based so background throttling doesn't desync it
  useEffect(() => {
    if (timerRunning) {
      timerIntervalRef.current = setInterval(() => {
        if (timerStartRef.current === null) return;
        setTimerSeconds(Math.floor((Date.now() - timerStartRef.current) / 1000));
      }, 500);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [timerRunning]);

  // Resync timer when app returns from background
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && timerStartRef.current !== null) {
        setTimerSeconds(Math.floor((Date.now() - timerStartRef.current) / 1000));
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Reset timer when exercise or set changes
  useEffect(() => {
    setTimerRunning(false);
    setTimerSeconds(0);
    timerStartRef.current = null;
  }, [currentExerciseIndex, currentSetIndex]);

  // Stable ref so the cardio auto-complete effect can call onCompleteSet without stale closure
  const onCompleteSetRef = useRef(onCompleteSet);
  onCompleteSetRef.current = onCompleteSet;

  // Cardio auto-complete: countdown beeps at T-3/2/1, auto-complete at target
  useEffect(() => {
    if (externalCardioSecondsRemaining !== undefined) return; // parent handles beeps + completion
    if (!timerRunning || !currentExercise || allSetsComplete) return;
    const isCardio = currentExercise.unit_type === 'time_min' || currentExercise.category === 'cardio';
    if (!isCardio) return;
    const targetSec = currentExercise.repMax;
    const remaining = targetSec - timerSeconds;
    if (remaining === 3) playCountdown3();
    if (remaining === 2) playCountdown2();
    if (remaining === 1) playCountdown1();
    if (timerSeconds >= targetSec && targetSec > 0) {
      playAlarmFinish();
      setTimerRunning(false);
      timerStartRef.current = null;
      setTimerSeconds(0);
      onCompleteSetRef.current(currentExerciseIndex, currentSetIndex, undefined, targetSec, timerSeconds);
    }
  }, [timerSeconds]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-fill reps and weight for current exercise (skipped when parent controls via props)
  useEffect(() => {
    if (currentSetWeight !== undefined) return;
    if (!currentExercise) return;

    const setIdx = currentSetIndex >= 0 ? currentSetIndex : 0;
    const r = `${currentExercise.repsPerSet?.[setIdx] ?? currentExercise.repMax}`;
    setReps(r);

    const isCardio = currentExercise.unit_type === 'time_min' || currentExercise.category === 'cardio';
    if (isCardio) {
      setWeight('');
      return;
    }

    const plannedWeight = currentExercise.weightPerSet?.[setIdx];
    if (plannedWeight != null) {
      setWeight(`${plannedWeight}`);
      return;
    }

    const sets = setsDataByExercise.get(currentExerciseIndex);
    const lastCompleted = sets?.filter(s => s.completed).pop();
    if (lastCompleted?.weight != null) {
      setWeight(`${lastCompleted.weight}`);
      return;
    }

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
          setWeight(data?.weight_kg ? `${data.weight_kg}` : '');
        });
    } else {
      setWeight('');
    }
  }, [currentExerciseIndex, currentExercise, currentSetIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatTimer = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, []);

  const handleCompleteCurrentSet = () => {
    if (allSetsComplete || !currentExercise) return;

    // External cardio timer: button is pause/resume toggle
    if (externalCardioSecondsRemaining !== undefined) {
      unlockAudio();
      onToggleCardioPause?.();
      return;
    }

    // Timer mode: first tap starts, second tap stops & completes
    if (showTimer && !timerRunning && timerSeconds === 0) {
      unlockAudio(); // unlock audio context on user gesture so beeps work later
      timerStartRef.current = Date.now();
      setTimerRunning(true);
      return;
    }

    setTimerRunning(false);
    playBeep();
    const weightNum = effectiveWeight ? parseFloat(effectiveWeight) : undefined;
    const repsNum = effectiveReps ? parseInt(effectiveReps) : currentExercise.repMax;
    const duration = showTimer && timerSeconds > 0 ? timerSeconds : undefined;
    onCompleteSet(currentExerciseIndex, currentSetIndex, weightNum, repsNum, duration);
    setTimerSeconds(0);
  };

  // Hold on the swap button → sheet with every slot alternative (parent-owned).
  const swapPress = useLongPress(() => onSwapLongPress?.());

  // --- Log Workout header parity: live duration + working volume ---
  const [elapsedSec, setElapsedSec] = useState(0);
  useEffect(() => {
    if (!startTime) return;
    const tick = () => setElapsedSec(Math.floor((Date.now() - startTime.getTime()) / 1000));
    tick();
    const iv = setInterval(tick, 1000);
    const onV = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onV);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', onV); };
  }, [startTime]);
  const totalVolume = exercises.reduce((sum, _, idx) => {
    const sets = setsDataByExercise.get(idx) || [];
    return sum + sets.reduce((s2, st) => st.completed ? s2 + (st.weight || 0) * (st.reps || 0) : s2, 0);
  }, 0);

  // --- Exercise thumbnails (first video frame) ---
  const exerciseIdsKey = exercises.map(e => e.exerciseId).join(',');
  const [thumbById, setThumbById] = useState<Map<string, string | null>>(new Map());
  useEffect(() => {
    const ids = [...new Set(exercises.map(e => e.exerciseId).filter((id): id is string => !!id))];
    if (!ids.length) return;
    let cancelled = false;
    supabase.from('exercises').select('id, video_path').in('id', ids).then(({ data }) => {
      if (cancelled || !data) return;
      setThumbById(new Map((data as { id: string; video_path: string | null }[]).map(r => [r.id, getVideoThumbUrl(r.video_path)])));
    });
    return () => { cancelled = true; };
  }, [exerciseIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- MINULE: last logged values per exercise (most recent session) ---
  const [lastValues, setLastValues] = useState<Map<string, Map<number, { weight: number | null; reps: number | null }>>>(new Map());
  useEffect(() => {
    const ids = [...new Set(exercises.map(e => e.exerciseId).filter((id): id is string => !!id))];
    if (!ids.length) return;
    let cancelled = false;
    supabase
      .from('workout_session_sets')
      .select('exercise_id, set_number, weight_kg, reps, session_id, created_at')
      .in('exercise_id', ids)
      .order('created_at', { ascending: false })
      .limit(400)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const latestSession = new Map<string, string>();
        const map = new Map<string, Map<number, { weight: number | null; reps: number | null }>>();
        for (const row of data as any[]) {
          const exId = row.exercise_id as string | null;
          if (!exId || !row.session_id) continue;
          if (!latestSession.has(exId)) latestSession.set(exId, row.session_id);
          if (row.session_id !== latestSession.get(exId)) continue;
          if (!map.has(exId)) map.set(exId, new Map());
          const inner = map.get(exId)!;
          if (!inner.has(row.set_number)) inner.set(row.set_number, { weight: row.weight_kg, reps: row.reps });
        }
        setLastValues(map);
      });
    return () => { cancelled = true; };
  }, [exerciseIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const completedTotal = exercises.reduce((sum, _, idx) => {
    const sets = setsDataByExercise.get(idx) || [];
    return sum + sets.filter(s => s.completed).length;
  }, 0);
  const totalSetsAll = exercises.reduce((sum, ex) => sum + ex.sets, 0);

  return (
    <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
      {/* Header — Log Workout look; the workout stays Pumplo-guided */}
      <div className="flex-none safe-top border-b border-border">
        <div className="flex items-center gap-1 px-3 pt-2">
          <button onClick={onClose} className="p-2 -ml-1 rounded-xl hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
          <h1 className="flex-1 min-w-0 text-base font-bold truncate">{t('workout.list_title')}</h1>
          <span className="text-xs text-muted-foreground shrink-0 mr-1">{completedTotal}/{totalSetsAll}</span>
          <button onClick={onSwitchToVideo} className="p-2 rounded-xl bg-muted text-foreground" title={t('workout.switch_to_video')}>
            <Video className="w-5 h-5" />
          </button>
        </div>

        {/* Stats row */}
        <div className="flex items-stretch gap-2 px-3 pb-3 pt-1">
          <div className="flex-1 grid grid-cols-3 gap-2">
            <div>
              <p className="text-[11px] text-muted-foreground">{t('log_workout.duration')}</p>
              <p className="text-lg font-bold tabular-nums text-[#5BC8F5]">{formatTimer(elapsedSec)}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">{t('log_workout.volume')}</p>
              <p className="text-lg font-bold tabular-nums">{Math.round(totalVolume)} <span className="text-xs font-medium text-muted-foreground">kg</span></p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">{t('log_workout.sets')}</p>
              <p className="text-lg font-bold tabular-nums">{completedTotal}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Exercise list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 pb-24">
        <div className="space-y-4">
          {exercises.map((ex, idx) => {
            const sets = setsDataByExercise.get(idx) ||
              Array.from({ length: ex.sets }, () => ({ completed: false }));
            const completedSets = sets.filter(s => s.completed).length;
            const isActive = idx === currentExerciseIndex;
            const isDone = completedSets >= ex.sets;
            const isExCardio = ex.unit_type === 'time_min' || ex.category === 'cardio';
            const exTargetSec = isExCardio ? ex.repMax : 0;
            const fmtExTarget = isExCardio ? formatTimer(exTargetSec) : '';
            const thumb = ex.exerciseId ? thumbById.get(ex.exerciseId) : null;
            const exName = (isEn && ex.exerciseNameEn) ? ex.exerciseNameEn : (ex.exerciseName || TRAINING_ROLE_NAMES[ex.roleId as keyof typeof TRAINING_ROLE_NAMES] || ex.roleId);

            return (
              <div
                key={ex.id}
                ref={isActive ? activeRef : undefined}
                className={cn(
                  'rounded-2xl border bg-card overflow-hidden transition-all',
                  isActive ? 'border-[#5BC8F5] shadow-sm' : 'border-border',
                  isDone && !isActive && 'opacity-60'
                )}
              >
                {/* Exercise header */}
                <div className="flex items-center gap-3 p-3">
                  <button onClick={() => onSelectExercise(idx)} className="w-12 h-12 rounded-xl overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                    {thumb ? (
                      <img src={thumb} alt="" loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <Video className="w-5 h-5 text-muted-foreground" />
                    )}
                  </button>
                  <button onClick={() => onSelectExercise(idx)} className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="font-bold text-[15px] text-[#5BC8F5] truncate">{exName}</p>
                      {ex.slotCategory && slotCategoryLabels[ex.slotCategory] && (
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border shrink-0', slotCategoryLabels[ex.slotCategory].color)}>
                          {slotCategoryLabels[ex.slotCategory].label}
                        </span>
                      )}
                    </div>
                    {ex.machineName && (
                      <p className="text-xs text-muted-foreground truncate">{(isEn && ex.machineNameEn) ? ex.machineNameEn : ex.machineName}</p>
                    )}
                  </button>
                  {onShowInfo && ex.exerciseId && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onShowInfo(ex.exerciseId!); }}
                      className="p-2 rounded-xl text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    >
                      <Info className="w-5 h-5" />
                    </button>
                  )}
                </div>

                {/* Rest between sets (read-only — Pumplo drives the plan) */}
                {restSecondsByIndex?.[idx] != null && (
                  <div className="px-3 pb-2 -mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Timer className="w-3.5 h-3.5" />
                    <span>{t('log_workout.rest')}: {(() => { const sec = restSecondsByIndex[idx]; const m = Math.floor(sec / 60), ss = sec % 60; return m === 0 ? `${ss} s` : ss === 0 ? `${m} min` : `${m} min ${ss} s`; })()}</span>
                  </div>
                )}

                {/* Sets table — visual parity with the custom Log Workout, but
                    the plan stays fixed (no add/remove, only the current set
                    is actionable). */}
                <div className="px-3 pb-3">
                  <div className="grid grid-cols-[2rem_1fr_1fr_1fr_2.25rem] gap-1 items-center text-[11px] font-semibold text-muted-foreground pb-1.5">
                    <div className="text-center">{t('log_workout.col_set')}</div>
                    <div className="text-center">{t('log_workout.col_previous')}</div>
                    <div className="text-center">{isExCardio ? t('log_workout.col_time') : t('log_workout.col_kg')}</div>
                    <div className="text-center">{isExCardio ? '' : t('log_workout.col_reps')}</div>
                    <div className="text-center"><Check className="w-3.5 h-3.5 mx-auto" /></div>
                  </div>

                  {Array.from({ length: ex.sets }, (_, si) => {
                    const s = sets[si];
                    const done = !!s?.completed;
                    const isCurrent = isActive && si === currentSetIndex && !allSetsComplete;
                    const lv = ex.exerciseId ? lastValues.get(ex.exerciseId)?.get(si + 1) : undefined;
                    const prevText = lv && (lv.weight != null || lv.reps != null)
                      ? (isExCardio ? (lv.reps != null ? formatTimer(lv.reps) : '–') : `${lv.weight ?? 0} kg × ${lv.reps ?? 0}`)
                      : '–';
                    const types = setTypesByExercise?.get(idx);
                    const type = types ? getSetType(types, si) : 'normal';
                    return (
                      <div
                        key={si}
                        className={cn(
                          'grid grid-cols-[2rem_1fr_1fr_1fr_2.25rem] gap-1 items-center py-1 rounded-lg mb-1 transition-colors',
                          done ? 'bg-green-500/15' : isCurrent ? 'bg-[#5BC8F5]/10' : ''
                        )}
                      >
                        <button
                          onClick={() => type !== 'normal' && onExplainSetType?.(type)}
                          className="text-center font-bold text-sm"
                        >
                          {renderSetLabel(idx, si)}
                        </button>
                        <div className="text-center text-xs text-muted-foreground truncate">{prevText}</div>
                        {isExCardio ? (
                          <div className={cn('text-center text-sm font-semibold tabular-nums col-span-2', isCurrent && (timerRunning || externalCardioSecondsRemaining !== undefined) && 'text-[#5BC8F5]')}>
                            {done
                              ? (s?.durationSeconds ? formatTimer(s.durationSeconds) : fmtExTarget)
                              : isCurrent
                              ? (externalCardioSecondsRemaining !== undefined
                                  ? formatTimer(externalCardioSecondsRemaining)
                                  : timerRunning ? formatTimer(timerSeconds) : fmtExTarget)
                              : <span className="text-muted-foreground">{fmtExTarget}</span>}
                          </div>
                        ) : done ? (
                          onEditSet ? (
                            // Completed sets stay editable (fix weight/reps after
                            // the fact); committed on blur, no rest is triggered.
                            <>
                              <input
                                key={`w-${idx}-${si}`}
                                type="number" inputMode="decimal"
                                defaultValue={s?.weight ?? ''}
                                onBlur={(e) => {
                                  const v = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                  if (v !== (s?.weight ?? undefined)) onEditSet(idx, si, v, s?.reps);
                                }}
                                className="w-full text-center text-sm font-semibold tabular-nums rounded-lg h-8 border-0 outline-none focus:ring-2 focus:ring-green-500/40 bg-transparent"
                              />
                              <input
                                key={`r-${idx}-${si}`}
                                type="number" inputMode="numeric"
                                defaultValue={s?.reps ?? ''}
                                onBlur={(e) => {
                                  const v = e.target.value === '' ? undefined : parseInt(e.target.value);
                                  if (v !== (s?.reps ?? undefined)) onEditSet(idx, si, s?.weight, v);
                                }}
                                className="w-full text-center text-sm font-semibold tabular-nums rounded-lg h-8 border-0 outline-none focus:ring-2 focus:ring-green-500/40 bg-transparent"
                              />
                            </>
                          ) : (
                            <>
                              <div className="text-center text-sm font-semibold tabular-nums">{s?.weight ?? '–'}</div>
                              <div className="text-center text-sm font-semibold tabular-nums">{s?.reps ?? '–'}</div>
                            </>
                          )
                        ) : isCurrent ? (
                          <>
                            <input
                              type="number" inputMode="decimal"
                              value={effectiveWeight}
                              onChange={(e) => setEffectiveWeight(e.target.value)}
                              className="w-full text-center text-sm font-semibold rounded-lg h-9 border-0 outline-none focus:ring-2 focus:ring-[#5BC8F5]/50 bg-muted"
                            />
                            <input
                              type="number" inputMode="numeric"
                              value={effectiveReps}
                              onChange={(e) => setEffectiveReps(e.target.value)}
                              className="w-full text-center text-sm font-semibold rounded-lg h-9 border-0 outline-none focus:ring-2 focus:ring-[#5BC8F5]/50 bg-muted"
                            />
                          </>
                        ) : (
                          <>
                            <div className="text-center text-sm text-muted-foreground tabular-nums">{ex.weightPerSet?.[si] ?? '–'}</div>
                            <div className="text-center text-sm text-muted-foreground tabular-nums">{ex.repsPerSet?.[si] ?? `${ex.repMin}–${ex.repMax}`}</div>
                          </>
                        )}
                        {done ? (
                          <div className="w-8 h-8 mx-auto rounded-lg bg-green-500 text-white flex items-center justify-center">
                            <Check className="w-4 h-4" />
                          </div>
                        ) : isCurrent ? (
                          <button
                            onClick={handleCompleteCurrentSet}
                            className={cn(
                              'w-8 h-8 mx-auto rounded-lg flex items-center justify-center shadow-sm active:scale-90 transition-transform text-white',
                              externalCardioSecondsRemaining !== undefined
                                ? externalCardioPaused ? 'bg-green-500' : 'bg-amber-500'
                                : timerRunning
                                ? 'bg-red-500'
                                : isExCardio || (showTimer && timerSeconds === 0)
                                ? 'bg-green-500'
                                : 'bg-[#5BC8F5]'
                            )}
                          >
                            {externalCardioSecondsRemaining !== undefined ? (
                              externalCardioPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />
                            ) : (!timerRunning && (isExCardio || (showTimer && timerSeconds === 0))) ? (
                              <Play className="w-4 h-4" />
                            ) : timerRunning ? (
                              <Square className="w-4 h-4" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                          </button>
                        ) : (
                          <div className="w-8 h-8 mx-auto rounded-lg bg-muted" />
                        )}
                      </div>
                    );
                  })}

                  {/* Active exercise controls (Pumplo drives the plan) */}
                  {isActive && !allSetsComplete && (
                    <div className="flex gap-2 mt-2">
                      {onSwapExercise && (
                        <button
                          {...swapPress.handlers}
                          onClick={() => { if (!swapPress.wasLongPress()) onSwapExercise(); }}
                          style={{ touchAction: 'none' }}
                          className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-muted text-muted-foreground text-xs font-medium', isSwapping && 'opacity-50')}
                        >
                          <RefreshCw className={cn('w-3.5 h-3.5', isSwapping && 'animate-spin')} />
                          {t('workout.swap')}
                        </button>
                      )}
                      <button
                        onClick={onSkipExercise}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-muted text-muted-foreground text-xs font-medium"
                      >
                        <SkipForward className="w-3.5 h-3.5" />
                        {t('workout.skip_confirm')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Add exercise mid-workout (Hevy-style) */}
          {onAddExercise && (
            <button
              onClick={onAddExercise}
              className="w-full mt-3 flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-border text-primary font-medium text-sm active:scale-[0.98] transition-transform"
            >
              <Plus className="w-4 h-4" />
              {t('custom_plan.add_exercise')}
            </button>
          )}

          {/* Finish workout button when all sets are done */}
          {onFinishWorkout && completedTotal >= totalSetsAll && totalSetsAll > 0 && (
            <button
              onClick={onFinishWorkout}
              className="w-full mt-4 flex items-center justify-center gap-2 py-4 rounded-2xl bg-primary text-white font-semibold text-base shadow-lg shadow-primary/30 active:scale-[0.98] transition-transform"
            >
              <Trophy className="w-5 h-5" />
              {t('workout.finish')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
