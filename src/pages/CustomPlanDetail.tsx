import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, Trash2, Search, X, Info, GripVertical, Play, SlidersHorizontal, Check, Copy, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useCustomPlanDetail, CustomPlanExercise } from '@/hooks/useCustomPlans';
import { usePausedCustomWorkout } from '@/hooks/usePausedCustomWorkout';
import { supabase } from '@/integrations/supabase/client';
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

// Muscle filters - matching actual Czech primary_muscles values from DB
const MUSCLE_FILTERS = [
  { key: 'back', label: 'Záda', match: ['záda', 'zad', 'laty', 'lopatky', 'trapéz', 'pilovitý'] },
  { key: 'chest', label: 'Prsa', match: ['prsa', 'prsní'] },
  { key: 'legs', label: 'Nohy', match: ['nohy', 'kvadriceps', 'dolní konč', 'lýtka', 'hamstring'] },
  { key: 'shoulders', label: 'Ramena', match: ['ramena'] },
  { key: 'biceps', label: 'Biceps', match: ['biceps'] },
  { key: 'triceps', label: 'Triceps', match: ['triceps'] },
  { key: 'glutes', label: 'Zadek', match: ['zadek'] },
  { key: 'core', label: 'Core', match: ['břišní', 'břicho', 'střed těla', 'bedra'] },
] as const;

// Equipment: actual DB values are machine, free_weight, bodyweight, other
const EQUIPMENT_FILTERS = [
  { key: 'machine', label: 'Stroj' },
  { key: 'free_weight', label: 'Volné závaží' },
  { key: 'bodyweight', label: 'Vlastní váha' },
] as const;

// Slot type: actual DB values are main, secondary, accessory, core
const SLOT_TYPE_FILTERS = [
  { key: 'main', label: 'Hlavní' },
  { key: 'secondary', label: 'Pomocný' },
  { key: 'accessory', label: 'Doplňkový' },
  { key: 'core', label: 'Core' },
] as const;

// Role filters grouped - keys match actual primary_role values in DB
const ROLE_FILTER_GROUPS = [
  {
    label: 'Horní tělo',
    roles: [
      { key: 'horizontal_push', label: 'Tlak na prsa' },
      { key: 'horizontal_pull', label: 'Tah zad' },
      { key: 'vertical_push', label: 'Tlak nad hlavu' },
      { key: 'vertical_pull', label: 'Stahování' },
      { key: 'elbow_flexion', label: 'Biceps' },
      { key: 'elbow_extension', label: 'Triceps' },
      { key: 'shoulder_abduction', label: 'Abdukce ramena' },
      { key: 'shoulder_adduction', label: 'Addukce ramena' },
      { key: 'rear_delt_isolation', label: 'Zadní ramena' },
      { key: 'upper_back_isolation', label: 'Horní záda' },
    ],
  },
  {
    label: 'Dolní tělo',
    roles: [
      { key: 'squat', label: 'Dřepy' },
      { key: 'hinge', label: 'Mrtvý tah' },
      { key: 'lunge', label: 'Výpady' },
      { key: 'step', label: 'Krok' },
      { key: 'jump', label: 'Skok' },
      { key: 'full_body_pull', label: 'Celotělový tah' },
    ],
  },
  {
    label: 'Core',
    roles: [
      { key: 'anti_extension', label: 'Anti-extenze' },
      { key: 'rotation', label: 'Rotace trupu' },
    ],
  },
] as const;

const categoryLabels: Record<string, string> = {
  chest: 'Hrudník', back: 'Záda', shoulders: 'Ramena', arms: 'Paže',
  legs: 'Nohy', core: 'Střed těla', cardio: 'Kardio',
  full_body: 'Celé tělo', abdominals: 'Břicho',
};

const equipmentLabels: Record<string, string> = {
  bodyweight: 'Vlastní váha', barbell: 'Činka', dumbbell: 'Jednoručky',
  kettlebell: 'Kettlebell', machine: 'Stroj', cable: 'Kladka',
  plate_loaded: 'Kotouče', other: 'Jiné',
};

