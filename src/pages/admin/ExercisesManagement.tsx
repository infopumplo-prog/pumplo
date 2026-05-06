import { useEffect, useState, useMemo } from 'react';
import { useTranslation, TFunction } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Pencil, Trash2, Plus, Search, Loader2, ChevronRight, Video, X } from 'lucide-react';
import { toast } from 'sonner';
import AdminLayout from './AdminLayout';
import MobileCard from '@/components/admin/MobileCard';
import AdminPagination from '@/components/admin/AdminPagination';

interface Exercise {
  id: string;
  name: string;
  category: string;
  difficulty: number;
  machine_id: string | null;
  secondary_machine_id: string | null;
  primary_muscles: string[];
  secondary_muscles: string[];
  video_path: string | null;
  primary_role: string | null;
  equipment_type: string | null;
  allowed_phase: string | null;
  exercise_with_weights: boolean | null;
  required_bench_config: string | null;
  description: string | null;
  setup_instructions: string | null;
  common_mistakes: string | null;
  tips: string | null;
  created_at: string;
}

interface Machine {
  id: string;
  name: string;
}

const getCategories = (t: TFunction) => [
  { value: 'chest', label: t('category.chest') },
  { value: 'back', label: t('category.back') },
  { value: 'shoulders', label: t('category.shoulders') },
  { value: 'arms', label: t('category.arms') },
  { value: 'legs', label: t('category.legs') },
  { value: 'core', label: t('category.core') },
  { value: 'cardio', label: t('category.cardio') },
  { value: 'full_body', label: t('category.full_body') },
  { value: 'abdominals', label: t('category.abdominals') },
];

// Valid muscles whitelist (31 muscles) - English identifiers
const MUSCLE_GROUPS = [
  'abs', 'obliques', 'deep_core_muscles', 'lower_back', 'upper_back',
  'middle_back', 'wide_back_muscles', 'chest_muscles', 'front_shoulders',
  'side_shoulders', 'rear_shoulders', 'biceps', 'upper_arm_muscles',
  'forearms', 'triceps', 'glutes', 'side_glutes', 'hip_flexors',
  'inner_thighs', 'outer_thighs', 'front_thighs', 'back_thighs',
  'calves', 'stabilizing_muscles', 'core_stabilizers', 'upper_trapezius',
  'middle_trapezius', 'lower_trapezius', 'levator_scapulae',
  'rhomboid_major', 'rhomboid_minor'
];

const getEquipmentTypes = (t: TFunction) => [
  { value: 'bodyweight', label: t('equipment.bodyweight') },
  { value: 'barbell', label: t('equipment.barbell') },
  { value: 'dumbbell', label: t('equipment.dumbbell') },
  { value: 'kettlebell', label: t('equipment.kettlebell') },
  { value: 'machine', label: t('equipment.machine') },
  { value: 'cable', label: t('equipment.cable') },
  { value: 'plate_loaded', label: t('equipment.plate_loaded') },
  { value: 'other', label: t('equipment.other') },
];

const getAllowedPhases = (t: TFunction) => [
  { value: 'main', label: t('phase.main') },
  { value: 'warmup', label: t('phase.warmup') },
];

const getBenchConfigs = (t: TFunction) => [
  { value: 'flat', label: t('bench.flat') },
  { value: 'incline', label: t('bench.incline') },
  { value: 'decline', label: t('bench.decline') },
];

const ITEMS_PER_PAGE = 100;

