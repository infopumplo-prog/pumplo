/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, Trash2, Search, X, Info, GripVertical, Play, SlidersHorizontal, Check, Copy, ChevronDown, ChevronRight, Share2, Link, AlertTriangle, ArrowRightLeft, Dumbbell, MoreVertical, Clock, HelpCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useCustomPlanDetail, CustomPlanExercise } from '@/hooks/useCustomPlans';
import { usePausedCustomWorkout } from '@/hooks/usePausedCustomWorkout';
import { useUserProfile } from '@/hooks/useUserProfile';
import { supabase } from '@/integrations/supabase/client';
import { getSignedVideoUrl, getVideoThumbUrl } from '@/lib/videoUtils';
import { GestureSafeInput } from '@/components/workout/GestureSafeInput';
import { GymLocationGate } from '@/components/workout/GymLocationGate';
import { GymSelector } from '@/components/workout/GymSelector';
import { checkCustomPlanEquipment, IncompatibleExercise, AlternativeExercise } from '@/lib/gymEquipmentCheck';
import { fetchCatalogAlternatives, type SwapCandidate } from '@/lib/exerciseSwap';
import { ExerciseSwapSheet } from '@/components/workout/ExerciseSwapSheet';
import { ExerciseInfoSheet } from '@/components/workout/ExerciseInfoSheet';
import { useLongPress } from '@/lib/useLongPress';
import { useToast } from '@/hooks/use-toast';
import PageTransition from '@/components/PageTransition';
import { CoachTour, useCoachTour, CoachHelpButton } from '@/components/coach/CoachTour';
import { cn } from '@/lib/utils';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { TRAINING_ROLE_NAMES } from '@/lib/trainingRoles';
import { translateMuscle } from '@/lib/muscleTranslation';
import { ExerciseInfoContent } from '@/components/workout/ExerciseInfoContent';
import ExercisePicker, { PickerExercise } from '@/components/workout/ExercisePicker';
import { SET_TYPE_META, SELECTABLE_SET_TYPES, SetType, setBadgeLabel, setBadgeColor, getSetType } from '@/lib/setTypes';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ExerciseSearchResult {
  id: string;
  name: string;
  name_en?: string | null;
  description?: string | null;
  description_en?: string | null;
  setup_instructions?: string | null;
  setup_instructions_en?: string | null;
  common_mistakes?: string | null;
  common_mistakes_en?: string | null;
  tips?: string | null;
  tips_en?: string | null;
  category: string;
  primary_muscles: string[];
  secondary_muscles: string[];
  primary_muscles_en?: string[] | null;
  secondary_muscles_en?: string[] | null;
  equipment_type: string | null;
  video_path: string | null;
  slot_type: string | null;
  primary_role: string | null;
  machine_name: string | null;
}

// EN→CZ synonym translation for exercise/machine search
const SEARCH_SYNONYMS: Record<string, string> = {
  // Equipment
  'dumbbell': 'jednoruč', 'dumbbells': 'jednoruč',
  'cable': 'kabel',
  'barbell': 'osa',
  'kettlebell': 'kettlebell',
  // Body parts
  'chest': 'prsa',
  'back': 'záda',
  'shoulder': 'ramena', 'shoulders': 'ramena',
  'glute': 'hýždě', 'glutes': 'hýždě',
  'bicep': 'biceps', 'biceps': 'biceps',
  'tricep': 'triceps', 'triceps': 'triceps',
  'calf': 'lýtka', 'calves': 'lýtka',
  'abs': 'břicho', 'core': 'střed',
  'leg': 'nohy', 'legs': 'nohy',
  // Movements
  'squat': 'dřep',
  'deadlift': 'mrtvý tah',
  'row': 'přítah', 'rowing': 'veslování',
  'curl': 'zdvih',
  'press': 'tlak',
  'fly': 'rozpažení',
  'pulldown': 'stažení',
  'lunge': 'výpad',
  'extension': 'natažení',
  'pullup': 'přítah', 'pull-up': 'přítah',
  'shrug': 'krčení',
  'treadmill': 'běh',
  'bike': 'kolo',
};

// Translates a single word using synonym table
const translateWord = (w: string): string => SEARCH_SYNONYMS[w.toLowerCase().trim()] ?? w;

// Full-query single-word translation (for exercise name search)
const translateQuery = (q: string): string => SEARCH_SYNONYMS[q.toLowerCase().trim()] ?? q;

// Multi-word machine search: each word matched as original OR translated
const filterMachinesByQuery = (machines: string[], query: string): string[] => {
  if (!query.trim()) return [];
  const words = query.toLowerCase().trim().split(/\s+/);
  return machines.filter(machine => {
    const ml = machine.toLowerCase();
    return words.every(word => {
      const translated = translateWord(word);
      return ml.includes(word) || (translated !== word && ml.includes(translated));
    });
  });
};

// Muscle filters - matching actual Czech primary_muscles values from DB
const getMuscleFilters = (t: (key: string) => string) => [
  { key: 'back', label: t('custom_plan.muscle_back'), match: ['záda', 'back', 'laty', 'latisi', 'latysi', 'lopatky', 'trapéz', 'trapez', 'traps', 'pilovitý', 'pilovity', 'rhomboid', 'wide_back', 'střed zad', 'stred zad'] },
  { key: 'chest', label: t('custom_plan.muscle_chest'), match: ['prsa', 'prsní', 'chest', 'horní prsa', 'horni prsa'] },
  { key: 'legs', label: t('custom_plan.muscle_legs'), match: ['nohy', 'nožní', 'kvadriceps', 'quadriceps', 'quads', 'dolní konč', 'dolni konc', 'lýtka', 'lytka', 'calves', 'hamstring', 'front_thigh', 'back_thigh'] },
  { key: 'glutes', label: t('custom_plan.muscle_glutes'), match: ['zadek', 'glute', 'hýždě', 'hyzde'] },
  { key: 'shoulders', label: t('custom_plan.muscle_shoulders'), match: ['ramena', 'shoulders', 'front_shoulders', 'side_shoulders', 'deltoid'] },
  { key: 'biceps', label: t('custom_plan.muscle_biceps'), match: ['biceps'] },
  { key: 'triceps', label: t('custom_plan.muscle_triceps'), match: ['triceps'] },
  { key: 'core', label: t('custom_plan.muscle_core'), match: ['břišní', 'brisni', 'břicho', 'bricho', 'střed těla', 'stred tela', 'core', 'abs', 'bedra'] },
  { key: 'calves', label: t('custom_plan.muscle_calves'), match: ['lýtka', 'lytka', 'calves', 'calf'] },
  { key: 'arms', label: t('custom_plan.muscle_arms'), match: ['paže', 'paze', 'ruce'] },
  { key: 'fullbody', label: t('custom_plan.muscle_fullbody'), match: ['fullbody', 'fulbody', 'full body'] },
];

// Equipment: actual DB values are machine, free_weight, bodyweight, kettlebell, other
const getEquipmentFilters = (t: (key: string) => string) => [
  { key: 'machine', label: t('equipment.machine') },
  { key: 'free_weight', label: t('equipment.free_weight') },
  { key: 'kettlebell', label: t('equipment.kettlebell') },
  { key: 'bodyweight', label: t('equipment.bodyweight') },
];

// Slot type: actual DB values are main, secondary, accessory, core
const getSlotTypeFilters = (t: (key: string) => string) => [
  { key: 'main', label: t('slot.main') },
  { key: 'secondary', label: t('slot.secondary') },
  { key: 'accessory', label: t('custom_plan.slot_accessory') },
  { key: 'core', label: t('slot.core') },
];

