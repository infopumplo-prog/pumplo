/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, Trash2, Search, X, Info, GripVertical, Play, SlidersHorizontal, Check, Copy, ChevronDown, Share2, Link, AlertTriangle, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useCustomPlanDetail, CustomPlanExercise } from '@/hooks/useCustomPlans';
import { usePausedCustomWorkout } from '@/hooks/usePausedCustomWorkout';
import { useUserProfile } from '@/hooks/useUserProfile';
import { supabase } from '@/integrations/supabase/client';
import { GymLocationGate } from '@/components/workout/GymLocationGate';
import { GymSelector } from '@/components/workout/GymSelector';
import { checkCustomPlanEquipment, IncompatibleExercise, AlternativeExercise } from '@/lib/gymEquipmentCheck';
import { useToast } from '@/hooks/use-toast';
import PageTransition from '@/components/PageTransition';
import { cn } from '@/lib/utils';
import { TRAINING_ROLE_NAMES } from '@/lib/trainingRoles';
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
  category: string;
  primary_muscles: string[];
  secondary_muscles: string[];
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
     full_body: t('category.full_body'), abdominals: t('category.abdominals') }[key] ?? key);

const getEquipmentLabel = (key: string, t: (k: string) => string): string =>
  ({ bodyweight: t('equipment.bodyweight'), barbell: t('equipment.barbell'), dumbbell: t('equipment.dumbbell'),
     kettlebell: t('equipment.kettlebell'), machine: t('equipment.machine'), cable: t('equipment.cable'),
     plate_loaded: t('equipment.plate_loaded'), other: t('equipment.other') }[key] ?? key);

// --- Per-set row input (local state, saves on blur) ---
const SetRowInput = ({ index, reps, weight, rest, isCardio, onRepsChange, onWeightChange, onRestChange }: {
  index: number; reps: number; weight: number | null; rest: number;
  isCardio: boolean;
  onRepsChange: (v: number) => void; onWeightChange: (v: number | null) => void; onRestChange: (v: number) => void;
}) => {
  const { t } = useTranslation();
  const [r, setR] = useState(String(reps));
  const [w, setW] = useState(weight != null ? String(weight) : '');
  const [restVal, setRestVal] = useState(String(rest));
  const [cardioMin, setCardioMin] = useState(String(Math.floor(reps / 60)));
  const [cardioSec, setCardioSec] = useState(String(reps % 60));

  const saveCardio = (mStr: string, sStr: string) => {
    const m = Math.max(0, parseInt(mStr) || 0);
    const s = Math.max(0, Math.min(59, parseInt(sStr) || 0));
    const total = m * 60 + s;
    // Sync local state to exactly what gets stored (no hidden rounding surprises)
    setCardioMin(String(m));
    setCardioSec(String(s));
    onRepsChange(total);
  };

  return (
    <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5 flex-wrap">
      <span className="text-xs font-medium text-muted-foreground w-6 shrink-0">S{index + 1}</span>
      {isCardio ? (
        <>
          <div className="flex items-center gap-1">
            <input type="number" value={cardioMin} onChange={(e) => setCardioMin(e.target.value)}
              onBlur={() => saveCardio(cardioMin, cardioSec)}
              className="w-12 bg-background rounded-md px-2 py-1 text-xs text-center outline-none" min={0} />
            <span className="text-[10px] text-muted-foreground">min</span>
          </div>
          <div className="flex items-center gap-1">
            <input type="number" value={cardioSec} onChange={(e) => setCardioSec(e.target.value)}
              onBlur={() => saveCardio(cardioMin, cardioSec)}
              className="w-12 bg-background rounded-md px-2 py-1 text-xs text-center outline-none" min={0} max={59} />
            <span className="text-[10px] text-muted-foreground">sek</span>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-1">
            <label className="text-xs text-muted-foreground">{t('custom_plan.opak_label')}</label>
            <input type="number" value={r} onChange={(e) => setR(e.target.value)}
              onBlur={() => { const v = Math.max(1, parseInt(r) || 1); setR(String(v)); onRepsChange(v); }}
              className="w-12 bg-background rounded-md px-2 py-1 text-xs text-center outline-none" min={1} />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-xs text-muted-foreground">kg:</label>
            <input type="number" value={w} onChange={(e) => setW(e.target.value)}
              onBlur={() => { const v = w ? parseFloat(w) : null; onWeightChange(v); }}
              placeholder="–" className="w-14 bg-background rounded-md px-2 py-1 text-xs text-center outline-none" min={0} step={0.5} />
          </div>
        </>
      )}
      <div className="flex items-center gap-1">
        <label className="text-xs text-muted-foreground">{t('custom_plan.pause_label')}</label>
        <input type="number" value={restVal} onChange={(e) => setRestVal(e.target.value)}
          onBlur={() => { const v = Math.max(10, parseInt(restVal) || 120); setRestVal(String(v)); onRestChange(v); }}
          className="w-12 bg-background rounded-md px-2 py-1 text-xs text-center outline-none" min={10} step={5} />
        <span className="text-[10px] text-muted-foreground">s</span>
      </div>
    </div>
  );
};