const ExercisesManagement = () => {
  const { t } = useTranslation();
  const CATEGORIES = getCategories(t);
  const EQUIPMENT_TYPES = getEquipmentTypes(t);
  const ALLOWED_PHASES = getAllowedPhases(t);
  const BENCH_CONFIGS = getBenchConfigs(t);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    category: 'chest',
    difficulty: 5,
    machine_id: '',
    secondary_machine_id: '',
    primary_muscles: [] as string[],
    secondary_muscles: [] as string[],
    video_path: '',
    primary_role: '',
    equipment_type: 'bodyweight',
    allowed_phase: 'main',
    exercise_with_weights: true,
    required_bench_config: '',
    description: '',
    setup_instructions: '',
    common_mistakes: '',
    tips: '',
  });

  const fetchData = async () => {
    setIsLoading(true);
    
    // Fetch all exercises (bypassing 1000 limit with range)
    let allExercises: Exercise[] = [];
    let from = 0;
    const batchSize = 1000;
    
    while (true) {
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .order('name')
        .range(from, from + batchSize - 1);
      
      if (error) {
        console.error('Error fetching exercises:', error);
        break;
      }
      
      allExercises = [...allExercises, ...(data || [])];
      
      if (!data || data.length < batchSize) break;
      from += batchSize;
    }
    
    setExercises(allExercises);

    const { data: machinesData } = await supabase
      .from('machines')
      .select('id, name')
      .order('name');

    setMachines(machinesData || []);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle deep link from machine exercises list
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const editId = params.get('edit');
    if (editId && exercises.length > 0) {
      const exercise = exercises.find(e => e.id === editId);
      if (exercise) {
        openEditDrawer(exercise);
        // Clean URL
        window.history.replaceState({}, '', '/admin/exercises');
      }
    }
  }, [exercises]);

  // Filter exercises based on search and category
  const filteredExercises = useMemo(() => {
    return exercises.filter((exercise) => {
      const matchesSearch = exercise.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = filterCategory === 'all' || exercise.category === filterCategory;
      return matchesSearch && matchesCategory;
    });
  }, [exercises, searchTerm, filterCategory]);

  // Paginate filtered results
  const totalPages = Math.ceil(filteredExercises.length / ITEMS_PER_PAGE);
  const paginatedExercises = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredExercises.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredExercises, currentPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterCategory]);

  const openAddDrawer = () => {
    setEditingExercise(null);
    setForm({
      name: '',
      category: 'chest',
      difficulty: 5,
      machine_id: '',
      secondary_machine_id: '',
      primary_muscles: [],
      secondary_muscles: [],
      video_path: '',
      primary_role: '',
      equipment_type: 'bodyweight',
      allowed_phase: 'main',
      exercise_with_weights: true,
      required_bench_config: '',
      description: '',
      setup_instructions: '',
      common_mistakes: '',
      tips: '',
    });
    setDrawerOpen(true);
  };

  const openEditDrawer = (exercise: Exercise) => {
    setEditingExercise(exercise);
    setForm({
      name: exercise.name,
      category: exercise.category,
      difficulty: exercise.difficulty,
      machine_id: exercise.machine_id || '',
      secondary_machine_id: exercise.secondary_machine_id || '',
      primary_muscles: exercise.primary_muscles || [],
      secondary_muscles: exercise.secondary_muscles || [],
      video_path: exercise.video_path || '',
      primary_role: exercise.primary_role || '',
      equipment_type: exercise.equipment_type || 'bodyweight',
      allowed_phase: exercise.allowed_phase || 'main',
      exercise_with_weights: exercise.exercise_with_weights ?? true,
      required_bench_config: exercise.required_bench_config || '',
      description: exercise.description || '',
      setup_instructions: exercise.setup_instructions || '',
      common_mistakes: exercise.common_mistakes || '',
      tips: exercise.tips || '',
    });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error(t('admin.exercise_name_required'));
      return;
    }

    const exerciseData = {
      name: form.name,
      category: form.category,
      difficulty: form.difficulty,
      machine_id: form.machine_id || null,
      secondary_machine_id: form.secondary_machine_id || null,
      primary_muscles: form.primary_muscles,
      secondary_muscles: form.secondary_muscles,
      video_path: form.video_path || null,
      primary_role: form.primary_role || null,
      equipment_type: form.equipment_type,
      allowed_phase: form.allowed_phase,
      exercise_with_weights: form.exercise_with_weights,
      required_bench_config: form.required_bench_config || null,
      description: form.description || null,
      setup_instructions: form.setup_instructions || null,
      common_mistakes: form.common_mistakes || null,
      tips: form.tips || null,
    };

    if (editingExercise) {
      const { error } = await supabase
        .from('exercises')
        .update(exerciseData)
        .eq('id', editingExercise.id);

      if (error) {
        toast.error(t('admin.exercise_save_error'));
        return;
      }
      toast.success(t('admin.exercise_saved'));
    } else {
      const { error } = await supabase.from('exercises').insert(exerciseData);

      if (error) {
        toast.error(t('admin.exercise_add_error'));
        return;
      }
      toast.success(t('admin.exercise_added'));
    }

    setDrawerOpen(false);
    fetchData();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from('exercises').delete().eq('id', id);

    if (error) {
      toast.error(t('admin.exercise_delete_error'));
      return;
    }

    toast.success(t('admin.exercise_deleted'));
    fetchData();
  };

  const toggleMuscle = (muscle: string, type: 'primary' | 'secondary') => {
    const field = type === 'primary' ? 'primary_muscles' : 'secondary_muscles';
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(muscle)
        ? prev[field].filter((m) => m !== muscle)
        : [...prev[field], muscle],
    }));
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const ext = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('exercise-videos').upload(fileName, file);
    if (error) {
      toast.error(t('admin.video_upload_error'));
      setIsUploading(false);
      return;
    }
    const { data } = supabase.storage.from('exercise-videos').getPublicUrl(fileName);
    setForm(prev => ({ ...prev, video_path: data.publicUrl }));
    setIsUploading(false);
    toast.success(t('admin.video_uploaded'));
  };

  const getCategoryLabel = (value: string) => {
    return CATEGORIES.find((c) => c.value === value)?.label || value;
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{t('admin.exercises_title')}</h2>
          <Button onClick={openAddDrawer} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            {t('admin.add')}
          </Button>
        </div>

        {/* Filters */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('admin.search_exercise')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger>
              <SelectValue placeholder={t('admin.category_label')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin.all_categories')}</SelectItem>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Mobile Card List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-2">
            {paginatedExercises.map((exercise) => (
              <MobileCard key={exercise.id} onClick={() => openEditDrawer(exercise)}>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{exercise.name}</p>
                      {exercise.video_path && (
                        <Video className="w-4 h-4 text-primary shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-muted">
                        {getCategoryLabel(exercise.category)}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary">
                        {t('admin.level_badge', { n: exercise.difficulty })}
                      </span>
                      {exercise.equipment_type && exercise.equipment_type !== 'bodyweight' && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-accent/10 text-accent-foreground">
                          {EQUIPMENT_TYPES.find(e => e.value === exercise.equipment_type)?.label || exercise.equipment_type}
                        </span>
                      )}
                      {exercise.allowed_phase === 'warmup' && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-secondary text-secondary-foreground">
                          {t('phase.warmup')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={(e) => handleDelete(exercise.id, e)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </div>
              </MobileCard>
            ))}
          </div>
        )}

        {/* Pagination */}
        <AdminPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={filteredExercises.length}
          itemsPerPage={ITEMS_PER_PAGE}
        />

        {/* Add/Edit Drawer */}
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerContent className="max-h-[90vh]">
            <DrawerHeader>
              <DrawerTitle>
                {editingExercise ? t('admin.edit_exercise_title') : t('admin.add_exercise_title')}
              </DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-4 space-y-4 overflow-y-auto max-h-[60vh]">
              <div>
                <Label>{t('admin.exercise_name_label')}</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div>
                <Label>{t('admin.description_label')}</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder={t('admin.description_placeholder')}
                  rows={2}
                />
              </div>

              <div>
                <Label>{t('admin.setup_label')}</Label>
                <Textarea
                  value={form.setup_instructions}
                  onChange={(e) => setForm({ ...form, setup_instructions: e.target.value })}
                  placeholder={t('admin.machine_setup_placeholder')}
                  rows={2}
                />
              </div>

              <div>
                <Label>{t('admin.common_mistakes_label')}</Label>
                <Textarea
                  value={form.common_mistakes}
                  onChange={(e) => setForm({ ...form, common_mistakes: e.target.value })}
                  placeholder={t('admin.common_mistakes_placeholder')}
                  rows={2}
                />
              </div>

              <div>
                <Label>{t('admin.tips_label')}</Label>
                <Textarea
                  value={form.tips}
                  onChange={(e) => setForm({ ...form, tips: e.target.value })}
                  placeholder={t('admin.tips_placeholder')}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('admin.category_label')}</Label>
                  <Select
                    value={form.category}
                    onValueChange={(value) => setForm({ ...form, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('admin.difficulty_label')}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={form.difficulty}
                    onChange={(e) => setForm({ ...form, difficulty: parseInt(e.target.value) || 5 })}
                  />
                </div>
              </div>

              <div>
                <Label>{t('admin.equipment_type_label')}</Label>
                <Select
                  value={form.equipment_type}
                  onValueChange={(value) => setForm({ ...form, equipment_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('admin.select_equipment')} />
                  </SelectTrigger>
                  <SelectContent>
                    {EQUIPMENT_TYPES.map((eq) => (
                      <SelectItem key={eq.value} value={eq.value}>
                        {eq.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{t('admin.training_phase_label')}</Label>
                <Select
                  value={form.allowed_phase}
                  onValueChange={(value) => setForm({ ...form, allowed_phase: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('admin.select_phase')} />
                  </SelectTrigger>
                  <SelectContent>
                    {ALLOWED_PHASES.map((phase) => (
                      <SelectItem key={phase.value} value={phase.value}>
                        {phase.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{t('admin.primary_equipment_label')}</Label>
                <Select
                  value={form.machine_id || '__none__'}
                  onValueChange={(value) => setForm({ ...form, machine_id: value === '__none__' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('admin.select_equipment')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t('admin.no_equipment')}</SelectItem>
                    {machines.map((machine) => (
                      <SelectItem key={machine.id} value={machine.id}>
                        {machine.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{t('admin.secondary_equipment_label')}</Label>
                <Select
                  value={form.secondary_machine_id || '__none__'}
                  onValueChange={(value) => setForm({ ...form, secondary_machine_id: value === '__none__' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('admin.select_secondary')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t('admin.no_equipment')}</SelectItem>
                    {machines.map((machine) => (
                      <SelectItem key={machine.id} value={machine.id}>
                        {machine.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{t('admin.bench_config_label')}</Label>
                <Select
                  value={form.required_bench_config || '__none__'}
                  onValueChange={(value) => setForm({ ...form, required_bench_config: value === '__none__' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('admin.no_bench')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t('admin.no_bench')}</SelectItem>
                    {BENCH_CONFIGS.map((config) => (
                      <SelectItem key={config.value} value={config.value}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label>{t('admin.exercise_with_weights')}</Label>
                <Switch
                  checked={form.exercise_with_weights}
                  onCheckedChange={(checked) => setForm({ ...form, exercise_with_weights: checked })}
                />
              </div>

              <div>
                <Label>{t('admin.primary_muscles_label')}</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {MUSCLE_GROUPS.map((muscle) => (
                    <button
                      key={muscle}
                      type="button"
                      onClick={() => toggleMuscle(muscle, 'primary')}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        form.primary_muscles.includes(muscle)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {muscle}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>{t('admin.secondary_muscles_label')}</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {MUSCLE_GROUPS.map((muscle) => (
                    <button
                      key={muscle}
                      type="button"
                      onClick={() => toggleMuscle(muscle, 'secondary')}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        form.secondary_muscles.includes(muscle)
                          ? 'bg-secondary text-secondary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {muscle}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>{t('admin.video_label')}</Label>
                {form.video_path && (
                  <div className="mt-1 mb-2 rounded-lg overflow-hidden bg-black aspect-video">
                    <video src={form.video_path} className="w-full h-full object-contain" controls />
                  </div>
                )}
                <div className="flex gap-2 mt-1">
                  <label className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2 px-3 py-2 border border-input rounded-md hover:bg-muted/50 text-sm text-muted-foreground">
                      {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
                      {isUploading ? t('admin.uploading_video') : form.video_path ? t('admin.change_video') : t('admin.upload_video')}
                    </div>
                    <input type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} disabled={isUploading} />
                  </label>
                  {form.video_path && (
                    <Button variant="outline" size="icon" type="button" onClick={() => setForm(prev => ({ ...prev, video_path: '' }))}>
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div>
                <Label>{t('admin.primary_role_label')}</Label>
                <Input
                  value={form.primary_role}
                  onChange={(e) => setForm({ ...form, primary_role: e.target.value })}
                  placeholder="napr. horizontal_push"
                />
              </div>
            </div>
            <DrawerFooter>
              <Button onClick={handleSave} className="w-full">
                {editingExercise ? t('admin.save_exercise_btn') : t('admin.add_exercise_btn')}
              </Button>
              <DrawerClose asChild>
                <Button variant="outline">{t('admin.cancel')}</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>
    </AdminLayout>
  );
};

export default ExercisesManagement;