// Role filters grouped - keys match actual primary_role values in DB
const getRoleFilterGroups = (t: (key: string) => string) => [
  {
    label: t('custom_plan.role_group_upper'),
    roles: [
      { key: 'horizontal_push', label: t('custom_plan.role_horizontal_push') },
      { key: 'horizontal_pull', label: t('custom_plan.role_horizontal_pull') },
      { key: 'vertical_push', label: t('custom_plan.role_vertical_push') },
      { key: 'vertical_pull', label: t('custom_plan.role_vertical_pull') },
      { key: 'elbow_flexion', label: t('custom_plan.role_elbow_flexion') },
      { key: 'elbow_extension', label: t('custom_plan.role_elbow_extension') },
      { key: 'shoulder_abduction', label: t('custom_plan.role_shoulder_abduction') },
      { key: 'shoulder_adduction', label: t('custom_plan.role_shoulder_adduction') },
      { key: 'rear_delt_isolation', label: t('custom_plan.role_rear_delt_isolation') },
      { key: 'upper_back_isolation', label: t('custom_plan.role_upper_back_isolation') },
    ],
  },
  {
    label: t('custom_plan.role_group_lower'),
    roles: [
      { key: 'squat', label: t('custom_plan.role_squat') },
      { key: 'hinge', label: t('custom_plan.role_hinge') },
      { key: 'lunge', label: t('custom_plan.role_lunge') },
      { key: 'step', label: t('custom_plan.role_step') },
      { key: 'jump', label: t('custom_plan.role_jump') },
      { key: 'full_body_pull', label: t('custom_plan.role_full_body_pull') },
    ],
  },
  {
    label: t('custom_plan.role_group_core'),
    roles: [
      { key: 'anti_extension', label: t('custom_plan.role_anti_extension') },
      { key: 'rotation', label: t('custom_plan.role_rotation') },
    ],
  },
  {
    label: t('custom_plan.role_group_cardio'),
    roles: [
      { key: 'cyclical_cardio', label: t('custom_plan.role_cyclical_cardio') },
      { key: 'cyclical_pull', label: t('custom_plan.role_cyclical_pull') },
      { key: 'cyclical_push', label: t('custom_plan.role_cyclical_push') },
    ],
  },
];

const getCategoryLabel = (key: string, t: (k: string) => string): string =>
  ({ chest: t('category.chest'), back: t('category.back'), shoulders: t('category.shoulders'), arms: t('category.arms'),
     legs: t('category.legs'), core: t('category.core'), cardio: t('category.cardio'),
     full_body: t('category.full_body'), abdominals: t('category.abdominals'),
     strength: t('category.strength') }[key] ?? key);

const getEquipmentLabel = (key: string, t: (k: string) => string): string =>
  ({ bodyweight: t('equipment.bodyweight'), barbell: t('equipment.barbell'), dumbbell: t('equipment.dumbbell'),
     kettlebell: t('equipment.kettlebell'), machine: t('equipment.machine'), cable: t('equipment.cable'),
     plate_loaded: t('equipment.plate_loaded'), other: t('equipment.other') }[key] ?? key);

// Build a public CDN url synchronously (exercise-videos is a public bucket).
const CARD_BUCKET = 'exercise-videos';
const publicVideoUrl = (videoPath: string | null): string | null => {
  if (!videoPath) return null;
  const marker = `/${CARD_BUCKET}/`;
  const idx = videoPath.indexOf(marker);
  const path = idx !== -1 ? videoPath.substring(idx + marker.length) : videoPath;
  return supabase.storage.from(CARD_BUCKET).getPublicUrl(path).data?.publicUrl ?? null;
};

// Static first-frame JPEG thumbnail with dumbbell fallback for the card
// (<video> thumbnails stall iOS when many render at once).
const CardThumb = ({ videoPath }: { videoPath: string | null }) => {
  const [error, setError] = useState(false);
  // Klíčované na videoPath: dřív useRef zmrazil první URL, takže po výměně cviku
  // zůstal starý obrázek (nález 12. 9.)
  const url = useMemo(() => getVideoThumbUrl(videoPath), [videoPath]);
  useEffect(() => { setError(false); }, [videoPath]);
  if (!url || error) {
    return (
      <div className="shrink-0 w-11 h-11 rounded-xl bg-muted flex items-center justify-center">
        <Dumbbell className="w-5 h-5 text-muted-foreground/50" />
      </div>
    );
  }
  return (
    <div className="shrink-0 w-11 h-11 rounded-xl overflow-hidden bg-muted">
      <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" onError={() => setError(true)} />
    </div>
  );
};

// Rest-timer picker options: Off (0), then 5s..5min in 5s steps.
export const REST_OPTIONS: number[] = [0, ...Array.from({ length: 60 }, (_, i) => (i + 1) * 5)];

// "1 min 30 s" / "45 s" / "Vypnuto"
export const formatRest = (sec: number, t: (k: string) => string): string => {
  if (!sec || sec <= 0) return t('custom_plan.rest_off');
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const min = t('custom_plan.rest_minutes_short');
  const secL = t('custom_plan.rest_seconds_short');
  if (m > 0 && s > 0) return `${m} ${min} ${s} ${secL}`;
  if (m > 0) return `${m} ${min}`;
  return `${s} ${secL}`;
};

// --- Per-set table row (SÉRIE | KG | OPAK.) — local state, saves on blur ---
const SetRowInput = ({ index, reps, weight, isCardio, setTypes, onRepsChange, onWeightChange, onOpenTypeSheet, onRemove }: {
  index: number; reps: number; weight: number | null;
  isCardio: boolean; setTypes: (string | null)[] | null;
  onRepsChange: (v: number) => void; onWeightChange: (v: number | null) => void; onOpenTypeSheet: (index: number) => void;
  onRemove?: () => void;
}) => {
  const [r, setR] = useState(String(reps));
  const [w, setW] = useState(weight != null ? String(weight) : '');
  const [cardioMin, setCardioMin] = useState(String(Math.floor(reps / 60)));
  const [cardioSec, setCardioSec] = useState(String(reps % 60));

  // Keep local inputs in sync when the underlying value changes (copy-down / add-set).
  useEffect(() => { setR(String(reps)); setCardioMin(String(Math.floor(reps / 60))); setCardioSec(String(reps % 60)); }, [reps]);
  useEffect(() => { setW(weight != null ? String(weight) : ''); }, [weight]);

  const saveCardio = (mStr: string, sStr: string) => {
    const m = Math.max(0, parseInt(mStr) || 0);
    const s = Math.max(0, Math.min(59, parseInt(sStr) || 0));
    setCardioMin(String(m));
    setCardioSec(String(s));
    onRepsChange(m * 60 + s);
  };

  return (
    <motion.div
      drag={onRemove ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: 0.5, right: 0 }}
      style={{ touchAction: 'pan-y' }}
      onDragEnd={(_, info) => { if (onRemove && (info.offset.x < -60 || info.velocity.x < -400)) onRemove(); }}
      className="flex items-center gap-2 py-1"
    >
      {/* SÉRIE — type badge, tap opens the "Typ série" sheet */}
      <button
        onClick={() => onOpenTypeSheet(index)}
        className={cn('w-10 shrink-0 h-8 rounded-lg bg-muted/70 flex items-center justify-center text-sm font-bold active:scale-95 transition-transform', setBadgeColor(setTypes, index))}
      >
        {setBadgeLabel(setTypes, index)}
      </button>
      {isCardio ? (
        <div className="flex-1 flex items-center gap-2">
          <div className="flex items-center gap-1">
            <GestureSafeInput containerClassName="w-14" type="number" value={cardioMin} onChange={(e) => setCardioMin(e.target.value)}
              onBlur={() => saveCardio(cardioMin, cardioSec)}
              className="w-full bg-muted rounded-lg px-2 py-1.5 text-sm text-center outline-none focus:ring-2 focus:ring-primary/30" min={0} />
            <span className="text-[10px] text-muted-foreground">min</span>
          </div>
          <div className="flex items-center gap-1">
            <GestureSafeInput containerClassName="w-14" type="number" value={cardioSec} onChange={(e) => setCardioSec(e.target.value)}
              onBlur={() => saveCardio(cardioMin, cardioSec)}
              className="w-full bg-muted rounded-lg px-2 py-1.5 text-sm text-center outline-none focus:ring-2 focus:ring-primary/30" min={0} max={59} />
            <span className="text-[10px] text-muted-foreground">s</span>
          </div>
        </div>
      ) : (
        <>
          <GestureSafeInput containerClassName="flex-1 min-w-0" type="number" value={w} onChange={(e) => setW(e.target.value)}
            onBlur={() => { const v = w ? parseFloat(w) : null; onWeightChange(v); }}
            placeholder="–" className="w-full bg-muted rounded-lg px-2 py-1.5 text-sm text-center outline-none focus:ring-2 focus:ring-primary/30" min={0} step={0.5} />
          <GestureSafeInput containerClassName="flex-1 min-w-0" type="number" value={r} onChange={(e) => setR(e.target.value)}
            onBlur={() => { const v = Math.max(1, parseInt(r) || 1); setR(String(v)); onRepsChange(v); }}
            className="w-full bg-muted rounded-lg px-2 py-1.5 text-sm text-center outline-none focus:ring-2 focus:ring-primary/30" min={1} />
        </>
      )}
    </motion.div>
  );
};