// --- Sortable Exercise Item ---
interface SortableExerciseProps {
  exercise: CustomPlanExercise;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (id: string, updates: Record<string, any>) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onShowDetail: (exerciseId: string) => void;
  isIncompatible?: boolean;
  alternatives?: AlternativeExercise[];
  onSwapExercise?: (oldExerciseId: string, newExercise: AlternativeExercise) => void;
}

const SortableExerciseItem = ({ exercise, isExpanded, onToggleExpand, onUpdate, onRemove, onDuplicate, onShowDetail, isIncompatible, alternatives, onSwapExercise }: SortableExerciseProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: exercise.id });
  const { t } = useTranslation();
  const [setsInput, setSetsInput] = useState(String(exercise.sets));

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isCardio = exercise.unit_type === 'time_min' || exercise.category === 'cardio';
  const formatDuration = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return s > 0 ? `${m}min ${s}s` : `${m} min`;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "py-2 border-b border-border/50 last:border-0 bg-card",
        isDragging && "opacity-50 shadow-lg rounded-xl z-50",
        isIncompatible && "bg-destructive/5 border-l-2 border-l-destructive"
      )}
    >
      <div className="flex items-center gap-2">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="p-1 text-muted-foreground/40 hover:text-muted-foreground touch-none shrink-0"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-0">
          {/* Clickable exercise name -> opens detail */}
          <button
            onClick={() => onShowDetail(exercise.exercise_id)}
            className={cn(
              "text-sm font-medium truncate text-left transition-colors block w-full",
              isIncompatible ? "text-destructive hover:text-destructive/80" : "hover:text-[#5BC8F5]"
            )}
          >
            {isIncompatible && <AlertTriangle className="w-3.5 h-3.5 inline mr-1 mb-0.5" />}
            {exercise.exercise_name || t('custom_plan.exercise_unknown')}
          </button>
          <div className="flex items-center gap-3 mt-1">
            <button
              onClick={onToggleExpand}
              className={cn(
                "flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors",
              )}
            >
              <span>{t('custom_plan.sets_count', { n: exercise.sets })}</span>
              <ChevronDown className={cn("w-3 h-3 transition-transform", isExpanded && "rotate-180")} />
            </button>
            {!isExpanded && (
              isCardio ? (
                <span className="text-xs text-muted-foreground">{formatDuration(exercise.reps)}</span>
              ) : (
                <>
                  <span className="text-xs text-muted-foreground">{exercise.reps} {t('custom_plan.reps_label')}</span>
                  <span className="text-xs text-muted-foreground">{exercise.weight_kg != null ? `${exercise.weight_kg} kg` : '–'}</span>
                </>
              )
            )}
          </div>
        </div>

        {/* Action buttons */}
        <button
          onClick={() => onDuplicate(exercise.id)}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-[#5BC8F5] hover:bg-[#5BC8F5]/10 transition-colors shrink-0"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onRemove(exercise.id)}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Expandable per-set rows */}
      {isExpanded && (
        <div className="ml-7 mt-2 space-y-1.5">
          {/* Sets count control */}
          <div className="flex items-center gap-2 mb-2">
            <label className="text-xs text-muted-foreground">{t('custom_plan.sets_label')}</label>
            <input
              type="number"
              value={setsInput}
              onChange={(e) => {
                setSetsInput(e.target.value);
                const parsed = parseInt(e.target.value);
                if (parsed >= 1) onUpdate(exercise.id, { sets: parsed });
              }}
              onBlur={() => {
                const val = Math.max(1, parseInt(setsInput) || 1);
                setSetsInput(String(val));
                onUpdate(exercise.id, { sets: val });
              }}
              className="w-14 bg-muted rounded-lg px-2 py-1 text-xs text-center outline-none"
              min={1}
            />
          </div>
          {/* Individual set rows — per-set reps, weight, rest */}
          {Array.from({ length: exercise.sets }, (_, i) => {
            const repsArr = exercise.reps_per_set || [];
            const weightArr = exercise.weight_per_set || [];
            const restArr = exercise.rest_per_set || [];
            const setReps = repsArr[i] ?? exercise.reps;
            const setWeight = weightArr[i] ?? exercise.weight_kg;
            const setRest = restArr[i] ?? exercise.rest_seconds ?? 120;
            return (
              <SetRowInput
                key={i}
                index={i}
                reps={setReps}
                weight={setWeight}
                rest={setRest}
                isCardio={isCardio}
                onRepsChange={(val) => {
                  const arr = [...(exercise.reps_per_set || Array(exercise.sets).fill(exercise.reps))];
                  arr[i] = val;
                  const updates: Record<string, any> = { reps_per_set: arr };
                  if (isCardio) updates.reps = val;
                  onUpdate(exercise.id, updates);
                }}
                onWeightChange={(val) => {
                  const arr = [...(exercise.weight_per_set || Array(exercise.sets).fill(exercise.weight_kg))];
                  arr[i] = val;
                  onUpdate(exercise.id, { weight_per_set: arr });
                }}
                onRestChange={(val) => {
                  const arr = [...(exercise.rest_per_set || Array(exercise.sets).fill(exercise.rest_seconds || 120))];
                  arr[i] = val;
                  onUpdate(exercise.id, { rest_per_set: arr });
                }}
              />
            );
          })}
        </div>
      )}

      {/* Incompatible alternatives */}
      {isIncompatible && alternatives && alternatives.length > 0 && (
        <div className="ml-7 mt-2 mb-1">
          <p className="text-xs text-destructive font-medium mb-1.5">{t('custom_plan.incompatible_alternatives')}</p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {alternatives.map(alt => (
              <button
                key={alt.id}
                onClick={() => onSwapExercise?.(exercise.exercise_id, alt)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
              >
                <ArrowRightLeft className="w-3 h-3 shrink-0" />
                <span className="max-w-[120px] truncate">{alt.name}</span>
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
  const { t } = useTranslation();
  const { toast } = useToast();
  const { profile } = useUserProfile();
  const {
    plan, isLoading, addDay, removeDay, renameDay,
    addExercise, updateExercise, removeExercise, renamePlan, reorderExercises, duplicateExercise,
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
        setPendingWorkoutPath(`/custom-workout/${id}`);
        setShowLocationGate(true);
      } else {
        navigate(`/custom-workout/${id}`);
      }
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

      const { data: gymData } = await supabase
        .from('gyms')
        .select('latitude, longitude')
        .eq('id', selectedWorkoutGymId)
        .single();

      if (gymData?.latitude != null && gymData?.longitude != null) {
        setLocationGymLat(gymData.latitude);
        setLocationGymLng(gymData.longitude);
        setPendingWorkoutPath(`/custom-workout/${id}`);
        setShowLocationGate(true);
      } else {
        navigate(`/custom-workout/${id}`);
      }
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
          await updateExercise(ex.id, { exercise_id: alt.id, exercise_name: alt.name });
        }
      }
    }
    // Re-run equipment check
    if (selectedWorkoutGymId) {
      const incompatible = await checkCustomPlanEquipment(id, selectedWorkoutGymId);
      setIncompatibleExercises(incompatible);
    }
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
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
  const [viewExerciseDrawerOpen, setViewExerciseDrawerOpen] = useState(false);
  const [viewExerciseData, setViewExerciseData] = useState<ExerciseSearchResult | null>(null);
  const [viewVideoError, setViewVideoError] = useState(false);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const { pausedWorkout: pausedCustomWorkout, clearPausedWorkout: clearPausedCustomWorkout } = usePausedCustomWorkout();

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
      .select('id, name, category, primary_muscles, secondary_muscles, equipment_type, video_path, slot_type, primary_role, machine_id, machines!exercises_machine_id_fkey(name)')
      .order('name', { ascending: true });
    const exercises = (data || []).map((e: any) => ({
      ...e,
      machine_name: e.machines?.name || null,
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

  const handleShare = async () => {
    if (!plan) return;
    setIsSharing(true);
    let token = plan.share_token;
    if (!plan.is_public || !token) {
      token = await sharePlan() ?? token;
    }
    if (token) {
      const url = `${window.location.origin}/plan/${token}`;
      try {
        if (navigator.share) {
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
      .select('id, name, category, primary_muscles, secondary_muscles, equipment_type, video_path, slot_type, primary_role, machine_id, machines!exercises_machine_id_fkey(name)')
      .eq('id', exerciseId)
      .single();
    if (data) {
      setViewExerciseData({
        ...data,
        machine_name: (data as any).machines?.name || null,
      } as ExerciseSearchResult);
    }
  }, []);

  useEffect(() => {
    if (exerciseDrawerOpen && allExercises.length === 0) {
      loadAllExercises();
    }
  }, [exerciseDrawerOpen, allExercises.length, loadAllExercises]);

  // Check if plan has any exercises to enable start button
  const hasExercises = plan?.days.some(d => d.exercises.length > 0) ?? false;

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
              {/* Day Header */}
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

              {/* Exercises with drag & drop */}
              <div className="px-4 py-2">
                {day.exercises.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-3 text-center">{t('custom_plan.no_exercises')}</p>
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
                            isExpanded={expandedExerciseId === exercise.id}
                            onToggleExpand={() => setExpandedExerciseId(prev => prev === exercise.id ? null : exercise.id)}
                            onUpdate={updateExercise}
                            onRemove={removeExercise}
                            onDuplicate={duplicateExercise}
                            onShowDetail={handleShowExerciseDetail}
                            isIncompatible={!!incompatInfo}
                            alternatives={incompatInfo?.alternatives}
                            onSwapExercise={handleSwapExercise}
                          />
                        );
                      })}
                    </SortableContext>
                  </DndContext>
                )}

                <button
                  onClick={() => { setActiveDayId(day.id); setExerciseDrawerOpen(true); }}
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



        {/* Exercise Search Drawer */}
        <Drawer open={exerciseDrawerOpen} onOpenChange={(open) => { setExerciseDrawerOpen(open); if (!open) resetSearch(); }}>
          <DrawerContent className="flex flex-col" style={{ height: drawerHeight, maxHeight: drawerHeight, bottom: drawerBottom }}>
            <DrawerHeader className="shrink-0 pb-2">
              <DrawerTitle>{t('custom_plan.select_exercise')}</DrawerTitle>
            </DrawerHeader>

            {detailExercise ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto px-4 pb-4">
                  <button
                    onClick={() => { setDetailExercise(null); setVideoError(false); }}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4 hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    {t('custom_plan.back_to_list')}
                  </button>

                  {detailExercise.video_path ? (
                    <div className="rounded-2xl overflow-hidden bg-black mb-4 aspect-video">
                      {videoError ? (
                        <div className="w-full h-full flex items-center justify-center text-white/50 text-sm">{t('custom_plan.video_loading')}</div>
                      ) : (
                        <video
                          key={detailExercise.video_path}
                          src={detailExercise.video_path}
                          playsInline autoPlay loop muted preload="auto"
                          className="w-full h-full object-contain"
                          style={{ borderRadius: '12px', opacity: 0, transition: 'opacity 0.3s' }}
                          onCanPlay={(e) => { (e.target as HTMLVideoElement).style.opacity = '1'; }}
                          onError={() => setVideoError(true)}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-muted mb-4 aspect-video flex items-center justify-center">
                      <p className="text-sm text-muted-foreground">{t('custom_plan.no_video')}</p>
                    </div>
                  )}

                  <h3 className="text-xl font-bold mb-1">{detailExercise.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {getCategoryLabel(detailExercise.category, t)}
                    {detailExercise.equipment_type && ` · ${getEquipmentLabel(detailExercise.equipment_type, t)}`}
                  </p>

                  {detailExercise.primary_muscles?.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">{t('custom_plan.primary_muscles')}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {detailExercise.primary_muscles.map((m) => (
                          <span key={m} className="text-xs bg-[#5BC8F5]/15 text-[#5BC8F5] px-2.5 py-1 rounded-full font-medium">{m}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {detailExercise.secondary_muscles?.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">{t('custom_plan.secondary_muscles')}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {detailExercise.secondary_muscles.map((m) => (
                          <span key={m} className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full">{m}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="shrink-0 px-4 pb-6 pt-3 border-t border-border">
                  <Button
                    onClick={() => handleAddExercise(detailExercise)}
                    className="w-full h-12 rounded-xl gap-2 text-base font-semibold bg-[#5BC8F5] hover:bg-[#3AAED8] text-white"
                  >
                    <Plus className="w-5 h-5" />
                    {t('custom_plan.add_to_workout')}
                  </Button>
                </div>
              </div>
            ) : filterPanelOpen ? (
              /* ---- Filter Panel ---- */
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto px-4 pb-6">
                  {/* Machine search */}
                  <div className="mb-5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('custom_plan.machine_search')}</p>
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder={t('custom_plan.machine_placeholder')}
                        value={machineSearch}
                        onChange={(e) => setMachineSearch(e.target.value)}
                        className="w-full bg-muted rounded-xl pl-10 pr-10 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      {machineSearch && (
                        <button onClick={() => setMachineSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                          <X className="w-4 h-4 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                    {machineSearch.trim().length > 0 && (() => {
                      const list = filterMachinesByQuery(uniqueMachineNames, machineSearch);
                      if (list.length === 0) return <p className="text-xs text-muted-foreground mt-1">{t('custom_plan.no_machine')}</p>;
                      return (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {list.map((machine) => (
                            <button
                              key={machine}
                              onClick={() => setMachineSearch(machineSearch === machine ? '' : machine)}
                              className={cn(
                                "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border",
                                machineSearch === machine
                                  ? "bg-[#5BC8F5] text-white border-[#5BC8F5]"
                                  : "bg-card border-border text-foreground hover:border-[#5BC8F5]/50"
                              )}
                            >
                              {machine}
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Equipment type */}
                  <div className="mb-5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('custom_plan.equipment_type')}</p>
                    <div className="flex flex-wrap gap-2">
                      {EQUIPMENT_FILTERS.map((f) => (
                        <button
                          key={f.key}
                          onClick={() => toggleFilter(selectedEquipment, setSelectedEquipment, f.key)}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors border",
                            selectedEquipment.has(f.key)
                              ? "bg-[#5BC8F5] text-white border-[#5BC8F5]"
                              : "bg-card border-border text-foreground"
                          )}
                        >
                          {selectedEquipment.has(f.key) && <Check className="w-3.5 h-3.5" />}
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Muscles */}
                  <div className="mb-5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('custom_plan.muscle_groups')}</p>
                    <div className="flex flex-wrap gap-2">
                      {MUSCLE_FILTERS.map((f) => (
                        <button
                          key={f.key}
                          onClick={() => toggleFilter(selectedMuscles, setSelectedMuscles, f.key)}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors border",
                            selectedMuscles.has(f.key)
                              ? "bg-[#5BC8F5] text-white border-[#5BC8F5]"
                              : "bg-card border-border text-foreground"
                          )}
                        >
                          {selectedMuscles.has(f.key) && <Check className="w-3.5 h-3.5" />}
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Slot type (designation) */}
                  <div className="mb-5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('custom_plan.slot_type')}</p>
                    <div className="flex flex-wrap gap-2">
                      {SLOT_TYPE_FILTERS.map((f) => (
                        <button
                          key={f.key}
                          onClick={() => toggleFilter(selectedSlotTypes, setSelectedSlotTypes, f.key)}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors border",
                            selectedSlotTypes.has(f.key)
                              ? "bg-[#5BC8F5] text-white border-[#5BC8F5]"
                              : "bg-card border-border text-foreground"
                          )}
                        >
                          {selectedSlotTypes.has(f.key) && <Check className="w-3.5 h-3.5" />}
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Primary role */}
                  <div className="mb-5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('custom_plan.exercise_role')}</p>
                    {ROLE_FILTER_GROUPS.map((group) => (
                      <div key={group.label} className="mb-3">
                        <p className="text-xs text-muted-foreground mb-1.5">{group.label}</p>
                        <div className="flex flex-wrap gap-2">
                          {group.roles.map((r) => (
                            <button
                              key={r.key}
                              onClick={() => toggleFilter(selectedRoles, setSelectedRoles, r.key)}
                              className={cn(
                                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors border",
                                selectedRoles.has(r.key)
                                  ? "bg-[#5BC8F5] text-white border-[#5BC8F5]"
                                  : "bg-card border-border text-foreground"
                              )}
                            >
                              {selectedRoles.has(r.key) && <Check className="w-3.5 h-3.5" />}
                              {r.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Filter panel bottom buttons */}
                <div className="shrink-0 px-4 pb-6 pt-3 border-t border-border flex gap-3">
                  {activeFilterCount > 0 && (
                    <Button
                      variant="outline"
                      onClick={() => { clearAllFilters(); applyFilters(searchQuery, new Set(), new Set(), new Set(), new Set(), ''); setFilterPanelOpen(false); }}
                      className="h-12 rounded-xl px-6"
                    >
                      {t('custom_plan.clear_filters')}
                    </Button>
                  )}
                  <Button
                    onClick={applyAndCloseFilters}
                    className="flex-1 h-12 rounded-xl gap-2 text-base font-semibold bg-[#1A2744] hover:bg-[#1A2744]/90 text-white"
                  >
                    {t('custom_plan.show_results')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden px-4">
                {/* Search + Filter button */}
                <div className="shrink-0 flex gap-2 mb-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text" placeholder={t('custom_plan.search_exercise')} value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="w-full bg-muted rounded-xl pl-10 pr-10 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    {searchQuery && (
                      <button onClick={() => { setSearchQuery(''); applyFilters('', selectedMuscles, selectedEquipment, selectedSlotTypes, selectedRoles, machineSearch); }} className="absolute right-3 top-1/2 -translate-y-1/2">
                        <X className="w-4 h-4 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => setFilterPanelOpen(true)}
                    className={cn(
                      "shrink-0 flex items-center gap-1.5 px-3 py-3 rounded-xl text-sm font-medium transition-colors",
                      activeFilterCount > 0
                        ? "bg-[#5BC8F5] text-white"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    {activeFilterCount > 0 && <span className="text-xs font-bold">{activeFilterCount}</span>}
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto -mx-4 px-4 pb-6 overscroll-contain">
                  {loadingExercises && <div className="text-center py-8 text-sm text-muted-foreground">{t('custom_plan.loading_exercises')}</div>}
                  {!loadingExercises && filteredExercises.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">{t('custom_plan.no_results')}</div>}
                  <div className="space-y-0.5">
                    {filteredExercises.map((exercise) => (
                      <div key={exercise.id} className="flex items-center rounded-xl hover:bg-muted transition-colors">
                        <button onClick={() => handleAddExercise(exercise)} className="flex-1 text-left px-4 py-3 min-w-0">
                          <p className="text-sm font-medium truncate">{exercise.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {getCategoryLabel(exercise.category, t)}
                            {exercise.primary_muscles?.length > 0 && ` · ${exercise.primary_muscles.join(', ')}`}
                          </p>
                        </button>
                        <button onClick={() => { setDetailExercise(exercise); setVideoError(false); }} className="shrink-0 p-3 text-muted-foreground hover:text-[#5BC8F5] transition-colors">
                          <Info className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </DrawerContent>
        </Drawer>

        {/* Exercise Detail View Drawer (from plan) */}
        <Drawer open={viewExerciseDrawerOpen} onOpenChange={(open) => { setViewExerciseDrawerOpen(open); if (!open) { setViewExerciseData(null); setViewVideoError(false); } }}>
          <DrawerContent className="flex flex-col" style={{ height: '85dvh', maxHeight: '85dvh' }}>
            <DrawerHeader className="shrink-0 pb-2">
              <DrawerTitle>{viewExerciseData?.name || t('custom_plan.exercise_detail')}</DrawerTitle>
            </DrawerHeader>

            {viewExerciseData ? (
              <div className="flex-1 overflow-y-auto px-4 pb-6">
                {viewExerciseData.video_path ? (
                  <div className="rounded-2xl overflow-hidden bg-black mb-4 aspect-video">
                    {viewVideoError ? (
                      <div className="w-full h-full flex items-center justify-center text-white/50 text-sm">{t('custom_plan.video_unavailable')}</div>
                    ) : (
                      <video
                        key={viewExerciseData.video_path}
                        src={viewExerciseData.video_path}
                        playsInline autoPlay loop muted preload="auto"
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

                <p className="text-sm text-muted-foreground mb-4">
                  {getCategoryLabel(viewExerciseData.category, t)}
                  {viewExerciseData.equipment_type && ` · ${getEquipmentLabel(viewExerciseData.equipment_type, t)}`}
                  {viewExerciseData.machine_name && ` · ${viewExerciseData.machine_name}`}
                </p>

                {viewExerciseData.primary_muscles?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">{t('custom_plan.primary_muscles')}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {viewExerciseData.primary_muscles.map((m) => (
                        <span key={m} className="text-xs bg-[#5BC8F5]/15 text-[#5BC8F5] px-2.5 py-1 rounded-full font-medium">{m}</span>
                      ))}
                    </div>
                  </div>
                )}
                {viewExerciseData.secondary_muscles?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">{t('custom_plan.secondary_muscles')}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {viewExerciseData.secondary_muscles.map((m) => (
                        <span key={m} className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full">{m}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">{t('custom_plan.loading')}</p>
              </div>
            )}
          </DrawerContent>
        </Drawer>
      </div>

    </PageTransition>

      {/* Equipment incompatibility banner */}
      {incompatibleExercises.length > 0 && (
        <div className="fixed left-0 right-0 px-4 z-[52]" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}>
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
              <p className="text-sm text-destructive font-medium">
                {t('custom_plan.incompatible_count', { count: incompatibleExercises.length, gym: locationGymName })}
              </p>
            </div>
            <button
              onClick={handleRetryAfterFix}
              disabled={isCheckingEquipment}
              className="text-xs font-semibold text-primary shrink-0"
            >
              {isCheckingEquipment ? '...' : t('custom_plan.check_equipment')}
            </button>
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
                if (pausedCustomWorkout && pausedCustomWorkout.planId !== id) {
                  setShowConflictDialog(true);
                } else {
                  setShowGymSelector(true);
                }
              }}
              className="w-full h-16 rounded-2xl gap-3 text-lg font-bold bg-[#1A2744] hover:bg-[#1A2744]/90 text-white shadow-lg shadow-[#1A2744]/25"
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

      {showGymSelector && (
        <GymSelector
          onSelect={handleGymSelected}
          onCancel={() => setShowGymSelector(false)}
          selectedGymId={selectedWorkoutGymId || profile?.selected_gym_id}
        />
      )}

      {showLocationGate && locationGymLat !== null && locationGymLng !== null && (
        <GymLocationGate
          gymLat={locationGymLat}
          gymLng={locationGymLng}
          gymName={locationGymName}
          onConfirmed={() => {
            setShowLocationGate(false);
            if (pendingWorkoutPath) navigate(pendingWorkoutPath);
          }}
          onCancel={() => setShowLocationGate(false)}
        />
      )}
    </>
  );
};

export default CustomPlanDetail;
