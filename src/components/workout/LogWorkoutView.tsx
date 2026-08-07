/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Info, Plus, AlarmClock, PersonStanding, Video, Volume2, VolumeX, X, Timer, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getVideoThumbUrl } from '@/lib/videoUtils';
import { useLongPress } from '@/lib/useLongPress';
import { cn } from '@/lib/utils';
import { getSetType, setBadgeLabel, setBadgeColor } from '@/lib/setTypes';
import { computeMuscleDistribution, muscleIntensities } from '@/lib/muscleDistribution';
import { MuscleBodySvg } from './MuscleBodySvg';
import { GestureSafeInput } from './GestureSafeInput';
import { CoachTour, useCoachTour, CoachHelpButton } from '@/components/coach/CoachTour';
import { translateMuscle } from '@/lib/muscleTranslation';
import { playBeep, playCountdown3, playCountdown2, playCountdown1, playAlarmFinish, unlockAudio } from '@/lib/workoutAudio';
import { startRestBeeps, stopRestBeeps } from '@/lib/restAudioNative';
import { startRestActivity, updateRestActivity, endRestActivity, showSetActivity, consumePendingEvents, addLockScreenListener, type NextSetPayload } from '@/lib/restLiveActivity';

export interface LogExercise {
  id: string;
  exercise_id: string;
  exercise_name: string;
  exercise_name_en?: string | null;
  sets: number;
  reps: number;
  reps_per_set: number[] | null;
  weight_kg: number | null;
  weight_per_set: number[] | null;
  rest_seconds: number;
  rest_per_set: number[] | null;
  set_types: (string | null)[] | null;
  video_path: string | null;
  unit_type: string;
  category: string;
  primary_muscles: string[];
  secondary_muscles: string[];
  notes?: string | null;
}

interface SetData {
  completed: boolean;
  weight: number | null;
  reps: number | null;
  durationSeconds: number | null;
}

interface LogWorkoutViewProps {
  title: string;
  exercises: LogExercise[];
  completedSetsMap: Map<number, SetData[]>;
  startTime: Date;
  isMuted: boolean;
  onToggleMute: () => void;
  onCompleteSet: (exIdx: number, setIdx: number, weight: number | null, reps: number | null, durationSeconds: number | null) => void;
  onUncompleteSet: (exIdx: number, setIdx: number) => void;
  onRemoveSet: (exIdx: number, setIdx: number) => void;
  onUpdateRest: (exerciseRowId: string, seconds: number) => void;
  onUpdateNote: (exerciseRowId: string, note: string | null) => void;
  onShowInfo: (exerciseId: string) => void;
  onAddExercise: () => void;
  onFinish: () => void;
  onMinimize: () => void;
  onExplainSetType: (type: string) => void;
  // Per-row gym-bound swap (tap = quick, hold = full list). Optional so other
  // callers of LogWorkoutView keep the header without a swap button.
  onSwapQuick?: (exIdx: number) => void;
  onSwapLong?: (exIdx: number) => void;
  swappingIdx?: number | null;
}

// Swap icon with its own long-press (one per exercise row).
const RowSwapButton = ({ idx, onQuick, onLong, swapping, label }: {
  idx: number; onQuick: (i: number) => void; onLong: (i: number) => void; swapping: boolean; label: string;
}) => {
  const press = useLongPress(() => onLong(idx));
  return (
    <button
      {...press.handlers}
      onClick={() => { if (!press.wasLongPress()) onQuick(idx); }}
      data-coach={idx === 0 ? 'log-swap' : undefined}
      className={cn('p-2 rounded-xl text-muted-foreground hover:text-foreground transition-colors', swapping && 'opacity-50')}
      style={{ touchAction: 'none' }}
      title={label}
    >
      <RefreshCw className={cn('w-5 h-5', swapping && 'animate-spin')} />
    </button>
  );
};

