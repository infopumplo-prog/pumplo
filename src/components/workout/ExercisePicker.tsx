/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, Check, Dumbbell, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { translateMuscle } from '@/lib/muscleTranslation';
import { getVideoThumbUrl } from '@/lib/videoUtils';
import { ExerciseInfoContent } from './ExerciseInfoContent';
import { cn } from '@/lib/utils';

// Exercise shape returned to the caller when exercises are picked.
export interface PickerExercise {
  id: string;
  name: string;
  name_en: string | null;
  primary_muscles: string[];
  primary_muscles_en: string[] | null;
  equipment_type: string | null;
  video_path: string | null;
  category: string;
  machine_id: string | null;
  unit_type: string;
}

interface ExercisePickerProps {
  open: boolean;
  onClose: () => void;
  onAdd: (exercises: PickerExercise[]) => void;
  gymId?: string | null;
}

const BUCKET = 'exercise-videos';
// Build a public CDN url synchronously (exercise-videos is a public bucket).
const publicVideoUrl = (videoPath: string | null): string | null => {
  if (!videoPath) return null;
  const marker = `/${BUCKET}/`;
  const idx = videoPath.indexOf(marker);
  const path = idx !== -1 ? videoPath.substring(idx + marker.length) : videoPath;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data?.publicUrl ?? null;
};

// Diacritics + case insensitive normalize for search matching.
const norm = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Equipment values that actually exist in the DB (exercises.equipment_type).
const EQUIPMENT_KEYS = ['machine', 'free_weight', 'bodyweight'] as const;

// Hevy-like muscle groups mapped onto the messy real primary_muscles values.
const getMuscleGroups = () => [
  { key: 'chest', match: ['prsa', 'prsní', 'chest', 'horní prsa', 'spodní prsa', 'horni prsa'] },
  { key: 'back', match: ['záda', 'back', 'laty', 'latisi', 'latysi', 'latissim', 'lopatky', 'trapéz', 'trapez', 'traps', 'pilovitý', 'pilovity', 'rhomboid', 'wide_back', 'střed zad', 'stred zad'] },
  { key: 'shoulders', match: ['ramena', 'shoulders', 'front_shoulders', 'side_shoulders', 'deltoid'] },
  { key: 'biceps', match: ['biceps'] },
  { key: 'triceps', match: ['triceps'] },
  { key: 'legs', match: ['nohy', 'nožní', 'kvadriceps', 'quadriceps', 'quads', 'dolní konč', 'dolni konc', 'hamstring', 'front_thigh', 'back_thigh'] },
  { key: 'glutes', match: ['zadek', 'glute', 'hýždě', 'hyzde'] },
  { key: 'calves', match: ['lýtka', 'lytka', 'calves', 'calf'] },
  { key: 'core', match: ['břišní', 'brisni', 'břicho', 'bricho', 'střed těla', 'stred tela', 'core', 'abs', 'bedra', 'šikmé', 'sikme'] },
  { key: 'arms', match: ['paže', 'paze', 'ruce', 'předloktí', 'predlokti', 'forearm'] },
];