// --- Per-exercise note (local state, saves on blur) ---
const NoteInput = ({ value, onSave }: { value: string | null; onSave: (v: string | null) => void }) => {
  const { t } = useTranslation();
  const [note, setNote] = useState(value ?? '');
  useEffect(() => { setNote(value ?? ''); }, [value]);
  return (
    <input
      type="text"
      value={note}
      onChange={(e) => setNote(e.target.value)}
      onBlur={() => { const v = note.trim() || null; if (v !== (value ?? null)) onSave(v); }}
      placeholder={t('custom_plan.note_placeholder')}
      className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70 py-1"
    />
  );
};

// --- Sortable Exercise Item ---
interface SortableExerciseProps {
  exercise: CustomPlanExercise;
  onUpdate: (id: string, updates: Record<string, any>) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onShowDetail: (exerciseId: string) => void;
  onOpenRestSheet: (exercise: CustomPlanExercise) => void;
  onOpenTypeSheet: (exercise: CustomPlanExercise, setIndex: number) => void;
  isIncompatible?: boolean;
  alternatives?: AlternativeExercise[];
  onSwapExercise?: (oldExerciseId: string, newExercise: AlternativeExercise) => void;
  // Per-row swap picker (catalog-wide): tap = quick swap, hold = full list.
  onSwapQuick?: (exercise: CustomPlanExercise) => void;
  onSwapLong?: (exercise: CustomPlanExercise) => void;
  isSwapping?: boolean;
}