const fmt = (sec: number) => {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`;
};

// Static first-frame JPEG thumbnail (<video> thumbnails stall iOS at list scale).
const ExerciseThumb = ({ path, onClick }: { path: string | null; onClick: () => void }) => {
  const [error, setError] = useState(false);
  const url = getVideoThumbUrl(path);
  return (
    <button onClick={onClick} className="w-12 h-12 rounded-xl overflow-hidden bg-muted shrink-0 flex items-center justify-center">
      {url && !error ? (
        <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" onError={() => setError(true)} />
      ) : (
        <Video className="w-5 h-5 text-muted-foreground" />
      )}
    </button>
  );
};

const LogWorkoutView = ({
  title, exercises, completedSetsMap, startTime, isMuted, onToggleMute,
  onCompleteSet, onUncompleteSet, onRemoveSet, onUpdateRest, onUpdateNote, onShowInfo, onAddExercise, onFinish, onMinimize, onExplainSetType,
  onSwapQuick, onSwapLong, swappingIdx,
}: LogWorkoutViewProps) => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';

  const [inputs, setInputs] = useState<Record<string, { w: string; r: string }>>({});
  const [extraSets, setExtraSets] = useState<Record<number, number>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [lastValues, setLastValues] = useState<Map<string, Map<number, { weight: number | null; reps: number | null }>>>(new Map());
  const [restTimerEnabled, setRestTimerEnabled] = useState(true);
  const [alarmOpen, setAlarmOpen] = useState(false);
  const [muscleOpen, setMuscleOpen] = useState(false);
  // Exercise index whose rest timer is being edited (sheet), persists to the plan.
  const [restEditIdx, setRestEditIdx] = useState<number | null>(null);
  const [durationSec, setDurationSec] = useState(0);

  // --- Live duration ---
  useEffect(() => {
    const tick = () => setDurationSec(Math.floor((Date.now() - startTime.getTime()) / 1000));
    tick();
    const iv = setInterval(tick, 1000);
    const onVis = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', onVis); };
  }, [startTime]);

  // --- MINULE: last logged values per exercise (most recent session) ---
  const idsKey = exercises.map(e => e.exercise_id).join(',');
  useEffect(() => {
    const ids = [...new Set(exercises.map(e => e.exercise_id).filter(Boolean))];
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
  }, [idsKey]);

  const rowCount = (idx: number) => (exercises[idx]?.sets || 0) + (extraSets[idx] || 0);

  // --- Prefill inputs (fills missing cells only, never overwrites user edits) ---
  useEffect(() => {
    setInputs(prev => {
      const next = { ...prev };
      exercises.forEach((ex, idx) => {
        for (let si = 0; si < rowCount(idx); si++) {
          const key = `${idx}-${si}`;
          if (next[key]) continue;
          const done = completedSetsMap.get(idx)?.[si];
          const lv = lastValues.get(ex.exercise_id)?.get(si + 1);
          const w = done?.completed && done.weight != null ? String(done.weight)
            : ex.weight_per_set?.[si] != null ? String(ex.weight_per_set[si])
            : ex.weight_kg != null ? String(ex.weight_kg)
            : lv?.weight != null ? String(lv.weight) : '';
          const r = done?.completed && done.reps != null ? String(done.reps)
            : ex.reps_per_set?.[si] != null ? String(ex.reps_per_set[si])
            : ex.reps ? String(ex.reps)
            : lv?.reps != null ? String(lv.reps) : '';
          next[key] = { w, r };
        }
      });
      return next;
    });
  }, [exercises, lastValues, extraSets, completedSetsMap]);

  // --- Prefill notes from plan (ephemeral local edits only) ---
  useEffect(() => {
    setNotes(prev => {
      const next = { ...prev };
      exercises.forEach((ex, idx) => {
        if (next[idx] === undefined && ex.notes) next[idx] = ex.notes;
      });
      return next;
    });
  }, [exercises]);

  // --- Sticky countdown bar: rest between sets OR a timed (cardio) set ---
  const [rest, setRest] = useState<{ total: number; remaining: number; mode: 'rest' | 'work'; run: number } | null>(null);
  const restEndRef = useRef(0);
  const restBeeps = useRef({ b3: false, b2: false, b1: false, done: false });
  const restNativeRef = useRef(false);
  // Context of the running timed set, so the tick can complete it when time is up.
  const workCtxRef = useRef<{ ex: LogExercise; idx: number; si: number } | null>(null);
  // run = countdown instance id (the effect re-arms beeps per run).
  const runIdRef = useRef(0);
  const resting = rest !== null;

  // Last rest context, so the activity can be re-asserted after unlock (iOS
  // may drop/stale it while the phone is locked; update() can't resurrect it).
  const lastRestCtxRef = useRef<{ exerciseName: string; nextText: string; nextSet?: NextSetPayload | null } | null>(null);

  const startRest = (seconds: number, ctx?: { exerciseName: string; nextText: string; nextSet?: NextSetPayload | null }) => {
    if (seconds <= 0) return;
    workCtxRef.current = null;
    lastRestCtxRef.current = ctx ?? null;
    restEndRef.current = Date.now() + seconds * 1000;
    restBeeps.current = { b3: false, b2: false, b1: false, done: false };
    setRest({ total: seconds, remaining: seconds, mode: 'rest', run: ++runIdRef.current });
    startRestActivity({
      exerciseName: ctx?.exerciseName ?? '',
      nextSetText: ctx?.nextText ?? '',
      endsAt: restEndRef.current,
      totalSeconds: seconds,
      thumbUrl: ctx?.nextSet?.thumbUrl ?? null,
      nextSet: ctx?.nextSet ?? null,
    });
  };

  // Timed (cardio) set: run a visible countdown of the set duration with the
  // same 3-2-1 + finish sounds as rest; completing happens when time is up.
  const startWork = (ex: LogExercise, idx: number, si: number, seconds: number) => {
    workCtxRef.current = { ex, idx, si };
    restEndRef.current = Date.now() + seconds * 1000;
    restBeeps.current = { b3: false, b2: false, b1: false, done: false };
    setRest({ total: seconds, remaining: seconds, mode: 'work', run: ++runIdRef.current });
    startRestActivity({
      exerciseName: exName(ex),
      nextSetText: t('log_workout.work_running', { num: si + 1, total: rowCount(idx) }),
      endsAt: restEndRef.current,
      totalSeconds: seconds,
    });
  };

  // Mark the running timed set as done (time elapsed or user hit "Hotovo"),
  // then chain straight into the configured rest.
  const completeWork = () => {
    const ctx = workCtxRef.current;
    if (!ctx) return;
    workCtxRef.current = null;
    const dur = ctx.ex.reps || 0;
    onCompleteSet(ctx.idx, ctx.si, null, dur, dur);
    if (restTimerEnabled) {
      const restSec = ctx.ex.rest_per_set?.[ctx.si] ?? ctx.ex.rest_seconds ?? 120;
      if (restSec > 0) {
        const f = followingSet(ctx.idx, ctx.si);
        startRest(restSec, { exerciseName: exName(ctx.ex), nextText: nextSetText(ctx.idx, ctx.si), nextSet: f ? setPayload(f) : null });
        return;
      }
    }
    setRest(null); // idle sync takes the banner over
  };

  // Cancel a running timed set without completing it (tap ✓ again).
  const cancelWork = () => {
    workCtxRef.current = null;
    stopRestBeeps();
    restNativeRef.current = false;
    setRest(null); // idle sync takes the banner over
  };
  const adjustRest = (delta: number) => {
    if (!rest) return;
    restEndRef.current = Math.max(Date.now(), restEndRef.current + delta * 1000);
    const remaining = Math.max(0, Math.ceil((restEndRef.current - Date.now()) / 1000));
    restBeeps.current = { b3: remaining < 3, b2: remaining < 2, b1: remaining < 1, done: false };
    stopRestBeeps();
    startRestBeeps(remaining).then(h => { restNativeRef.current = h; });
    setRest(r => (r ? { ...r, total: Math.max(r.total, remaining), remaining } : null));
    updateRestActivity({ endsAt: restEndRef.current, totalSeconds: rest.total });
  };
  const skipRest = () => { stopRestBeeps(); restNativeRef.current = false; setRest(null); };

  useEffect(() => {
    if (!rest) return;
    let cancelled = false;
    const remainingAtStart = Math.max(0, Math.ceil((restEndRef.current - Date.now()) / 1000));
    startRestBeeps(remainingAtStart).then(h => { if (!cancelled) restNativeRef.current = h; });
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((restEndRef.current - Date.now()) / 1000));
      setRest(r => (r ? { ...r, remaining } : null));
      const b = restBeeps.current;
      if (!restNativeRef.current) {
        if (remaining === 3 && !b.b3) { b.b3 = true; playCountdown3(); }
        if (remaining === 2 && !b.b2) { b.b2 = true; playCountdown2(); }
        if (remaining === 1 && !b.b1) { b.b1 = true; playCountdown1(); }
      }
      if (remaining <= 0 && !b.done) {
        b.done = true;
        if (!restNativeRef.current) playAlarmFinish();
        stopRestBeeps();
        if (workCtxRef.current) {
          completeWork(); // timed set finished → log it (+ chains into rest)
        } else {
          setRest(null); // idle sync takes the banner over
        }
      }
    };
    tick();
    const iv = setInterval(tick, 250);
    const onVis = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { cancelled = true; clearInterval(iv); document.removeEventListener('visibilitychange', onVis); };
  }, [rest?.run]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Working stats (warm-up sets excluded) ---
  const stats = useMemo(() => {
    let sets = 0, volume = 0;
    completedSetsMap.forEach((arr, idx) => {
      arr.forEach((s, si) => {
        if (!s.completed) return;
        if (getSetType(exercises[idx]?.set_types, si) === 'W') return;
        sets++;
        volume += (s.weight || 0) * (s.reps || 0);
      });
    });
    return { sets, volume };
  }, [completedSetsMap, exercises]);

  // --- Muscle distribution (primary=1, secondary=0.5 per completed set) ---
  const muscleDistEntries = useMemo(() => computeMuscleDistribution(exercises.map((ex, idx) => ({
    primaryMuscles: ex.primary_muscles,
    secondaryMuscles: ex.secondary_muscles,
    completedSets: (completedSetsMap.get(idx) || []).filter(s => s.completed).length,
  }))), [exercises, completedSetsMap]);
  const muscleDist = useMemo(() => muscleDistEntries.map(d => ({
    label: d.key ? t(`custom_plan.muscle_${d.key}`) : translateMuscle(d.raw, isEn),
    value: d.value,
  })), [muscleDistEntries, isEn, t]);
  const muscleIntens = useMemo(() => muscleIntensities(muscleDistEntries), [muscleDistEntries]);
  const muscleMax = muscleDist[0]?.value || 1;

  const isDone = (idx: number, si: number) => !!completedSetsMap.get(idx)?.[si]?.completed;

  const setInput = (key: string, field: 'w' | 'r', val: string) =>
    setInputs(prev => ({ ...prev, [key]: { w: prev[key]?.w ?? '', r: prev[key]?.r ?? '', [field]: val } }));

  // Text for the lock-screen widget: what comes after the rest ends.
  const nextSetText = (idx: number, si: number): string => {
    const total = rowCount(idx);
    if (si + 1 < total) {
      const inp = inputs[`${idx}-${si + 1}`];
      const detail = inp?.w && inp?.r ? ` (${inp.w} kg × ${inp.r})` : '';
      return t('log_workout.next_set', { num: si + 2, total }) + detail;
    }
    const nextEx = exercises[idx + 1];
    if (nextEx) return t('log_workout.next_exercise', { name: exName(nextEx) });
    return t('log_workout.workout_done_next');
  };

  // Card payload for a given set (used for the lock-screen upcoming-set card).
  const setPayload = (p: { ex: LogExercise; idx: number; si: number }): NextSetPayload => {
    const isCardio = p.ex.unit_type === 'time_min' || p.ex.category === 'cardio';
    const inp = inputs[`${p.idx}-${p.si}`];
    return {
      exerciseName: exName(p.ex),
      setText: t('log_workout.set_of', { num: p.si + 1, total: rowCount(p.idx) }),
      detailText: isCardio ? fmt(p.ex.reps || 0) : `${inp?.w || '–'} kg × ${inp?.r || '–'}`,
      restSeconds: restTimerEnabled ? (p.ex.rest_per_set?.[p.si] ?? p.ex.rest_seconds ?? 120) : 0,
      thumbUrl: getVideoThumbUrl(p.ex.video_path),
    };
  };

  // The set that comes after completing (idx, si) — feeds the Skip intent.
  const followingSet = (idx: number, si: number): { ex: LogExercise; idx: number; si: number } | null => {
    if (si + 1 < rowCount(idx)) return { ex: exercises[idx], idx, si: si + 1 };
    for (let j = idx + 1; j < exercises.length; j++) {
      for (let k = 0; k < rowCount(j); k++) {
        if (!isDone(j, k)) return { ex: exercises[j], idx: j, si: k };
      }
    }
    return null;
  };

  const toggleSet = (ex: LogExercise, idx: number, si: number) => {
    unlockAudio();
    if (isDone(idx, si)) { onUncompleteSet(idx, si); return; }
    const key = `${idx}-${si}`;
    const isCardio = ex.unit_type === 'time_min' || ex.category === 'cardio';
    if (isCardio) {
      const dur = ex.reps || 0;
      // Second tap on the running row cancels the timed set.
      if (rest?.mode === 'work' && workCtxRef.current?.idx === idx && workCtxRef.current?.si === si) {
        cancelWork();
        return;
      }
      if (dur > 0) {
        playBeep();
        startWork(ex, idx, si, dur); // completes itself (and chains rest) when time is up
        return;
      }
      onCompleteSet(idx, si, null, dur, dur);
    } else {
      const inp = inputs[key];
      const wNum = inp?.w ? parseFloat(inp.w) : NaN;
      const rNum = inp?.r ? parseInt(inp.r) : NaN;
      onCompleteSet(idx, si, isNaN(wNum) ? null : wNum, isNaN(rNum) ? (ex.reps || null) : rNum, null);
    }
    playBeep();
    if (restTimerEnabled) {
      const restSec = ex.rest_per_set?.[si] ?? ex.rest_seconds ?? 120;
      const f = followingSet(idx, si);
      startRest(restSec, { exerciseName: exName(ex), nextText: nextSetText(idx, si), nextSet: f ? setPayload(f) : null });
    }
  };

  // --- Lock-screen banner: upcoming set (idle) + ✓-from-lock-screen handling ---
  // The next pending set = first uncompleted row in exercise order.
  const nextPending = (): { ex: LogExercise; idx: number; si: number } | null => {
    for (let idx = 0; idx < exercises.length; idx++) {
      const total = rowCount(idx);
      for (let si = 0; si < total; si++) {
        if (!isDone(idx, si)) return { ex: exercises[idx], idx, si };
      }
    }
    return null;
  };

  // Complete the pending set as if ✓ was tapped in the app (used by the
  // lock-screen intent). Kept in a ref so the one-time listener sees fresh state.
  const completeFromLockRef = useRef<() => void>(() => {});
  completeFromLockRef.current = () => {
    const p = nextPending();
    if (!p) return;
    const { ex, idx, si } = p;
    const isCardio = ex.unit_type === 'time_min' || ex.category === 'cardio';
    if (isCardio) {
      const dur = ex.reps || 0;
      onCompleteSet(idx, si, null, dur, dur);
    } else {
      const inp = inputs[`${idx}-${si}`];
      const wNum = inp?.w ? parseFloat(inp.w) : NaN;
      const rNum = inp?.r ? parseInt(inp.r) : NaN;
      onCompleteSet(idx, si, isNaN(wNum) ? null : wNum, isNaN(rNum) ? (ex.reps || null) : rNum, null);
    }
    if (restTimerEnabled) {
      const restSec = ex.rest_per_set?.[si] ?? ex.rest_seconds ?? 120;
      const f = followingSet(idx, si);
      startRest(restSec, { exerciseName: exName(ex), nextText: nextSetText(idx, si), nextSet: f ? setPayload(f) : null });
    }
  };

  // Skip rest triggered from the lock screen (kept fresh via ref).
  const skipFromLockRef = useRef<() => void>(() => {});
  skipFromLockRef.current = () => { if (rest?.mode === 'rest') skipRest(); };

  const lockProcessingRef = useRef(false);
  useEffect(() => {
    const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
    const process = async () => {
      if (lockProcessingRef.current) return;
      lockProcessingRef.current = true;
      try {
        // Replay the lock-screen taps in the order they happened, spaced so
        // state settles between writes (the refs re-read fresh state).
        let events = await consumePendingEvents();
        while (events.length > 0) {
          for (const ev of events) {
            if (ev === 'skip') skipFromLockRef.current();
            else completeFromLockRef.current();
            await wait(350);
          }
          events = await consumePendingEvents(); // taps queued while replaying
        }
      } finally { lockProcessingRef.current = false; }
    };
    process();
    const removeCompleted = addLockScreenListener('setCompleted', () => process());
    const removeSkipped = addLockScreenListener('restSkipped', () => process());
    const onVis = () => { if (document.visibilityState === 'visible') process(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { removeCompleted(); removeSkipped(); document.removeEventListener('visibilitychange', onVis); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-assert the lock-screen card on every return to the foreground — if iOS
  // dropped or staled the Live Activity while locked, this repaints it.
  // First-workout tour for the custom workout log.
  const logTour = useCoachTour('log', 1, true);
  const logTourSteps = [
    { target: '[data-coach="log-row"]', title: t('tour.log.row_title'), body: t('tour.log.row_body') },
    { target: '[data-coach="log-row"]', title: t('tour.log.swipe_title'), body: t('tour.log.swipe_body') },
    { target: '[data-coach="log-swap"]', title: t('tour.log.swap_title'), body: t('tour.log.swap_body') },
    { target: '[data-coach="help-btn"]', title: t('tour.common.help_title'), body: t('tour.common.help_body') },
  ];

  const [resumeTick, setResumeTick] = useState(0);
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') setResumeTick(n => n + 1); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  // Mid-rest unlock: repaint the countdown (start re-creates a dead activity).
  useEffect(() => {
    if (!resumeTick || !rest || rest.mode !== 'rest' || restEndRef.current <= Date.now()) return;
    const ctx = lastRestCtxRef.current;
    startRestActivity({
      exerciseName: ctx?.exerciseName ?? '',
      nextSetText: ctx?.nextText ?? '',
      endsAt: restEndRef.current,
      totalSeconds: rest.total,
      thumbUrl: ctx?.nextSet?.thumbUrl ?? null,
      nextSet: ctx?.nextSet ?? null,
    });
  }, [resumeTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // While no countdown runs, the banner shows the upcoming set with the ✓.
  // Debounced: inputs are in the deps (fresh kg × reps on the lock screen)
  // without a native round-trip per keystroke.
  useEffect(() => {
    if (resting) return;
    const timer = setTimeout(() => {
      const p = nextPending();
      if (!p) { endRestActivity(); return; }
      showSetActivity({
        ...setPayload(p),
        restOverTitle: t('workout.rest_over_title'),
        restOverBody: t('workout.rest_over_body'),
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [resting, completedSetsMap, exercises, extraSets, inputs, resumeTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Leaving the workout view (minimize / finish) removes the banner.
  useEffect(() => () => { endRestActivity(); }, []);

  // Remove a set row: shift all per-row data above it down by one, then let the
  // parent shift its completion map the same way. rowCount shrinks via a
  // negative extraSets delta (works below the planned count too, min 1 row).
  const removeSet = (idx: number, si: number) => {
    if (rowCount(idx) <= 1) return;
    if (rest?.mode === 'work' && workCtxRef.current?.idx === idx && workCtxRef.current?.si === si) cancelWork();
    setInputs(prev => {
      const next = { ...prev };
      const total = rowCount(idx);
      for (let j = si; j < total - 1; j++) next[`${idx}-${j}`] = next[`${idx}-${j + 1}`] ?? { w: '', r: '' };
      delete next[`${idx}-${total - 1}`];
      return next;
    });
    setExtraSets(p => ({ ...p, [idx]: (p[idx] || 0) - 1 }));
    onRemoveSet(idx, si);
  };

  const restRowLabel = (sec: number) => {
    if (!sec || sec <= 0) return t('log_workout.rest_off');
    const m = Math.floor(sec / 60), s = sec % 60;
    if (m === 0) return `${s} s`;
    return s === 0 ? `${m} min` : `${m} min ${s} s`;
  };

  const exName = (ex: LogExercise) => (isEn && ex.exercise_name_en) ? ex.exercise_name_en : ex.exercise_name;

  return (
    <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-none safe-top border-b border-border">
        <div className="flex items-center gap-2 px-3 pt-3 pb-2">
          <button onClick={onMinimize} className="p-2 -ml-1 rounded-xl hover:bg-muted transition-colors" aria-label={t('log_workout.minimize')}>
            <ChevronDown className="w-5 h-5" />
          </button>
          <h1 className="flex-1 min-w-0 text-base font-bold truncate">{title}</h1>
          <CoachHelpButton onClick={logTour.openTour} />
          <button onClick={onToggleMute} className="p-2 rounded-xl text-muted-foreground hover:bg-muted transition-colors">
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
          <button onClick={() => setAlarmOpen(true)} className={cn('p-2 rounded-xl hover:bg-muted transition-colors', restTimerEnabled ? 'text-[#5BC8F5]' : 'text-muted-foreground')}>
            <AlarmClock className="w-5 h-5" />
          </button>
          <button onClick={onFinish} className="px-3.5 py-2 rounded-xl bg-[#5BC8F5] text-white text-sm font-bold active:scale-95 transition-transform">
            {t('log_workout.finish')}
          </button>
        </div>

        {/* Stats row */}
        <div className="flex items-stretch gap-2 px-3 pb-3">
          <div className="flex-1 grid grid-cols-3 gap-2">
            <div>
              <p className="text-[11px] text-muted-foreground">{t('log_workout.duration')}</p>
              <p className="text-lg font-bold tabular-nums text-[#5BC8F5]">{fmt(durationSec)}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">{t('log_workout.volume')}</p>
              <p className="text-lg font-bold tabular-nums">{Math.round(stats.volume)} <span className="text-xs font-medium text-muted-foreground">kg</span></p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">{t('log_workout.sets')}</p>
              <p className="text-lg font-bold tabular-nums">{stats.sets}</p>
            </div>
          </div>
          <button onClick={() => setMuscleOpen(true)} className="w-12 rounded-xl bg-muted flex items-center justify-center text-[#5BC8F5] active:scale-95 transition-transform" aria-label={t('stats.muscle_distribution')}>
            <PersonStanding className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Exercise list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 pb-40">
        <div className="space-y-4">
          {exercises.map((ex, idx) => {
            const isCardio = ex.unit_type === 'time_min' || ex.category === 'cardio';
            return (
              <div key={ex.id} className="rounded-2xl border border-border bg-card overflow-hidden">
                {/* Exercise header */}
                <div className="flex items-center gap-3 p-3">
                  <ExerciseThumb path={ex.video_path} onClick={() => onShowInfo(ex.exercise_id)} />
                  <button onClick={() => onShowInfo(ex.exercise_id)} className="flex-1 min-w-0 text-left">
                    <p className="font-bold text-[15px] text-[#5BC8F5] truncate">{exName(ex)}</p>
                  </button>
                  {onSwapQuick && onSwapLong && (
                    <RowSwapButton idx={idx} onQuick={onSwapQuick} onLong={onSwapLong} swapping={swappingIdx === idx} label={t('workout.swap')} />
                  )}
                  <button onClick={() => onShowInfo(ex.exercise_id)} className="p-2 rounded-xl text-muted-foreground hover:text-foreground transition-colors">
                    <Info className="w-5 h-5" />
                  </button>
                </div>

                {/* Note — saves to the routine on blur */}
                <div className="px-3 pb-2">
                  <input
                    value={notes[idx] ?? ''}
                    onChange={(e) => setNotes(p => ({ ...p, [idx]: e.target.value }))}
                    onBlur={() => { const v = (notes[idx] ?? '').trim() || null; if (v !== (ex.notes ?? null)) onUpdateNote(ex.id, v); }}
                    placeholder={t('log_workout.note_placeholder')}
                    className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none py-1"
                  />
                </div>

                {/* Rest timer row — tap to edit, persists to the routine */}
                <button
                  onClick={() => setRestEditIdx(idx)}
                  className="px-3 pb-2 flex items-center gap-1.5 text-xs text-[#5BC8F5] font-medium"
                >
                  <Timer className="w-3.5 h-3.5" />
                  <span>{t('log_workout.rest')}: {restRowLabel(ex.rest_seconds)}</span>
                  <ChevronDown className="w-3 h-3 -rotate-90" />
                </button>

                {/* Sets table */}
                <div className="px-3 pb-3">
                  <div className="grid grid-cols-[2rem_1fr_1fr_1fr_2.25rem] gap-1 items-center text-[11px] font-semibold text-muted-foreground pb-1.5">
                    <div className="text-center">{t('log_workout.col_set')}</div>
                    <div className="text-center">{t('log_workout.col_previous')}</div>
                    <div className="text-center">{isCardio ? t('log_workout.col_time') : t('log_workout.col_kg')}</div>
                    <div className="text-center">{isCardio ? '' : t('log_workout.col_reps')}</div>
                    <div className="text-center"><Check className="w-3.5 h-3.5 mx-auto" /></div>
                  </div>

                  {Array.from({ length: rowCount(idx) }, (_, si) => {
                    const key = `${idx}-${si}`;
                    const done = isDone(idx, si);
                    const lv = lastValues.get(ex.exercise_id)?.get(si + 1);
                    const prevText = lv && (lv.weight != null || lv.reps != null)
                      ? (isCardio ? (lv.reps != null ? fmt(lv.reps) : '–') : `${lv.weight ?? 0} kg × ${lv.reps ?? 0}`)
                      : '–';
                    const badge = setBadgeLabel(ex.set_types, si);
                    const badgeColor = setBadgeColor(ex.set_types, si);
                    const type = getSetType(ex.set_types, si);
                    const isRunning = rest?.mode === 'work' && workCtxRef.current?.idx === idx && workCtxRef.current?.si === si;
                    return (
                      <motion.div
                        key={key}
                        data-coach={idx === 0 && si === 0 ? 'log-row' : undefined}
                        drag="x"
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={{ left: 0.5, right: 0 }}
                        style={{ touchAction: 'pan-y' }}
                        onDragEnd={(_, info) => { if (info.offset.x < -60 || info.velocity.x < -400) removeSet(idx, si); }}
                        className={cn(
                          'grid grid-cols-[2rem_1fr_1fr_1fr_2.25rem] gap-1 items-center py-1 rounded-lg mb-1 transition-colors',
                          done ? 'bg-green-500/15' : isRunning ? 'bg-[#5BC8F5]/15' : ''
                        )}
                      >
                        <button
                          onClick={() => type !== 'normal' && onExplainSetType(type)}
                          className={cn('text-center font-bold text-sm', badgeColor)}
                        >
                          {badge}
                        </button>
                        <div className="text-center text-xs text-muted-foreground truncate">{prevText}</div>
                        {isCardio ? (
                          <>
                            <div className={cn('text-center text-sm font-semibold tabular-nums col-span-2', isRunning && 'text-[#5BC8F5]')}>
                              {isRunning ? fmt(rest?.remaining ?? 0) : fmt(ex.reps || 0)}
                            </div>
                          </>
                        ) : (
                          <>
                            <GestureSafeInput
                              type="number" inputMode="decimal"
                              value={inputs[key]?.w ?? ''}
                              onChange={(e) => setInput(key, 'w', e.target.value)}
                              className={cn('w-full text-center text-sm font-semibold rounded-lg h-9 border-0 outline-none focus:ring-2 focus:ring-[#5BC8F5]/50', done ? 'bg-transparent' : 'bg-muted')}
                            />
                            <GestureSafeInput
                              type="number" inputMode="numeric"
                              value={inputs[key]?.r ?? ''}
                              onChange={(e) => setInput(key, 'r', e.target.value)}
                              className={cn('w-full text-center text-sm font-semibold rounded-lg h-9 border-0 outline-none focus:ring-2 focus:ring-[#5BC8F5]/50', done ? 'bg-transparent' : 'bg-muted')}
                            />
                          </>
                        )}
                        <button
                          onClick={() => toggleSet(ex, idx, si)}
                          className={cn(
                            'w-8 h-8 mx-auto rounded-lg flex items-center justify-center transition-colors active:scale-90',
                            done ? 'bg-green-500 text-white' : isRunning ? 'bg-[#5BC8F5] text-white' : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {isRunning ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                        </button>
                      </motion.div>
                    );
                  })}

                  <button
                    onClick={() => setExtraSets(p => ({ ...p, [idx]: (p[idx] || 0) + 1 }))}
                    className="w-full mt-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-muted/60 text-sm font-medium text-foreground active:scale-[0.98] transition-transform"
                  >
                    <Plus className="w-4 h-4" />
                    {t('log_workout.add_set')}
                  </button>
                </div>
              </div>
            );
          })}

          {/* Add exercise */}
          <button
            onClick={onAddExercise}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-border text-[#5BC8F5] font-semibold text-sm active:scale-[0.98] transition-transform"
          >
            <Plus className="w-4 h-4" />
            {t('custom_plan.add_exercise')}
          </button>
        </div>
      </div>

      {/* Sticky rest bar */}
      <AnimatePresence>
        {rest && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed left-0 right-0 z-40 px-3"
            style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
          >
            <div className={cn('mx-auto max-w-md text-white rounded-2xl shadow-xl px-3 py-2.5', rest.mode === 'work' ? 'bg-[#0E3A52]' : 'bg-action')}>
              {rest.mode === 'work' && workCtxRef.current && (
                <p className="text-[11px] font-semibold text-[#5BC8F5] text-center mb-0.5 truncate">
                  {exName(workCtxRef.current.ex)}
                </p>
              )}
              <div className="flex items-center gap-2">
                <button onClick={() => adjustRest(-15)} className="px-2.5 py-1.5 rounded-lg bg-white/10 text-xs font-semibold active:scale-95 transition-transform">-15 s</button>
                <div className="flex-1 text-center">
                  <span className={cn('text-2xl font-black tabular-nums', rest.remaining <= 3 ? 'text-red-400' : 'text-white')}>{fmt(rest.remaining)}</span>
                  <div className="h-1 mt-1 bg-white/15 rounded-full overflow-hidden">
                    <div className="h-full bg-[#5BC8F5] rounded-full" style={{ width: `${(rest.remaining / rest.total) * 100}%` }} />
                  </div>
                </div>
                <button onClick={() => adjustRest(15)} className="px-2.5 py-1.5 rounded-lg bg-white/10 text-xs font-semibold active:scale-95 transition-transform">+15 s</button>
                {rest.mode === 'work' ? (
                  <button onClick={() => { stopRestBeeps(); restNativeRef.current = false; restBeeps.current.done = true; completeWork(); }} className="px-3 py-1.5 rounded-lg bg-green-500 text-xs font-bold active:scale-95 transition-transform">{t('log_workout.work_done')}</button>
                ) : (
                  <button onClick={skipRest} className="px-3 py-1.5 rounded-lg bg-[#5BC8F5] text-xs font-bold active:scale-95 transition-transform">{t('log_workout.rest_skip')}</button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rest-timer settings sheet */}
      <AnimatePresence>
        {alarmOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end bg-black/50 backdrop-blur-sm"
            onClick={() => setAlarmOpen(false)}
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="w-full bg-card rounded-t-3xl p-5 pb-8 safe-bottom"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">{t('log_workout.rest_settings')}</h2>
                <button onClick={() => setAlarmOpen(false)} className="p-1.5 rounded-lg text-muted-foreground"><X className="w-5 h-5" /></button>
              </div>
              <button
                onClick={() => setRestTimerEnabled(v => !v)}
                className="w-full flex items-center justify-between py-3 border-b border-border"
              >
                <span className="text-sm font-medium">{t('log_workout.rest_timer')}</span>
                <span className={cn('w-11 h-6 rounded-full flex items-center px-0.5 transition-colors', restTimerEnabled ? 'bg-[#5BC8F5] justify-end' : 'bg-muted justify-start')}>
                  <span className="w-5 h-5 rounded-full bg-white shadow" />
                </span>
              </button>
              <button
                onClick={onToggleMute}
                className="w-full flex items-center justify-between py-3"
              >
                <span className="text-sm font-medium">{t('log_workout.sound')}</span>
                <span className={cn('w-11 h-6 rounded-full flex items-center px-0.5 transition-colors', !isMuted ? 'bg-[#5BC8F5] justify-end' : 'bg-muted justify-start')}>
                  <span className="w-5 h-5 rounded-full bg-white shadow" />
                </span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rest-timer edit sheet (persists to the routine) */}
      <AnimatePresence>
        {restEditIdx !== null && exercises[restEditIdx] && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end bg-black/50 backdrop-blur-sm"
            onClick={() => setRestEditIdx(null)}
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="w-full max-h-[65vh] bg-card rounded-t-3xl flex flex-col safe-bottom"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 pb-3 shrink-0">
                <h2 className="text-lg font-bold">{t('log_workout.rest_timer')}</h2>
                <button onClick={() => setRestEditIdx(null)} className="p-1.5 rounded-lg text-muted-foreground"><X className="w-5 h-5" /></button>
              </div>
              <div className="overflow-y-auto pb-8">
                {[0, ...Array.from({ length: 60 }, (_, i) => (i + 1) * 5)].map(sec => (
                  <button
                    key={sec}
                    onClick={() => { onUpdateRest(exercises[restEditIdx].id, sec); setRestEditIdx(null); }}
                    className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-muted transition-colors"
                  >
                    <span className={cn('text-sm', (exercises[restEditIdx].rest_seconds ?? 0) === sec ? 'font-semibold text-[#5BC8F5]' : 'text-foreground')}>{restRowLabel(sec)}</span>
                    {(exercises[restEditIdx].rest_seconds ?? 0) === sec && <Check className="w-4 h-4 text-[#5BC8F5]" />}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Muscle distribution sheet */}
      <AnimatePresence>
        {muscleOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end bg-black/50 backdrop-blur-sm"
            onClick={() => setMuscleOpen(false)}
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="w-full max-h-[75vh] overflow-y-auto bg-card rounded-t-3xl p-5 pb-8 safe-bottom"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">{t('stats.muscle_distribution')}</h2>
                <button onClick={() => setMuscleOpen(false)} className="p-1.5 rounded-lg text-muted-foreground"><X className="w-5 h-5" /></button>
              </div>
              {muscleDist.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">{t('log_workout.muscle_empty')}</p>
              ) : (
                <>
                  <div className="flex justify-center gap-8 mb-5">
                    <MuscleBodySvg intensities={muscleIntens} side="front" width={96} />
                    <MuscleBodySvg intensities={muscleIntens} side="back" width={96} />
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground mb-2">
                    <span>{t('stats.muscle')}</span>
                    <span>{t('log_workout.muscle_sets')}</span>
                  </div>
                  <div className="space-y-2.5">
                    {muscleDist.map((m) => (
                      <div key={m.label} className="flex items-center gap-3">
                        <span className="w-24 shrink-0 text-sm font-medium truncate">{m.label}</span>
                        <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-[#5BC8F5] rounded-full" style={{ width: `${(m.value / muscleMax) * 100}%` }} />
                        </div>
                        <span className="w-8 text-right text-sm font-semibold tabular-nums">{m.value % 1 === 0 ? m.value : m.value.toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <CoachTour screenId="log" steps={logTourSteps} open={logTour.open} onClose={logTour.closeTour} />
    </div>
  );
};

export default LogWorkoutView;