const ExercisePicker = ({ open, onClose, onAdd, gymId }: ExercisePickerProps) => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';

  const [allExercises, setAllExercises] = useState<PickerExercise[]>([]);
  const [gymMachineIds, setGymMachineIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [equipment, setEquipment] = useState<string | null>(null); // null = Vše
  const [muscle, setMuscle] = useState<string | null>(null); // null = Vše
  const [onlyMyGym, setOnlyMyGym] = useState(true);
  const [selected, setSelected] = useState<Map<string, PickerExercise>>(new Map());
  const [sheet, setSheet] = useState<null | 'equipment' | 'muscle'>(null);

  // Exercise info sheet (opened by tapping the thumbnail). Details are fetched
  // on demand so the list query stays light.
  interface ExerciseInfo {
    name: string; nameEn: string | null; videoUrl: string | null; category: string;
    equipmentType: string | null; machineName: string | null;
    primaryMuscles: string[]; secondaryMuscles: string[];
    primaryMusclesEn: string[] | null; secondaryMusclesEn: string[] | null;
    description: string | null; setupInstructions: string | null;
    commonMistakes: string | null; tips: string | null;
  }
  const [info, setInfo] = useState<ExerciseInfo | null>(null);
  const [infoVideoError, setInfoVideoError] = useState(false);
  // Swipe-to-dismiss for the info sheet: drag starts from the header strip
  // (dragListener=false), so the scrollable content below still scrolls freely.
  const infoDragControls = useDragControls();
  const openInfo = async (ex: PickerExercise) => {
    setInfoVideoError(false);
    const { data } = await supabase
      .from('exercises')
      .select('name, name_en, category, equipment_type, primary_muscles, secondary_muscles, primary_muscles_en, secondary_muscles_en, video_path, description, setup_instructions, common_mistakes, tips, machines!exercises_machine_id_fkey(name)')
      .eq('id', ex.id)
      .single();
    if (!data) return;
    const d = data as any;
    setInfo({
      name: d.name, nameEn: d.name_en || null, videoUrl: publicVideoUrl(d.video_path),
      category: d.category || '', equipmentType: d.equipment_type || null,
      machineName: d.machines?.name || null,
      primaryMuscles: d.primary_muscles || [], secondaryMuscles: d.secondary_muscles || [],
      primaryMusclesEn: d.primary_muscles_en || null, secondaryMusclesEn: d.secondary_muscles_en || null,
      description: d.description || null, setupInstructions: d.setup_instructions || null,
      commonMistakes: d.common_mistakes || null, tips: d.tips || null,
    });
  };

  // Keyboard-aware fullscreen sizing (matches CustomPlanDetail drawer behaviour).
  const [drawerHeight, setDrawerHeight] = useState('100dvh');
  const [drawerBottom, setDrawerBottom] = useState('0px');
  useEffect(() => {
    if (!open) return;
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
  }, [open]);

  const loadExercises = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('exercises')
      .select('id, name, name_en, primary_muscles, primary_muscles_en, equipment_type, video_path, category, machine_id, unit_type')
      .order('name', { ascending: true });
    setAllExercises((data || []).map((e: any) => ({
      id: e.id,
      name: e.name,
      name_en: e.name_en ?? null,
      primary_muscles: e.primary_muscles || [],
      primary_muscles_en: e.primary_muscles_en ?? null,
      equipment_type: e.equipment_type ?? null,
      video_path: e.video_path ?? null,
      category: e.category || '',
      machine_id: e.machine_id ?? null,
      unit_type: e.unit_type || 'reps',
    })));
    setLoading(false);
  }, []);

  const loadGymMachines = useCallback(async (id: string) => {
    const { data } = await supabase.from('gym_machines').select('machine_id').eq('gym_id', id);
    setGymMachineIds(new Set((data || []).map((m: any) => m.machine_id)));
  }, []);

  // Load data when opened; reset selection/filters on close.
  useEffect(() => {
    if (open) {
      if (allExercises.length === 0) loadExercises();
      if (gymId) loadGymMachines(gymId);
    } else {
      setQuery('');
      setEquipment(null);
      setMuscle(null);
      setSelected(new Map());
      setSheet(null);
    }
  }, [open, gymId]); // eslint-disable-line react-hooks/exhaustive-deps

  const muscleGroups = useMemo(() => getMuscleGroups(), []);

  const filtered = useMemo(() => {
    let list = allExercises;

    if (onlyMyGym && gymId) {
      list = list.filter(e => e.machine_id == null || gymMachineIds.has(e.machine_id));
    }
    if (equipment) {
      list = list.filter(e => e.equipment_type === equipment);
    }
    if (muscle) {
      const group = muscleGroups.find(g => g.key === muscle);
      if (group) {
        list = list.filter(e => {
          const text = norm((e.primary_muscles || []).join(' '));
          return group.match.some(m => text.includes(norm(m)));
        });
      }
    }
    if (query.trim()) {
      const q = norm(query);
      list = list.filter(e => norm(e.name).includes(q) || (e.name_en && norm(e.name_en).includes(q)));
    }
    return list;
  }, [allExercises, onlyMyGym, gymId, gymMachineIds, equipment, muscle, query, muscleGroups]);

  const toggleSelect = (ex: PickerExercise) => {
    setSelected(prev => {
      const next = new Map(prev);
      if (next.has(ex.id)) next.delete(ex.id);
      else next.set(ex.id, ex);
      return next;
    });
  };

  const handleAdd = () => {
    if (selected.size === 0) return;
    onAdd(Array.from(selected.values()));
    setSelected(new Map());
    onClose();
  };

  // Cancel = drop the in-progress selection AND any open info sheet, so the
  // picker opens clean next time (the component stays mounted between opens).
  const handleCancel = () => {
    setSelected(new Map());
    setInfo(null);
    onClose();
  };
  useEffect(() => { if (open) { setInfo(null); setInfoVideoError(false); } }, [open]);

  const equipmentLabel = equipment ? t(`equipment.${equipment}`) : t('exercise_picker.all');
  const muscleLabel = muscle ? t(`custom_plan.muscle_${muscle}`) : t('exercise_picker.all');

  // Czech-correct plural for the "Add N exercises" CTA.
  const exerciseWord = (n: number): string =>
    n === 1 ? t('custom_plan.exercise_word_one')
      : n >= 2 && n <= 4 ? t('custom_plan.exercise_word_few')
        : t('custom_plan.exercise_word_many');

  const primaryMuscleText = (ex: PickerExercise): string => {
    const arr = (isEn && ex.primary_muscles_en?.length ? ex.primary_muscles_en : ex.primary_muscles) || [];
    if (arr.length === 0) return '';
    return arr.map(m => translateMuscle(m, isEn)).slice(0, 2).join(', ');
  };

  return (
    <Drawer open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DrawerContent className="flex flex-col" style={{ height: drawerHeight, maxHeight: drawerHeight, bottom: drawerBottom }} hideHandle>
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 pb-2" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}>
          <button onClick={handleCancel} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-1">
            {t('exercise_picker.cancel')}
          </button>
          <h2 className="text-base font-bold">{t('exercise_picker.title')}</h2>
          <span className="w-14" />
        </div>

        {/* Search */}
        <div className="shrink-0 px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('custom_plan.search_exercise')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-muted rounded-xl pl-10 pr-10 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Filter chips */}
        <div className="shrink-0 flex gap-2 px-4 pb-2">
          <button
            onClick={() => setSheet('equipment')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-colors',
              equipment ? 'bg-[#5BC8F5] text-white border-[#5BC8F5]' : 'bg-card border-border text-foreground'
            )}
          >
            {equipmentLabel}
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setSheet('muscle')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-colors',
              muscle ? 'bg-[#5BC8F5] text-white border-[#5BC8F5]' : 'bg-card border-border text-foreground'
            )}
          >
            {muscleLabel}
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Only-my-gym toggle */}
        {gymId && (
          <div className="shrink-0 flex items-center justify-between px-4 py-2 mx-4 mb-2 bg-muted/50 rounded-xl">
            <span className="text-sm font-medium">{t('exercise_picker.only_my_gym')}</span>
            <button
              onClick={() => setOnlyMyGym(v => !v)}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors',
                onlyMyGym ? 'bg-[#5BC8F5]' : 'bg-muted-foreground/30'
              )}
            >
              <span className={cn('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform', onlyMyGym && 'translate-x-5')} />
            </button>
          </div>
        )}

        {/* Exercise list */}
        <div className="flex-1 overflow-y-auto px-4 pb-28 overscroll-contain">
          {loading && <div className="text-center py-8 text-sm text-muted-foreground">{t('custom_plan.loading_exercises')}</div>}
          {!loading && filtered.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">{t('custom_plan.no_results')}</div>}
          <div className="space-y-1">
            {filtered.map((ex) => {
              const isSel = selected.has(ex.id);
              return (
                <button
                  key={ex.id}
                  onClick={() => toggleSelect(ex)}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-xl pr-3 py-2 text-left transition-colors overflow-hidden',
                    isSel ? 'bg-[#5BC8F5]/10' : 'hover:bg-muted'
                  )}
                >
                  {/* Left accent bar (Hevy style) */}
                  <span className={cn('self-stretch w-1 rounded-full shrink-0', isSel ? 'bg-[#5BC8F5]' : 'bg-transparent')} />
                  <ExerciseThumb videoPath={ex.video_path} onTap={() => openInfo(ex)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{(isEn && ex.name_en) ? ex.name_en : ex.name}</p>
                    {primaryMuscleText(ex) && <p className="text-xs text-muted-foreground truncate">{primaryMuscleText(ex)}</p>}
                  </div>
                  {isSel && (
                    <span className="shrink-0 w-6 h-6 rounded-full bg-[#5BC8F5] flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sticky CTA */}
        <AnimatePresence>
          {selected.size > 0 && (
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="absolute left-0 right-0 px-4 pt-2"
              style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
            >
              <Button
                onClick={handleAdd}
                className="w-full h-14 rounded-2xl text-base font-bold bg-[#1A2744] hover:bg-[#1A2744]/90 text-white shadow-lg"
              >
                {t('exercise_picker.add')} {selected.size} {exerciseWord(selected.size)}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filter bottom-sheets (in-drawer overlay) */}
        <AnimatePresence>
          {sheet && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/40 z-10"
                onClick={() => setSheet(null)}
              />
              <motion.div
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="absolute left-0 right-0 bottom-0 z-20 bg-background rounded-t-2xl max-h-[70%] flex flex-col"
              >
                <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-muted shrink-0" />
                <p className="px-5 pt-3 pb-2 text-sm font-bold shrink-0">
                  {sheet === 'equipment' ? t('custom_plan.equipment_type') : t('custom_plan.muscle_groups')}
                </p>
                <div className="overflow-y-auto pb-6">
                  {sheet === 'equipment' ? (
                    <FilterOptionList
                      options={[{ key: null, label: t('exercise_picker.all') }, ...EQUIPMENT_KEYS.map(k => ({ key: k, label: t(`equipment.${k}`) }))]}
                      selected={equipment}
                      onSelect={(k) => { setEquipment(k); setSheet(null); }}
                    />
                  ) : (
                    <FilterOptionList
                      options={[{ key: null, label: t('exercise_picker.all') }, ...muscleGroups.map(g => ({ key: g.key, label: t(`custom_plan.muscle_${g.key}`) }))]}
                      selected={muscle}
                      onSelect={(k) => { setMuscle(k); setSheet(null); }}
                    />
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Exercise info sheet (thumbnail tap) */}
        <AnimatePresence>
          {info && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/40 z-10"
                onClick={() => setInfo(null)}
              />
              <motion.div
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                drag="y"
                dragListener={false}
                dragControls={infoDragControls}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.7 }}
                onDragEnd={(_, i) => { if (i.offset.y > 100 || i.velocity.y > 500) setInfo(null); }}
                data-vaul-no-drag
                className="absolute left-0 right-0 bottom-0 z-20 bg-background rounded-t-2xl max-h-[85%] flex flex-col"
              >
                <div
                  className="shrink-0 cursor-grab active:cursor-grabbing"
                  style={{ touchAction: 'none' }}
                  onPointerDown={(e) => { e.stopPropagation(); infoDragControls.start(e); }}
                >
                  <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-muted" />
                  <p className="px-5 pt-3 pb-2 text-base font-bold">{(isEn && info.nameEn) ? info.nameEn : info.name}</p>
                </div>
                <div className="overflow-y-auto px-5 pb-8">
                  {info.videoUrl && !infoVideoError ? (
                    <div className="rounded-2xl overflow-hidden bg-black mb-4 aspect-video">
                      <video
                        key={info.videoUrl}
                        src={info.videoUrl}
                        playsInline autoPlay loop muted preload="auto"
                        className="w-full h-full object-contain"
                        onError={() => setInfoVideoError(true)}
                      />
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-muted mb-4 aspect-video flex items-center justify-center">
                      <p className="text-sm text-muted-foreground">{t('workout.no_video')}</p>
                    </div>
                  )}
                  <ExerciseInfoContent
                    category={info.category}
                    equipmentType={info.equipmentType}
                    machineName={info.machineName}
                    primaryMuscles={info.primaryMuscles}
                    secondaryMuscles={info.secondaryMuscles}
                    primaryMusclesEn={info.primaryMusclesEn}
                    secondaryMusclesEn={info.secondaryMusclesEn}
                    description={info.description}
                    descriptionEn={null}
                    setupInstructions={info.setupInstructions}
                    setupInstructionsEn={null}
                    commonMistakes={info.commonMistakes}
                    commonMistakesEn={null}
                    tips={info.tips}
                    tipsEn={null}
                  />
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </DrawerContent>
    </Drawer>
  );
};

// Radio-style option list used inside the equipment / muscle bottom sheets.
const FilterOptionList = ({ options, selected, onSelect }: {
  options: { key: string | null; label: string }[];
  selected: string | null;
  onSelect: (key: string | null) => void;
}) => (
  <div>
    {options.map((o) => (
      <button
        key={o.key ?? '__all__'}
        onClick={() => onSelect(o.key)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-muted transition-colors"
      >
        <span className={cn('text-sm', selected === o.key ? 'font-semibold text-[#5BC8F5]' : 'text-foreground')}>{o.label}</span>
        {selected === o.key && <Check className="w-4 h-4 text-[#5BC8F5]" />}
      </button>
    ))}
  </div>
);

// Static first-frame JPEG thumbnail with dumbbell fallback. Tapping it opens
// the exercise info sheet (selection stays on the row itself). Never render
// <video> in the list — 200 of them stall the whole picker on iOS.
const ExerciseThumb = ({ videoPath, onTap }: { videoPath: string | null; onTap?: () => void }) => {
  const [error, setError] = useState(false);
  const url = useRef(getVideoThumbUrl(videoPath)).current;
  const handleTap = onTap ? (e: React.MouseEvent) => { e.stopPropagation(); onTap(); } : undefined;
  if (!url || error) {
    return (
      <div onClick={handleTap} className="shrink-0 w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
        <Dumbbell className="w-5 h-5 text-muted-foreground/50" />
      </div>
    );
  }
  return (
    <div onClick={handleTap} className="shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-muted">
      <img
        src={url}
        alt=""
        loading="lazy"
        className="w-full h-full object-cover"
        onError={() => setError(true)}
      />
    </div>
  );
};

export default ExercisePicker;