// --- Sortable Exercise Item ---
interface SortableExerciseProps {
  exercise: CustomPlanExercise;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (id: string, updates: { sets?: number; reps?: number; weight_kg?: number | null }) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onShowDetail: (exerciseId: string) => void;
}

const SortableExerciseItem = ({ exercise, isExpanded, onToggleExpand, onUpdate, onRemove, onDuplicate, onShowDetail }: SortableExerciseProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: exercise.id });
  const [setsInput, setSetsInput] = useState(String(exercise.sets));
  const [repsInput, setRepsInput] = useState(String(exercise.reps));
  const [restInput, setRestInput] = useState(String((exercise as any).rest_seconds || 120));

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "py-2 border-b border-border/50 last:border-0 bg-card",
        isDragging && "opacity-50 shadow-lg rounded-xl z-50"
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
            className="text-sm font-medium truncate text-left hover:text-[#5BC8F5] transition-colors block w-full"
          >
            {exercise.exercise_name || 'Neznámý cvik'}
          </button>
          <div className="flex items-center gap-3 mt-1">
            <button
              onClick={onToggleExpand}
              className={cn(
                "flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors",
              )}
            >
              <span>{exercise.sets} sérií</span>
              <ChevronDown className={cn("w-3 h-3 transition-transform", isExpanded && "rotate-180")} />
            </button>
            {!isExpanded && (
              <>
                <span className="text-xs text-muted-foreground">{exercise.reps} opak.</span>
                <span className="text-xs text-muted-foreground">{exercise.weight_kg != null ? `${exercise.weight_kg} kg` : '–'}</span>
              </>
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
            <label className="text-xs text-muted-foreground">Počet sérií:</label>
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
          {/* Individual set rows */}
          {Array.from({ length: exercise.sets }, (_, i) => (
            <div key={i} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5">
              <span className="text-xs font-medium text-muted-foreground w-6 shrink-0">S{i + 1}</span>
              <div className="flex items-center gap-1">
                <label className="text-xs text-muted-foreground">Opak:</label>
                <input
                  type="number"
                  value={repsInput}
                  onChange={(e) => {
                    setRepsInput(e.target.value);
                    const parsed = parseInt(e.target.value);
                    if (parsed >= 1) onUpdate(exercise.id, { reps: parsed });
                  }}
                  onBlur={() => {
                    const val = Math.max(1, parseInt(repsInput) || 1);
                    setRepsInput(String(val));
                    onUpdate(exercise.id, { reps: val });
                  }}
                  className="w-12 bg-background rounded-md px-2 py-1 text-xs text-center outline-none"
                  min={1}
                />
              </div>
              <div className="flex items-center gap-1">
                <label className="text-xs text-muted-foreground">kg:</label>
                <input
                  type="number"
                  value={exercise.weight_kg ?? ''}
                  onChange={(e) => onUpdate(exercise.id, { weight_kg: e.target.value ? parseFloat(e.target.value) : null })}
                  placeholder="–"
                  className="w-14 bg-background rounded-md px-2 py-1 text-xs text-center outline-none"
                  min={0}
                  step={0.5}
                />
              </div>
            </div>
          ))}

          {/* Rest duration per exercise - same style as reps/kg */}
          <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5">
            <div className="flex items-center gap-1">
              <label className="text-xs text-muted-foreground">Pauza (s):</label>
              <input
                type="number"
                value={restInput}
                onChange={(e) => setRestInput(e.target.value)}
                onBlur={() => {
                  const val = Math.max(10, parseInt(restInput) || 120);
                  setRestInput(String(val));
                  onUpdate(exercise.id, { rest_seconds: val } as any);
                }}
                className="w-16 bg-background rounded-md px-2 py-1 text-xs text-center outline-none"
                min={10}
                step={5}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Main Component ---
const CustomPlanDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    plan, isLoading, addDay, removeDay, renameDay,
    addExercise, updateExercise, removeExercise, renamePlan, reorderExercises, duplicateExercise,
  } = useCustomPlanDetail(id || null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const [editingPlanName, setEditingPlanName] = useState(false);
  const [planNameValue, setPlanNameValue] = useState('');
  const [restDuration, setRestDuration] = useState(120);
  const [editingDayId, setEditingDayId] = useState<string | null>(null);
  const [editingDayName, setEditingDayName] = useState('');
  const [exerciseDrawerOpen, setExerciseDrawerOpen] = useState(false);
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

  // Load rest duration from DB
  useEffect(() => {
    if (!id) return;
    supabase.from('custom_plans').select('rest_duration_seconds').eq('id', id).single()
      .then(({ data }) => { if (data?.rest_duration_seconds) setRestDuration(data.rest_duration_seconds); });
  }, [id]);

  const updateRestDuration = async (seconds: number) => {
    setRestDuration(seconds);
    if (id) {
      await supabase.from('custom_plans').update({ rest_duration_seconds: seconds }).eq('id', id);
    }
  };

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
      const q = query.toLowerCase();
      results = results.filter(e => e.name.toLowerCase().includes(q));
    }

    if (muscles.size > 0) {
      results = results.filter(e => {
        const allMuscleText = (e.primary_muscles || []).join(' ').toLowerCase();
        for (const muscleKey of muscles) {
          const filterDef = MUSCLE_FILTERS.find(f => f.key === muscleKey);
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
      const mq = machineQ.toLowerCase();
      results = results.filter(e =>
        (e.machine_name && e.machine_name.toLowerCase().includes(mq)) ||
        e.name.toLowerCase().includes(mq)
      );
    }

    setFilteredExercises(results);
  }, [allExercises]);

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
        <div className="min-h-screen bg-background safe-top pb-24">
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
            <p className="text-muted-foreground mb-4">Plán nenalezen</p>
            <Button onClick={() => navigate('/')} variant="outline">Zpět</Button>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
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
                placeholder="Název mého tréninku"
              />
            ) : (
              <button
                onClick={() => { setEditingPlanName(true); setPlanNameValue(plan.name); }}
                className="text-2xl font-bold truncate hover:text-primary transition-colors text-left"
              >
                {plan.name}
              </button>
            )}
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
                    onClick={() => { setEditingDayId(day.id); setEditingDayName(day.name || `Den ${day.day_number}`); }}
                    className="text-sm font-semibold hover:text-primary transition-colors"
                  >
                    {day.name || `Den ${day.day_number}`}
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
                  <p className="text-sm text-muted-foreground py-3 text-center">Žádné cviky</p>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd(day.id)}
                  >
                    <SortableContext items={day.exercises.map(e => e.id)} strategy={verticalListSortingStrategy}>
                      {day.exercises.map((exercise) => (
                        <SortableExerciseItem
                          key={exercise.id}
                          exercise={exercise}
                          isExpanded={expandedExerciseId === exercise.id}
                          onToggleExpand={() => setExpandedExerciseId(prev => prev === exercise.id ? null : exercise.id)}
                          onUpdate={updateExercise}
                          onRemove={removeExercise}
                          onDuplicate={duplicateExercise}
                          onShowDetail={handleShowExerciseDetail}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                )}

                <button
                  onClick={() => { setActiveDayId(day.id); setExerciseDrawerOpen(true); }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 mt-1 text-sm text-primary hover:bg-primary/5 rounded-xl transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Přidat cvik
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
            Přidat den
          </Button>
        </div>

        {/* Fixed bottom: Start Workout Button */}
        {hasExercises && (
          <div className="fixed bottom-20 left-0 right-0 px-6 pb-4 pt-2 bg-gradient-to-t from-background via-background to-transparent">
            {pausedCustomWorkout && pausedCustomWorkout.planId === id ? (
              <Button
                onClick={() => navigate(`/custom-workout/${id}?resume=true`)}
                className="w-full h-16 rounded-2xl gap-3 text-lg font-bold bg-amber-500 hover:bg-amber-500/90 text-white shadow-lg shadow-amber-500/25"
              >
                <Play className="w-5 h-5" />
                Pokračovat v tréninku
              </Button>
            ) : (
              <Button
                onClick={() => {
                  if (pausedCustomWorkout && pausedCustomWorkout.planId !== id) {
                    setShowConflictDialog(true);
                  } else {
                    navigate(`/custom-workout/${id}`);
                  }
                }}
                className="w-full h-16 rounded-2xl gap-3 text-lg font-bold bg-[#1A2744] hover:bg-[#1A2744]/90 text-white shadow-lg shadow-[#1A2744]/25"
              >
                <Play className="w-5 h-5" />
                Spustit trénink
              </Button>
            )}
          </div>
        )}

        {/* Conflict dialog: paused workout for another plan */}
        {showConflictDialog && pausedCustomWorkout && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-black/50 backdrop-blur-sm" onClick={() => setShowConflictDialog(false)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-lg font-bold text-center mb-1">Pozastavený trénink</h2>
              <p className="text-muted-foreground text-sm text-center mb-5">
                Máš pozastavený trénink v plánu „{pausedCustomWorkout.planName}". Co chceš udělat?
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => {
                    setShowConflictDialog(false);
                    navigate(`/custom-workout/${pausedCustomWorkout.planId}?resume=true`);
                  }}
                  className="w-full py-3.5 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-500/90 transition-colors"
                >
                  Pokračovat v pozastaveném
                </button>
                <button
                  onClick={() => {
                    clearPausedCustomWorkout();
                    setShowConflictDialog(false);
                    navigate(`/custom-workout/${id}`);
                  }}
                  className="w-full py-3.5 rounded-xl bg-red-500/90 text-white font-semibold hover:bg-red-500 transition-colors"
                >
                  Ukončit a spustit nový
                </button>
                <button
                  onClick={() => setShowConflictDialog(false)}
                  className="w-full py-3.5 rounded-xl text-muted-foreground font-medium hover:text-foreground transition-colors"
                >
                  Zrušit
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Exercise Search Drawer */}
        <Drawer open={exerciseDrawerOpen} onOpenChange={(open) => { setExerciseDrawerOpen(open); if (!open) resetSearch(); }}>
          <DrawerContent className="flex flex-col" style={{ height: '100dvh', maxHeight: '100dvh' }}>
            <DrawerHeader className="shrink-0 pb-2">
              <DrawerTitle>Vybrat cvik</DrawerTitle>
            </DrawerHeader>

            {detailExercise ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto px-4 pb-4">
                  <button
                    onClick={() => { setDetailExercise(null); setVideoError(false); }}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4 hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Zpět na seznam
                  </button>

                  {detailExercise.video_path ? (
                    <div className="rounded-2xl overflow-hidden bg-black mb-4 aspect-video">
                      {videoError ? (
                        <div className="w-full h-full flex items-center justify-center text-white/50 text-sm">Video se načítá...</div>
                      ) : (
                        <video
                          key={detailExercise.video_path}
                          src={detailExercise.video_path}
                          controls
                          playsInline
                          autoPlay
                          loop
                          muted
                          preload="auto"
                          className="w-full h-full object-contain"
                          style={{ borderRadius: '12px' }}
                          onError={() => setVideoError(true)}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-muted mb-4 aspect-video flex items-center justify-center">
                      <p className="text-sm text-muted-foreground">Bez videa</p>
                    </div>
                  )}

                  <h3 className="text-xl font-bold mb-1">{detailExercise.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {categoryLabels[detailExercise.category] || detailExercise.category}
                    {detailExercise.equipment_type && ` · ${equipmentLabels[detailExercise.equipment_type] || detailExercise.equipment_type}`}
                  </p>

                  {detailExercise.primary_muscles?.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">Primární svaly</p>
                      <div className="flex flex-wrap gap-1.5">
                        {detailExercise.primary_muscles.map((m) => (
                          <span key={m} className="text-xs bg-[#5BC8F5]/15 text-[#5BC8F5] px-2.5 py-1 rounded-full font-medium">{m}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {detailExercise.secondary_muscles?.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">Sekundární svaly</p>
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
                    Přidat do tréninku
                  </Button>
                </div>
              </div>
            ) : filterPanelOpen ? (
              /* ---- Filter Panel ---- */
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto px-4 pb-6">
                  {/* Machine search */}
                  <div className="mb-5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Hledat stroj</p>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Název stroje..."
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
                  </div>

                  {/* Equipment type */}
                  <div className="mb-5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Typ vybavení</p>
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
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Svalové skupiny</p>
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
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Označení</p>
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
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Role cviku</p>
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
                      Vymazat
                    </Button>
                  )}
                  <Button
                    onClick={applyAndCloseFilters}
                    className="flex-1 h-12 rounded-xl gap-2 text-base font-semibold bg-[#1A2744] hover:bg-[#1A2744]/90 text-white"
                  >
                    Zobrazit výsledky
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
                      type="text" placeholder="Hledat cvik..." value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)} autoFocus
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
                  {loadingExercises && <div className="text-center py-8 text-sm text-muted-foreground">Načítám cviky...</div>}
                  {!loadingExercises && filteredExercises.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">Žádné výsledky</div>}
                  <div className="space-y-0.5">
                    {filteredExercises.map((exercise) => (
                      <div key={exercise.id} className="flex items-center rounded-xl hover:bg-muted transition-colors">
                        <button onClick={() => handleAddExercise(exercise)} className="flex-1 text-left px-4 py-3 min-w-0">
                          <p className="text-sm font-medium truncate">{exercise.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {categoryLabels[exercise.category] || exercise.category}
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
              <DrawerTitle>{viewExerciseData?.name || 'Detail cviku'}</DrawerTitle>
            </DrawerHeader>

            {viewExerciseData ? (
              <div className="flex-1 overflow-y-auto px-4 pb-6">
                {viewExerciseData.video_path ? (
                  <div className="rounded-2xl overflow-hidden bg-black mb-4 aspect-video">
                    {viewVideoError ? (
                      <div className="w-full h-full flex items-center justify-center text-white/50 text-sm">Video nedostupné</div>
                    ) : (
                      <video
                        key={viewExerciseData.video_path}
                        src={viewExerciseData.video_path}
                        controls
                        playsInline
                        autoPlay
                        loop
                        muted
                        preload="auto"
                        className="w-full h-full object-contain"
                        style={{ borderRadius: '12px' }}
                        onError={() => setViewVideoError(true)}
                      />
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl bg-muted mb-4 aspect-video flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">Bez videa</p>
                  </div>
                )}

                <p className="text-sm text-muted-foreground mb-4">
                  {categoryLabels[viewExerciseData.category] || viewExerciseData.category}
                  {viewExerciseData.equipment_type && ` · ${equipmentLabels[viewExerciseData.equipment_type] || viewExerciseData.equipment_type}`}
                  {viewExerciseData.machine_name && ` · ${viewExerciseData.machine_name}`}
                </p>

                {viewExerciseData.primary_muscles?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Primární svaly</p>
                    <div className="flex flex-wrap gap-1.5">
                      {viewExerciseData.primary_muscles.map((m) => (
                        <span key={m} className="text-xs bg-[#5BC8F5]/15 text-[#5BC8F5] px-2.5 py-1 rounded-full font-medium">{m}</span>
                      ))}
                    </div>
                  </div>
                )}
                {viewExerciseData.secondary_muscles?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Sekundární svaly</p>
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
                <p className="text-sm text-muted-foreground">Načítám...</p>
              </div>
            )}
          </DrawerContent>
        </Drawer>
      </div>
    </PageTransition>
  );
};

export default CustomPlanDetail;