const SortableExerciseItem = ({ exercise, onUpdate, onRemove, onDuplicate, onShowDetail, onOpenRestSheet, onOpenTypeSheet, isIncompatible, alternatives, onSwapExercise, onSwapQuick, onSwapLong, isSwapping }: SortableExerciseProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: exercise.id });
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';
  const [menuOpen, setMenuOpen] = useState(false);
  // Hold the swap icon → sheet with every catalog alternative (parent-owned).
  const swapPress = useLongPress(() => onSwapLong?.(exercise));

  const style = { transform: CSS.Transform.toString(transform), transition };
  const isCardio = exercise.unit_type === 'time_min' || exercise.category === 'cardio';

  // Swipe-left removal of a single set row (mirrors the type-sheet removal).
  const handleRemoveSetAt = (setIndex: number) => {
    if (exercise.sets <= 1) { onRemove(exercise.id); return; }
    const dropAt = <T,>(arr: T[] | null | undefined, fallback: T[]): T[] => (arr ?? fallback).filter((_, i) => i !== setIndex);
    onUpdate(exercise.id, {
      sets: exercise.sets - 1,
      reps_per_set: dropAt(exercise.reps_per_set, Array(exercise.sets).fill(exercise.reps)),
      weight_per_set: dropAt(exercise.weight_per_set, Array(exercise.sets).fill(exercise.weight_kg)),
      set_types: dropAt(exercise.set_types, Array(exercise.sets).fill('normal')),
    });
  };

  // Append a new set copying the last set's values (Hevy "+ Add set").
  const handleAddSet = () => {
    const n = exercise.sets;
    const repsArr = exercise.reps_per_set || Array(n).fill(exercise.reps);
    const weightArr = exercise.weight_per_set || Array(n).fill(exercise.weight_kg);
    const typesArr = exercise.set_types || Array(n).fill('normal');
    onUpdate(exercise.id, {
      sets: n + 1,
      reps_per_set: [...repsArr, repsArr[n - 1] ?? exercise.reps],
      weight_per_set: [...weightArr, weightArr[n - 1] ?? exercise.weight_kg],
      set_types: [...typesArr, 'normal'],
    });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "py-3 border-b border-border/50 last:border-0 bg-card",
        isDragging && "opacity-50 shadow-lg rounded-xl z-50",
        isIncompatible && "bg-destructive/5 border-l-2 border-l-destructive"
      )}
    >
      {/* Header: thumbnail + name + ⋮ menu */}
      <div className="flex items-center gap-2">
        <button {...attributes} {...listeners} className="p-1 -ml-1 text-muted-foreground/40 hover:text-muted-foreground touch-none shrink-0">
          <GripVertical className="w-4 h-4" />
        </button>
        <button onClick={() => onShowDetail(exercise.exercise_id)} className="shrink-0">
          <CardThumb videoPath={exercise.video_path} />
        </button>
        <button
          onClick={() => onShowDetail(exercise.exercise_id)}
          className={cn(
            "flex-1 min-w-0 text-sm font-semibold truncate text-left transition-colors",
            isIncompatible ? "text-destructive hover:text-destructive/80" : "hover:text-[#5BC8F5]"
          )}
        >
          {isIncompatible && <AlertTriangle className="w-3.5 h-3.5 inline mr-1 mb-0.5" />}
          {(isEn && (exercise as any).exercise_name_en) ? (exercise as any).exercise_name_en : exercise.exercise_name || t('custom_plan.exercise_unknown')}
        </button>
        {onSwapQuick && (
          <button
            {...swapPress.handlers}
            onClick={() => { if (!swapPress.wasLongPress()) onSwapQuick(exercise); }}
            data-coach="editor-swap"
            className={cn('p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0', isSwapping && 'opacity-50')}
            style={{ touchAction: 'none' }}
            title={t('workout.swap')}
          >
            <RefreshCw className={cn('w-4 h-4', isSwapping && 'animate-spin')} />
          </button>
        )}
        <div className="relative shrink-0">
          <button onClick={() => setMenuOpen(o => !o)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-card border border-border rounded-xl shadow-lg overflow-hidden py-1">
                <button
                  onClick={() => { setMenuOpen(false); onDuplicate(exercise.id); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left"
                >
                  <Copy className="w-4 h-4 text-muted-foreground" />
                  {t('custom_plan.menu_duplicate')}
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onRemove(exercise.id); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors text-left"
                >
                  <Trash2 className="w-4 h-4" />
                  {t('custom_plan.menu_remove')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Note */}
      <div className="ml-7 mt-1.5">
        <NoteInput value={exercise.notes} onSave={(v) => onUpdate(exercise.id, { notes: v })} />
      </div>

      {/* Rest timer per exercise */}
      <button
        onClick={() => onOpenRestSheet(exercise)}
        className="ml-7 mt-1 flex items-center gap-2 text-xs font-medium text-[#5BC8F5] hover:opacity-80 transition-opacity"
      >
        <Clock className="w-3.5 h-3.5" />
        <span>{t('custom_plan.rest_row_label')}: {formatRest(exercise.rest_seconds, t)}</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </button>

      {/* Sets table */}
      <div className="ml-7 mt-2" data-coach="editor-sets">
        <div className="flex items-center gap-2 px-1 pb-1">
          <span className="w-10 shrink-0 text-[10px] font-semibold text-muted-foreground text-center">{t('custom_plan.col_set')}</span>
          {isCardio ? (
            <span className="flex-1 text-[10px] font-semibold text-muted-foreground">{t('workout.category_cardio')}</span>
          ) : (
            <>
              <span className="flex-1 text-[10px] font-semibold text-muted-foreground text-center">{t('custom_plan.col_kg')}</span>
              <span className="flex-1 text-[10px] font-semibold text-muted-foreground text-center">{t('custom_plan.col_reps')}</span>
            </>
          )}
        </div>
        {Array.from({ length: exercise.sets }, (_, i) => {
          const repsArr = exercise.reps_per_set || [];
          const weightArr = exercise.weight_per_set || [];
          const setReps = repsArr[i] ?? exercise.reps;
          const setWeight = weightArr[i] ?? exercise.weight_kg;
          return (
            <SetRowInput
              key={i}
              index={i}
              reps={setReps}
              weight={setWeight}
              isCardio={isCardio}
              setTypes={exercise.set_types}
              onRemove={() => handleRemoveSetAt(i)}
              onOpenTypeSheet={(idx) => onOpenTypeSheet(exercise, idx)}
              onRepsChange={(val) => {
                const base = exercise.reps_per_set || Array(exercise.sets).fill(exercise.reps);
                const prevFirst = base[0] ?? exercise.reps;
                // Copy-down: editing set 1 pre-fills later sets that are still
                // empty or untouched (equal to the old set-1 value).
                const arr = i === 0
                  ? base.map((v: number | null, idx: number) => (idx === 0 || v == null || v === prevFirst) ? val : v)
                  : base.map((v: number | null, idx: number) => idx === i ? val : v);
                const updates: Record<string, any> = { reps_per_set: arr };
                if (isCardio) updates.reps = val;
                onUpdate(exercise.id, updates);
              }}
              onWeightChange={(val) => {
                const base = exercise.weight_per_set || Array(exercise.sets).fill(exercise.weight_kg);
                const prevFirst = base[0] ?? exercise.weight_kg;
                const arr = i === 0
                  ? base.map((v: number | null, idx: number) => (idx === 0 || v == null || v === prevFirst) ? val : v)
                  : base.map((v: number | null, idx: number) => idx === i ? val : v);
                onUpdate(exercise.id, { weight_per_set: arr });
              }}
            />
          );
        })}

        <button
          onClick={handleAddSet}
          className="w-full flex items-center justify-center gap-1.5 mt-2 py-2 rounded-lg bg-muted/60 text-xs font-medium text-foreground hover:bg-muted transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          {t('custom_plan.add_set')}
        </button>
      </div>

      {/* Incompatible alternatives */}
      {isIncompatible && alternatives && alternatives.length > 0 && (
        <div className="ml-7 mt-2 mb-1">
          <p className="text-xs text-destructive font-medium mb-1.5">{t('custom_plan.incompatible_alternatives')}</p>
          <p className="text-[11px] text-muted-foreground mb-1.5">{t('custom_plan.swap_hint')}</p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {alternatives.map(alt => (
              <button
                key={alt.id}
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onSwapExercise?.(exercise.exercise_id, alt); }}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
              >
                <ArrowRightLeft className="w-3 h-3 shrink-0" />
                <span className="max-w-[120px] truncate">{(isEn && alt.name_en) ? alt.name_en : alt.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {isIncompatible && (!alternatives || alternatives.length === 0) && (
        <p className="ml-7 mt-1 mb-1 text-xs text-muted-foreground">{t('custom_plan.no_alternatives')}</p>
      )}
    </div>
  );
};

// --- Main Component ---
const CustomPlanDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  // First-run hints for the workout editor.
  const tour = useCoachTour('editor', 1, true);
  const tourSteps = [
    { target: '[data-coach="editor-sets"]', title: t('tour.editor.table_title'), body: t('tour.editor.table_body') },
    { target: '[data-coach="editor-sets"]', title: t('tour.editor.swipe_title'), body: t('tour.editor.swipe_body') },
    { target: '[data-coach="editor-swap"]', title: t('tour.editor.swap_title'), body: t('tour.editor.swap_body') },
    { target: '[data-coach="help-btn"]', title: t('tour.common.help_title'), body: t('tour.common.help_body') },
  ];
  const isEn = i18n.language === 'en';
  const { toast } = useToast();
  const { profile } = useUserProfile();
  const {
    plan, isLoading, addDay, removeDay, renameDay,
    addExercise, addExercisesBatch, updateExercise, removeExercise, renamePlan, reorderExercises, duplicateExercise,
    sharePlan, unsharePlan,
  } = useCustomPlanDetail(id || null);
  const [isSharing, setIsSharing] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const [editingPlanName, setEditingPlanName] = useState(false);
  const [planNameValue, setPlanNameValue] = useState('');
  const [editingDayId, setEditingDayId] = useState<string | null>(null);
  const [editingDayName, setEditingDayName] = useState('');
  const [exerciseDrawerOpen, setExerciseDrawerOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [drawerHeight, setDrawerHeight] = useState('100dvh');
  const [drawerBottom, setDrawerBottom] = useState('0px');
  const [showGymSelector, setShowGymSelector] = useState(false);
  const [showLocationGate, setShowLocationGate] = useState(false);
  const [locationGymLat, setLocationGymLat] = useState<number | null>(null);
  const [locationGymLng, setLocationGymLng] = useState<number | null>(null);
  const [locationGymName, setLocationGymName] = useState('');
  const [selectedWorkoutGymId, setSelectedWorkoutGymId] = useState<string | null>(null);
  const [incompatibleExercises, setIncompatibleExercises] = useState<IncompatibleExercise[]>([]);
  const [isCheckingEquipment, setIsCheckingEquipment] = useState(false);
  const [pendingWorkoutPath, setPendingWorkoutPath] = useState<string | null>(null);

  // Derived filter lists (require t from hook, so created inside component)
  const MUSCLE_FILTERS = getMuscleFilters(t);
  const EQUIPMENT_FILTERS = getEquipmentFilters(t);
  const SLOT_TYPE_FILTERS = getSlotTypeFilters(t);
  const ROLE_FILTER_GROUPS = getRoleFilterGroups(t);

  // Called when user selects a gym in the GymSelector
  const handleGymSelected = async (gymId: string) => {
    if (!id) return;
    setShowGymSelector(false);
    setIsCheckingEquipment(true);

    try {
      // Fetch gym coordinates + name
      const { data: gymData } = await supabase
        .from('gyms')
        .select('name, latitude, longitude')
        .eq('id', gymId)
        .single();

      // Run equipment check
      const incompatible = await checkCustomPlanEquipment(id, gymId);
      setIncompatibleExercises(incompatible);

      if (incompatible.length > 0) {
        // Stay on this page — red highlights will appear
        setSelectedWorkoutGymId(gymId);
        setLocationGymName(gymData?.name || t('custom_plan.gym_fallback'));
        return;
      }

      // All OK — proceed to location gate or start
      setSelectedWorkoutGymId(gymId);
      if (gymData?.latitude != null && gymData?.longitude != null) {
        setLocationGymName(gymData.name || t('custom_plan.gym_fallback'));
        setLocationGymLat(gymData.latitude);
        setLocationGymLng(gymData.longitude);
        setPendingWorkoutPath(`/custom-workout/${id}?gym=${gymId}`);
        setShowLocationGate(true);
      } else {
        navigate(`/custom-workout/${id}?gym=${gymId}`);
      }
    } finally {
      setIsCheckingEquipment(false);
    }
  };

  // Proceed into the workout for the already-chosen gym. Shared by the normal
  // path and by "start anyway", so the location gate behaves identically in both.
  const proceedToWorkout = async (gymId: string) => {
    const { data: gymData } = await supabase
      .from('gyms')
      .select('latitude, longitude, name')
      .eq('id', gymId)
      .single();

    if (gymData?.latitude != null && gymData?.longitude != null) {
      setLocationGymName(gymData.name || t('custom_plan.gym_fallback'));
      setLocationGymLat(gymData.latitude);
      setLocationGymLng(gymData.longitude);
      setPendingWorkoutPath(`/custom-workout/${id}?gym=${gymId}`);
      setShowLocationGate(true);
    } else {
      navigate(`/custom-workout/${id}?gym=${gymId}`);
    }
  };

  // Escape hatch for the equipment gate. A missing machine in the catalogue does
  // not mean the exercise is impossible — the gym may simply not have that piece
  // listed. Blocking the workout outright was the single most common complaint,
  // so the warning stays but it is no longer a dead end.
  const handleStartAnyway = async () => {
    if (!selectedWorkoutGymId) return;
    setIsCheckingEquipment(true);
    try {
      await proceedToWorkout(selectedWorkoutGymId);
    } finally {
      setIsCheckingEquipment(false);
    }
  };

  // Called after all incompatible exercises are fixed and user retries
  const handleRetryAfterFix = async () => {
    if (!id || !selectedWorkoutGymId) return;
    setIsCheckingEquipment(true);
    try {
      const incompatible = await checkCustomPlanEquipment(id, selectedWorkoutGymId);
      setIncompatibleExercises(incompatible);
      if (incompatible.length > 0) return;

      await proceedToWorkout(selectedWorkoutGymId);
    } finally {
      setIsCheckingEquipment(false);
    }
  };

  // Swap incompatible exercise for an alternative
  const handleSwapExercise = async (oldExerciseId: string, alt: AlternativeExercise) => {
    if (!plan || !id) return;
    // Find all custom_plan_exercises entries with this exercise_id across all days
    for (const day of plan.days) {
      for (const ex of day.exercises) {
        if (ex.exercise_id === oldExerciseId) {
          await updateExercise(ex.id, { exercise_id: alt.id, exercise_name: alt.name, exercise_name_en: alt.name_en ?? null, video_path: alt.video_path ?? null } as Parameters<typeof updateExercise>[1]);
        }
      }
    }
    // Re-run equipment check
    if (selectedWorkoutGymId) {
      const incompatible = await checkCustomPlanEquipment(id, selectedWorkoutGymId);
      setIncompatibleExercises(incompatible);
    }
  };

  // --- Per-row catalog swap (tap = quick, hold = full list) ---
  const [swapRow, setSwapRow] = useState<CustomPlanExercise | null>(null);
  const [swapOptions, setSwapOptions] = useState<SwapCandidate[] | null>(null);
  const [swapInfoId, setSwapInfoId] = useState<string | null>(null);
  const [isSwappingRowId, setIsSwappingRowId] = useState<string | null>(null);

  // Other exercises already in the same day — excluded so a swap never suggests
  // a movement that's already in the workout.
  const sameDayExcludeIds = (exercise: CustomPlanExercise): string[] => {
    const day = plan?.days.find(d => d.exercises.some(e => e.id === exercise.id));
    return (day?.exercises || []).filter(e => e.id !== exercise.id).map(e => e.exercise_id);
  };

  // Replace a row's exercise with the picked alternative (persists via updateExercise).
  const applyRowSwap = async (row: CustomPlanExercise, pick: SwapCandidate) => {
    await updateExercise(row.id, { exercise_id: pick.id, exercise_name: pick.name, exercise_name_en: pick.name_en ?? null, video_path: pick.video_path ?? null } as Parameters<typeof updateExercise>[1]);
    toast({ title: t('workout.swap_success', { name: pick.name }) });
  };

  const handleRowSwapQuick = async (exercise: CustomPlanExercise) => {
    if (isSwappingRowId) return;
    setIsSwappingRowId(exercise.id);
    try {
      const candidates = await fetchCatalogAlternatives(exercise.exercise_id, sameDayExcludeIds(exercise));
      if (candidates.length === 0) { toast({ title: t('workout.no_replacement') }); return; }
      await applyRowSwap(exercise, candidates[Math.floor(Math.random() * candidates.length)]);
    } finally {
      setIsSwappingRowId(null);
    }
  };

  const handleRowSwapLong = async (exercise: CustomPlanExercise) => {
    if (isSwappingRowId) return;
    setIsSwappingRowId(exercise.id);
    try {
      const candidates = await fetchCatalogAlternatives(exercise.exercise_id, sameDayExcludeIds(exercise));
      setSwapRow(exercise);
      setSwapOptions(candidates);
    } finally {
      setIsSwappingRowId(null);
    }
  };

  // --- P2 set-type / rest-timer handlers ---
  const handleSelectSetType = (type: SetType) => {
    if (!typeSheet) return;
    const { exercise, setIndex } = typeSheet;
    const types = [...(exercise.set_types || Array(exercise.sets).fill('normal'))];
    while (types.length < exercise.sets) types.push('normal');
    types[setIndex] = type;
    updateExercise(exercise.id, { set_types: types });
    setTypeSheet(null);
  };

  const handleRemoveSet = () => {
    if (!typeSheet) return;
    const { exercise, setIndex } = typeSheet;
    // Removing the only set removes the whole exercise (Hevy behaviour).
    if (exercise.sets <= 1) {
      removeExercise(exercise.id);
      setTypeSheet(null);
      return;
    }
    const dropAt = <T,>(arr: T[] | null, fallback: T[]): T[] => (arr ?? fallback).filter((_, i) => i !== setIndex);
    updateExercise(exercise.id, {
      sets: exercise.sets - 1,
      reps_per_set: dropAt(exercise.reps_per_set, Array(exercise.sets).fill(exercise.reps)),
      weight_per_set: dropAt(exercise.weight_per_set, Array(exercise.sets).fill(exercise.weight_kg)),
      set_types: dropAt(exercise.set_types, Array(exercise.sets).fill('normal')),
    });
    setTypeSheet(null);
  };

  const handleSelectRest = (seconds: number) => {
    if (!restSheetExercise) return;
    // Store rest at the exercise level; clear any legacy per-set rest so it applies.
    updateExercise(restSheetExercise.id, { rest_seconds: seconds, rest_per_set: null });
    setRestSheetExercise(null);
  };

  useEffect(() => {
    if (!exerciseDrawerOpen) return;
    const update = () => {
      const h = window.visualViewport?.height ?? window.innerHeight;
      const keyboardH = Math.max(0, window.innerHeight - h);
      setDrawerHeight(`${h}px`);
      setDrawerBottom(`${keyboardH}px`);
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    };
    update();
    window.visualViewport?.addEventListener('resize', update);
    return () => window.visualViewport?.removeEventListener('resize', update);
  }, [exerciseDrawerOpen]);
  const [activeDayId, setActiveDayId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [allExercises, setAllExercises] = useState<ExerciseSearchResult[]>([]);
  const [filteredExercises, setFilteredExercises] = useState<ExerciseSearchResult[]>([]);
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [selectedMuscles, setSelectedMuscles] = useState<Set<string>>(new Set());
  const [selectedEquipment, setSelectedEquipment] = useState<Set<string>>(new Set());
  const [selectedSlotTypes, setSelectedSlotTypes] = useState<Set<string>>(new Set());
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [machineSearch, setMachineSearch] = useState('');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [detailExercise, setDetailExercise] = useState<ExerciseSearchResult | null>(null);
  const [videoError, setVideoError] = useState(false);
  const [signedDetailVideoUrl, setSignedDetailVideoUrl] = useState<string | null>(null);
  // P2: rest-timer sheet, set-type sheet, set-type explanation dialog, title validation
  const [restSheetExercise, setRestSheetExercise] = useState<CustomPlanExercise | null>(null);
  const [typeSheet, setTypeSheet] = useState<{ exercise: CustomPlanExercise; setIndex: number } | null>(null);
  const [explainType, setExplainType] = useState<SetType | null>(null);
  const [showTitleDialog, setShowTitleDialog] = useState(false);
  const [titleDialogName, setTitleDialogName] = useState('');
  const [viewExerciseDrawerOpen, setViewExerciseDrawerOpen] = useState(false);
  const [viewExerciseData, setViewExerciseData] = useState<ExerciseSearchResult | null>(null);
  const [viewVideoError, setViewVideoError] = useState(false);
  const [signedViewVideoUrl, setSignedViewVideoUrl] = useState<string | null>(null);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const { pausedWorkout: pausedCustomWorkout, clearPausedWorkout: clearPausedCustomWorkout } = usePausedCustomWorkout();

  useEffect(() => {
    let cancelled = false;
    setSignedDetailVideoUrl(null);
    getSignedVideoUrl(detailExercise?.video_path ?? null).then(url => { if (!cancelled) setSignedDetailVideoUrl(url); });
    return () => { cancelled = true; };
  }, [detailExercise]);

  useEffect(() => {
    let cancelled = false;
    setSignedViewVideoUrl(null);
    getSignedVideoUrl(viewExerciseData?.video_path ?? null).then(url => { if (!cancelled) setSignedViewVideoUrl(url); });
    return () => { cancelled = true; };
  }, [viewExerciseData]);

  const activeFilterCount = selectedMuscles.size + selectedEquipment.size + selectedSlotTypes.size + selectedRoles.size + (machineSearch.length > 0 ? 1 : 0);

  const uniqueMachineNames = useMemo(() => {
    const names = allExercises
      .map(e => e.machine_name)
      .filter((n): n is string => Boolean(n));
    return [...new Set(names)].sort((a, b) => a.localeCompare(b, 'cs'));
  }, [allExercises]);


  const loadAllExercises = useCallback(async () => {
    setLoadingExercises(true);
    const { data } = await supabase
      .from('exercises')
      .select('id, name, name_en, description, description_en, setup_instructions, setup_instructions_en, common_mistakes, common_mistakes_en, tips, tips_en, category, primary_muscles, secondary_muscles, primary_muscles_en, secondary_muscles_en, equipment_type, video_path, slot_type, primary_role, machine_id, machines!exercises_machine_id_fkey(name)')
      .order('name', { ascending: true });
    const exercises = (data || []).map((e: any) => ({
      ...e,
      name_en: (e as any).name_en ?? null,
      machine_name: e.machines?.name || null,
      primary_muscles: e.primary_muscles || [],
      secondary_muscles: e.secondary_muscles || [],
    }));
    setAllExercises(exercises);
    setFilteredExercises(exercises);
    setLoadingExercises(false);
  }, []);

  const applyFilters = useCallback((
    query: string,
    muscles: Set<string>,
    equipment: Set<string>,
    slotTypes: Set<string>,
    roles: Set<string>,
    machineQ: string = '',
  ) => {
    let results = allExercises;

    if (query.length >= 1) {
      const q = translateQuery(query.toLowerCase());
      results = results.filter(e => e.name.toLowerCase().includes(q));
    }

    if (muscles.size > 0) {
      results = results.filter(e => {
        const allMuscleText = (e.primary_muscles || []).join(' ').toLowerCase();
        for (const muscleKey of muscles) {
          const filterDef = getMuscleFilters(t).find(f => f.key === muscleKey);
          if (!filterDef) continue;
          if (filterDef.match.some(m => allMuscleText.includes(m.toLowerCase()))) return true;
        }
        return false;
      });
    }

    if (equipment.size > 0) {
      results = results.filter(e =>
        e.equipment_type != null && equipment.has(e.equipment_type)
      );
    }

    if (slotTypes.size > 0) {
      results = results.filter(e => e.slot_type && slotTypes.has(e.slot_type));
    }

    if (roles.size > 0) {
      results = results.filter(e => e.primary_role && roles.has(e.primary_role));
    }

    if (machineQ.length >= 1) {
      const mq = translateQuery(machineQ.toLowerCase());
      results = results.filter(e =>
        (e.machine_name && e.machine_name.toLowerCase().includes(mq)) ||
        e.name.toLowerCase().includes(mq)
      );
    }

    setFilteredExercises(results);
  }, [allExercises, t]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      applyFilters(query, selectedMuscles, selectedEquipment, selectedSlotTypes, selectedRoles, machineSearch);
    }, 150);
  };

  const toggleFilter = (set: Set<string>, setFn: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setFn(next);
  };

  const clearAllFilters = () => {
    setSelectedMuscles(new Set());
    setSelectedEquipment(new Set());
    setSelectedSlotTypes(new Set());
    setSelectedRoles(new Set());
    setMachineSearch('');
  };

  const applyAndCloseFilters = () => {
    applyFilters(searchQuery, selectedMuscles, selectedEquipment, selectedSlotTypes, selectedRoles, machineSearch);
    setFilterPanelOpen(false);
  };

  const handleAddExercise = async (exercise: ExerciseSearchResult) => {
    if (!activeDayId) return;
    await addExercise(activeDayId, exercise.id);
    setExerciseDrawerOpen(false);
    resetSearch();
  };

  // Batch-add exercises picked in the Hevy-style ExercisePicker to the active day.
  const handleAddPickedExercises = async (exercises: PickerExercise[]) => {
    if (!activeDayId) return;
    await addExercisesBatch(activeDayId, exercises.map(e => e.id));
  };

  const resetSearch = () => {
    setSearchQuery('');
    clearAllFilters();
    setFilterPanelOpen(false);
    setDetailExercise(null);
    setVideoError(false);
    setAllExercises([]);
    setFilteredExercises([]);
  };

  const handlePlanNameSave = async () => {
    if (planNameValue.trim() && planNameValue.trim() !== plan?.name) {
      await renamePlan(planNameValue.trim());
    }
    setEditingPlanName(false);
  };

  const getPlanShareUrl = (token: string) => {
    const isNative = Capacitor.isNativePlatform();
    const base = isNative
      ? (import.meta.env.VITE_WEB_APP_URL || 'https://app.pumplo.com')
      : window.location.origin;
    return `${base}/plan/${token}`;
  };

  const handleShare = async () => {
    if (!plan) return;
    setIsSharing(true);
    let token = plan.share_token;
    if (!plan.is_public || !token) {
      token = await sharePlan() ?? token;
    }
    if (token) {
      const url = getPlanShareUrl(token);
      try {
        if (Capacitor.isNativePlatform()) {
          await Share.share({ title: plan.name, text: plan.name, url, dialogTitle: plan.name });
        } else if (navigator.share) {
          await navigator.share({ title: plan.name, url });
        } else {
          await navigator.clipboard.writeText(url);
          toast({ title: t('custom_plan.link_copied'), description: url });
        }
      } catch {
        await navigator.clipboard.writeText(url);
        toast({ title: t('custom_plan.link_copied'), description: url });
      }
    }
    setIsSharing(false);
  };

  const handleDayNameSave = async (dayId: string) => {
    if (editingDayName.trim()) {
      await renameDay(dayId, editingDayName.trim());
    }
    setEditingDayId(null);
  };

  const handleDragEnd = (dayId: string) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const day = plan?.days.find(d => d.id === dayId);
    if (!day) return;
    const oldIndex = day.exercises.findIndex(e => e.id === active.id);
    const newIndex = day.exercises.findIndex(e => e.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrder = arrayMove(day.exercises, oldIndex, newIndex);
    reorderExercises(dayId, newOrder.map(e => e.id));
  };

  const handleShowExerciseDetail = useCallback(async (exerciseId: string) => {
    setViewVideoError(false);
    setViewExerciseDrawerOpen(true);
    const { data } = await supabase
      .from('exercises')
      .select('id, name, name_en, description, description_en, setup_instructions, setup_instructions_en, common_mistakes, common_mistakes_en, tips, tips_en, category, primary_muscles, secondary_muscles, primary_muscles_en, secondary_muscles_en, equipment_type, video_path, slot_type, primary_role, machine_id, machines!exercises_machine_id_fkey(name)')
      .eq('id', exerciseId)
      .single();
    if (data) {
      setViewExerciseData({
        ...data,
        machine_name: (data as any).machines?.name || null,
        primary_muscles: (data as any).primary_muscles || [],
        secondary_muscles: (data as any).secondary_muscles || [],
      } as ExerciseSearchResult);
    }
  }, []);

  useEffect(() => {
    if (exerciseDrawerOpen && allExercises.length === 0) {
      loadAllExercises();
    }
  }, [exerciseDrawerOpen, allExercises.length, loadAllExercises]);

  // Hevy has no "days" concept — a fresh routine should land straight on an
  // empty exercise list. Auto-create the first day once so the user can hit
  // "+ Přidat cvik" immediately instead of adding a day first.
  const autoDayCreatedRef = useRef(false);
  useEffect(() => {
    if (!plan || isLoading) return;
    if (plan.days.length === 0 && !autoDayCreatedRef.current) {
      autoDayCreatedRef.current = true;
      addDay(t('custom_plan.day_prefix', { n: 1 }));
    }
  }, [plan, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check if plan has any exercises to enable start button
  const hasExercises = plan?.days.some(d => d.exercises.length > 0) ?? false;
  const isSingleDay = (plan?.days.length ?? 0) <= 1;

  if (isLoading) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background safe-top pb-32">
          <div className="px-6 pt-8 space-y-4">
            <div className="h-10 w-48 bg-muted animate-pulse rounded-xl" />
            <div className="h-32 bg-muted animate-pulse rounded-2xl" />
            <div className="h-32 bg-muted animate-pulse rounded-2xl" />
          </div>
        </div>
      </PageTransition>
    );
  }

  if (!plan) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background safe-top flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">{t('custom_plan.plan_not_found')}</p>
            <Button onClick={() => navigate('/')} variant="outline">{t('custom_plan.back')}</Button>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <>
    <PageTransition>
      <div className="min-h-screen bg-background safe-top pb-32">
        {/* Header */}
        <div className="px-6 pt-8 pb-4">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 -ml-2 rounded-xl hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            {editingPlanName ? (
              <input
                type="text"
                value={planNameValue}
                onChange={(e) => setPlanNameValue(e.target.value)}
                onBlur={handlePlanNameSave}
                onKeyDown={(e) => e.key === 'Enter' && handlePlanNameSave()}
                autoFocus
                className="text-2xl font-bold bg-transparent outline-none border-b-2 border-primary flex-1 min-w-0"
                placeholder={t('custom_plan.name_placeholder')}
              />
            ) : (
              <button
                onClick={() => { setEditingPlanName(true); setPlanNameValue(plan.name); }}
                className="text-2xl font-bold truncate hover:text-primary transition-colors text-left flex-1 min-w-0"
              >
                {plan.name}
              </button>
            )}
            <CoachHelpButton onClick={tour.openTour} className="shrink-0" />
            <button
              onClick={handleShare}
              disabled={isSharing}
              className={`p-2 rounded-xl transition-colors shrink-0 ${plan.is_public ? 'text-primary bg-primary/10' : 'hover:bg-muted text-muted-foreground'}`}
              title={plan.is_public ? t('custom_plan.share_copy_link') : t('custom_plan.share_workout')}
            >
              {plan.is_public ? <Link className="w-5 h-5" /> : <Share2 className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Days */}
        <div className="px-6 space-y-4">
          {plan.days.map((day) => (
            <motion.div
              key={day.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-2xl overflow-hidden"
            >
              {/* Day Header — hidden for single-day routines so it reads as a flat Hevy list */}
              {!isSingleDay && (
                <div className="flex items-center justify-between px-4 py-3 bg-muted/50">
                  {editingDayId === day.id ? (
                    <input
                      type="text"
                      value={editingDayName}
                      onChange={(e) => setEditingDayName(e.target.value)}
                      onBlur={() => handleDayNameSave(day.id)}
                      onKeyDown={(e) => e.key === 'Enter' && handleDayNameSave(day.id)}
                      autoFocus
                      className="bg-transparent text-sm font-semibold outline-none border-b border-primary"
                    />
                  ) : (
                    <button
                      onClick={() => { setEditingDayId(day.id); setEditingDayName(day.name || t('custom_plan.day_prefix', { n: day.day_number })); }}
                      className="text-sm font-semibold hover:text-primary transition-colors"
                    >
                      {day.name || t('custom_plan.day_prefix', { n: day.day_number })}
                    </button>
                  )}
                  <button
                    onClick={() => removeDay(day.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Exercises with drag & drop */}
              <div className="px-4 py-2">
                {day.exercises.length === 0 ? (
                  <div className="flex flex-col items-center text-center py-8">
                    <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                      <Dumbbell className="w-7 h-7 text-muted-foreground/60" />
                    </div>
                    <p className="text-sm text-muted-foreground">{t('custom_plan.empty_routine_hint')}</p>
                  </div>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd(day.id)}
                  >
                    <SortableContext items={day.exercises.map(e => e.id)} strategy={verticalListSortingStrategy}>
                      {day.exercises.map((exercise) => {
                        const incompatInfo = incompatibleExercises.find(i => i.exercise_id === exercise.exercise_id);
                        return (
                          <SortableExerciseItem
                            key={exercise.id}
                            exercise={exercise}
                            onUpdate={updateExercise}
                            onRemove={removeExercise}
                            onDuplicate={duplicateExercise}
                            onShowDetail={handleShowExerciseDetail}
                            onOpenRestSheet={setRestSheetExercise}
                            onOpenTypeSheet={(ex, setIndex) => setTypeSheet({ exercise: ex, setIndex })}
                            isIncompatible={!!incompatInfo}
                            alternatives={incompatInfo?.alternatives}
                            onSwapExercise={handleSwapExercise}
                            onSwapQuick={handleRowSwapQuick}
                            onSwapLong={handleRowSwapLong}
                            isSwapping={isSwappingRowId === exercise.id}
                          />
                        );
                      })}
                    </SortableContext>
                  </DndContext>
                )}

                <button
                  onClick={() => { setActiveDayId(day.id); setPickerOpen(true); }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 mt-1 text-sm text-primary hover:bg-primary/5 rounded-xl transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  {t('custom_plan.add_exercise')}
                </button>
              </div>
            </motion.div>
          ))}

          <Button
            onClick={() => addDay()}
            variant="outline"
            className="w-full gap-2 rounded-2xl h-12 border-dashed border-2"
          >
            <Plus className="w-5 h-5" />
            {t('custom_plan.add_day')}
          </Button>
        </div>



        {/* Hevy-style multi-select exercise picker */}
        <ExercisePicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onAdd={handleAddPickedExercises}
          gymId={selectedWorkoutGymId || profile?.selected_gym_id || null}
        />


        {/* Exercise Detail View Drawer (from plan) */}
        <Drawer open={viewExerciseDrawerOpen} onOpenChange={(open) => { setViewExerciseDrawerOpen(open); if (!open) { setViewExerciseData(null); setViewVideoError(false); } }}>
          <DrawerContent className="flex flex-col" style={{ height: '85dvh', maxHeight: '85dvh' }}>
            <DrawerHeader className="shrink-0 pb-2" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}>
              <DrawerTitle>{viewExerciseData?.name || t('custom_plan.exercise_detail')}</DrawerTitle>
            </DrawerHeader>

            {viewExerciseData ? (
              <div className="flex-1 overflow-y-auto px-4 pb-6">
                {signedViewVideoUrl ? (
                  <div className="rounded-2xl overflow-hidden bg-black mb-4 aspect-video">
                    {viewVideoError ? (
                      <div className="w-full h-full flex items-center justify-center text-white/50 text-sm">{t('custom_plan.video_unavailable')}</div>
                    ) : (
                      <video
                        key={signedViewVideoUrl}
                        src={signedViewVideoUrl}
                        playsInline autoPlay loop muted preload="auto"
                        controlsList="nodownload"
                        className="w-full h-full object-contain"
                        style={{ borderRadius: '12px', opacity: 0, transition: 'opacity 0.3s' }}
                        onCanPlay={(e) => { (e.target as HTMLVideoElement).style.opacity = '1'; }}
                        onError={() => setViewVideoError(true)}
                      />
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl bg-muted mb-4 aspect-video flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">{t('custom_plan.no_video')}</p>
                  </div>
                )}

                <ExerciseInfoContent
                  category={viewExerciseData.category}
                  equipmentType={viewExerciseData.equipment_type}
                  machineName={viewExerciseData.machine_name}
                  primaryMuscles={viewExerciseData.primary_muscles}
                  secondaryMuscles={viewExerciseData.secondary_muscles}
                  primaryMusclesEn={viewExerciseData.primary_muscles_en}
                  secondaryMusclesEn={viewExerciseData.secondary_muscles_en}
                  description={viewExerciseData.description}
                  descriptionEn={viewExerciseData.description_en}
                  setupInstructions={viewExerciseData.setup_instructions}
                  setupInstructionsEn={viewExerciseData.setup_instructions_en}
                  commonMistakes={viewExerciseData.common_mistakes}
                  commonMistakesEn={viewExerciseData.common_mistakes_en}
                  tips={viewExerciseData.tips}
                  tipsEn={viewExerciseData.tips_en}
                />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">{t('custom_plan.loading')}</p>
              </div>
            )}
          </DrawerContent>
        </Drawer>
      </div>

      <CoachTour screenId="editor" steps={tourSteps} open={tour.open} onClose={tour.closeTour} />
    </PageTransition>

      {/* Equipment incompatibility banner */}
      {incompatibleExercises.length > 0 && (
        <div className="fixed left-0 right-0 px-4 z-[52]" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}>
          {/* Neprůhledný pruh: dřív byl poloprůhledný přes seznam a nešel číst (nález 12. 9.) */}
          <div className="bg-background border-2 border-destructive/60 rounded-xl px-4 py-3 shadow-lg flex flex-col gap-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-foreground font-semibold leading-snug">
                {t('custom_plan.incompatible_count', { count: incompatibleExercises.length, gym: locationGymName })}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={handleRetryAfterFix}
                disabled={isCheckingEquipment}
                className="text-sm font-semibold text-primary px-3 py-1.5 rounded-lg bg-primary/10"
              >
                {isCheckingEquipment ? '...' : t('custom_plan.check_equipment')}
              </button>
              <button
                onClick={handleStartAnyway}
                disabled={isCheckingEquipment}
                className="text-sm font-semibold text-foreground px-3 py-1.5 rounded-lg bg-muted"
              >
                {t('custom_plan.start_anyway')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Start Workout Button */}
      {hasExercises && !showGymSelector && !showLocationGate && (
        <div className="fixed left-0 right-0 px-6 pb-4 pt-2 bg-gradient-to-t from-background via-background to-transparent z-[51]" style={{ bottom: 'env(safe-area-inset-bottom, 0px)' }}>
          {pausedCustomWorkout && pausedCustomWorkout.planId === id ? (
            <Button
              onClick={() => navigate(`/custom-workout/${id}?resume=true`)}
              className="w-full h-16 rounded-2xl gap-3 text-lg font-bold bg-amber-500 hover:bg-amber-500/90 text-white shadow-lg shadow-amber-500/25"
            >
              <Play className="w-5 h-5" />
              {t('custom_plan.continue_workout')}
            </Button>
          ) : (
            <Button
              onClick={() => {
                // Hevy-style title validation before committing the routine.
                if (!plan.name.trim()) {
                  setTitleDialogName(plan.name);
                  setShowTitleDialog(true);
                  return;
                }
                if (pausedCustomWorkout && pausedCustomWorkout.planId !== id) {
                  setShowConflictDialog(true);
                } else {
                  setShowGymSelector(true);
                }
              }}
              className="w-full h-16 rounded-2xl gap-3 text-lg font-bold bg-action hover:bg-action/90 text-white shadow-lg shadow-action/25"
            >
              <Play className="w-5 h-5" />
              {t('custom_plan.start_workout')}
            </Button>
          )}
        </div>
      )}

      {/* Conflict dialog: paused workout for another plan */}
      {showConflictDialog && pausedCustomWorkout && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-6 bg-black/50 backdrop-blur-sm" onClick={() => setShowConflictDialog(false)}>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-center mb-1">{t('custom_plan.paused_workout_title')}</h2>
            <p className="text-muted-foreground text-sm text-center mb-5">
              {t('custom_plan.paused_workout_desc', { name: pausedCustomWorkout.planName })}
            </p>
            <div className="space-y-3">
              <button
                onClick={() => { setShowConflictDialog(false); navigate(`/custom-workout/${pausedCustomWorkout.planId}?resume=true`); }}
                className="w-full py-3.5 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-500/90 transition-colors"
              >
                {t('custom_plan.continue_paused')}
              </button>
              <button
                onClick={() => { clearPausedCustomWorkout(); setShowConflictDialog(false); setShowGymSelector(true); }}
                className="w-full py-3.5 rounded-xl bg-red-500/90 text-white font-semibold hover:bg-red-500 transition-colors"
              >
                {t('custom_plan.end_and_start_new')}
              </button>
              <button
                onClick={() => setShowConflictDialog(false)}
                className="w-full py-3.5 rounded-xl text-muted-foreground font-medium hover:text-foreground transition-colors"
              >
                {t('custom_plan.cancel')}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showGymSelector && createPortal(
        <GymSelector
          onSelect={handleGymSelected}
          onCancel={() => setShowGymSelector(false)}
          selectedGymId={selectedWorkoutGymId || profile?.selected_gym_id}
        />,
        document.body
      )}

      {showLocationGate && locationGymLat !== null && locationGymLng !== null && createPortal(
        <GymLocationGate
          gymLat={locationGymLat}
          gymLng={locationGymLng}
          gymName={locationGymName}
          onConfirmed={() => {
            setShowLocationGate(false);
            if (pendingWorkoutPath) navigate(pendingWorkoutPath);
          }}
          onCancel={() => setShowLocationGate(false)}
        />,
        document.body
      )}

      {/* Rest-timer picker sheet (per exercise) */}
      <Drawer open={!!restSheetExercise} onOpenChange={(o) => { if (!o) setRestSheetExercise(null); }}>
        <DrawerContent className="flex flex-col" style={{ maxHeight: '70dvh' }}>
          <DrawerHeader className="shrink-0">
            <DrawerTitle>{t('custom_plan.rest_sheet_title')}</DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-8">
            {REST_OPTIONS.map((sec) => {
              const selected = (restSheetExercise?.rest_seconds ?? 120) === sec;
              return (
                <button
                  key={sec}
                  onClick={() => handleSelectRest(sec)}
                  className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-muted transition-colors"
                >
                  <span className={cn('text-sm', selected ? 'font-semibold text-[#5BC8F5]' : 'text-foreground')}>{formatRest(sec, t)}</span>
                  {selected && <Check className="w-4 h-4 text-[#5BC8F5]" />}
                </button>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Set-type picker sheet */}
      <Drawer open={!!typeSheet} onOpenChange={(o) => { if (!o) setTypeSheet(null); }}>
        <DrawerContent className="flex flex-col" style={{ maxHeight: '75dvh' }}>
          <DrawerHeader className="shrink-0">
            <DrawerTitle>{t('set_type.sheet_title')}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-8">
            {SELECTABLE_SET_TYPES.map((type) => {
              const meta = SET_TYPE_META[type];
              const isCurrent = !!typeSheet && getSetType(typeSheet.exercise.set_types, typeSheet.setIndex) === type;
              return (
                <div key={type} className="flex items-center gap-1">
                  <button
                    onClick={() => handleSelectSetType(type)}
                    className="flex-1 flex items-center gap-3 px-3 py-3.5 rounded-xl hover:bg-muted transition-colors text-left"
                  >
                    <span className={cn('w-7 text-center font-bold', meta.color)}>{type === 'normal' ? '1' : type}</span>
                    <span className={cn('text-sm', isCurrent ? 'font-semibold text-[#5BC8F5]' : 'text-foreground')}>{t(meta.labelKey)}</span>
                    {isCurrent && <Check className="w-4 h-4 text-[#5BC8F5] ml-auto" />}
                  </button>
                  <button onClick={() => setExplainType(type)} className="p-2.5 text-muted-foreground hover:text-foreground transition-colors">
                    <HelpCircle className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
            <button
              onClick={handleRemoveSet}
              className="w-full flex items-center gap-3 px-3 py-3.5 mt-1 rounded-xl text-destructive hover:bg-destructive/10 transition-colors"
            >
              <X className="w-5 h-5 ml-0.5" />
              <span className="text-sm font-medium">{t('set_type.remove')}</span>
            </button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Set-type explanation dialog (?) — above the sheet */}
      {explainType && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-6 bg-black/50 backdrop-blur-sm" onClick={() => setExplainType(null)}>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={cn('w-8 h-8 rounded-lg bg-muted flex items-center justify-center font-bold', SET_TYPE_META[explainType].color)}>
                {explainType === 'normal' ? '1' : explainType}
              </span>
              <h2 className="text-lg font-bold">{t(SET_TYPE_META[explainType].labelKey)}</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-5">{t(SET_TYPE_META[explainType].explainKey)}</p>
            <button onClick={() => setExplainType(null)} className="w-full py-3 rounded-xl bg-action text-white font-semibold hover:bg-action/90 transition-colors">
              {t('set_type.explain_ok')}
            </button>
          </motion.div>
        </div>
      )}

      {/* Title-required validation dialog */}
      {showTitleDialog && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-6 bg-black/50 backdrop-blur-sm" onClick={() => setShowTitleDialog(false)}>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-center mb-1">{t('custom_plan.title_required_title')}</h2>
            <p className="text-muted-foreground text-sm text-center mb-4">{t('custom_plan.title_required_desc')}</p>
            <input
              type="text"
              value={titleDialogName}
              onChange={(e) => setTitleDialogName(e.target.value)}
              placeholder={t('custom_plan.name_placeholder')}
              autoFocus
              className="w-full bg-muted rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 mb-4"
            />
            <button
              disabled={!titleDialogName.trim()}
              onClick={async () => {
                const name = titleDialogName.trim();
                if (!name) return;
                await renamePlan(name);
                setShowTitleDialog(false);
                if (pausedCustomWorkout && pausedCustomWorkout.planId !== id) {
                  setShowConflictDialog(true);
                } else {
                  setShowGymSelector(true);
                }
              }}
              className="w-full py-3 rounded-xl bg-action text-white font-semibold hover:bg-action/90 transition-colors disabled:opacity-40"
            >
              {t('custom_plan.title_required_save')}
            </button>
          </motion.div>
        </div>
      )}

      {/* Catalog swap picker + exercise detail (shared with the workout player) */}
      <ExerciseSwapSheet
        options={swapOptions}
        onPick={(c) => { if (swapRow) applyRowSwap(swapRow, c); }}
        onClose={() => { setSwapOptions(null); setSwapRow(null); }}
        onShowInfo={setSwapInfoId}
      />
      <ExerciseInfoSheet exerciseId={swapInfoId} onClose={() => setSwapInfoId(null)} />
    </>
  );
};

export default CustomPlanDetail;
