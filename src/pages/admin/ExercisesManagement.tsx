import { useEffect, useState, useMemo } from 'react';
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
import { Pencil, Trash2, Plus, Search, Loader2, ChevronRight, Video } from 'lucide-react';
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
  created_at: string;
}

interface Machine {
  id: string;
  name: string;
}

const CATEGORIES = [
  { value: 'chest', label: 'Hrudník' },
  { value: 'back', label: 'Chrbát' },
  { value: 'shoulders', label: 'Ramená' },
  { value: 'arms', label: 'Ruky' },
  { value: 'legs', label: 'Nohy' },
  { value: 'core', label: 'Core' },
  { value: 'cardio', label: 'Kardio' },
  { value: 'full_body', label: 'Celé telo' },
  { value: 'abdominals', label: 'Brušné svaly' },
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

const EQUIPMENT_TYPES = [
  { value: 'bodyweight', label: 'Vlastná váha' },
  { value: 'barbell', label: 'Činka' },
  { value: 'dumbbell', label: 'Jednoručky' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'machine', label: 'Stroj' },
  { value: 'cable', label: 'Kladka' },
  { value: 'plate_loaded', label: 'Kotúče' },
  { value: 'other', label: 'Iné' },
];

const ALLOWED_PHASES = [
  { value: 'main', label: 'Hlavný tréning' },
  { value: 'warmup', label: 'Rozcvička' },
];

const ITEMS_PER_PAGE = 100;

const ExercisesManagement = () => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
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
    });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Názov je povinný');
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
    };

    if (editingExercise) {
      const { error } = await supabase
        .from('exercises')
        .update(exerciseData)
        .eq('id', editingExercise.id);

      if (error) {
        toast.error('Chyba pri ukladaní');
        return;
      }
      toast.success('Cvik aktualizovaný');
    } else {
      const { error } = await supabase.from('exercises').insert(exerciseData);

      if (error) {
        toast.error('Chyba pri vytváraní');
        return;
      }
      toast.success('Cvik pridaný');
    }

    setDrawerOpen(false);
    fetchData();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from('exercises').delete().eq('id', id);

    if (error) {
      toast.error('Chyba pri mazaní');
      return;
    }

    toast.success('Cvik vymazaný');
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

  const getCategoryLabel = (value: string) => {
    return CATEGORIES.find((c) => c.value === value)?.label || value;
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Cviky</h2>
          <Button onClick={openAddDrawer} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Pridať
          </Button>
        </div>

        {/* Filters */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Hľadať cvik..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Kategória" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všetky kategórie</SelectItem>
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
                        Úroveň {exercise.difficulty}
                      </span>
                      {exercise.equipment_type && exercise.equipment_type !== 'bodyweight' && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-accent/10 text-accent-foreground">
                          {EQUIPMENT_TYPES.find(e => e.value === exercise.equipment_type)?.label || exercise.equipment_type}
                        </span>
                      )}
                      {exercise.allowed_phase === 'warmup' && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-secondary text-secondary-foreground">
                          Rozcvička
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
                {editingExercise ? 'Upraviť cvik' : 'Pridať cvik'}
              </DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-4 space-y-4 overflow-y-auto max-h-[60vh]">
              <div>
                <Label>Názov</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Kategória</Label>
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
                  <Label>Obtiažnosť (1-10)</Label>
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
                <Label>Typ vybavenia</Label>
                <Select
                  value={form.equipment_type}
                  onValueChange={(value) => setForm({ ...form, equipment_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Vyber typ" />
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
                <Label>Fáza tréningu</Label>
                <Select
                  value={form.allowed_phase}
                  onValueChange={(value) => setForm({ ...form, allowed_phase: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Vyber fázu" />
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
                <Label>Primární vybavení (machine_id)</Label>
                <Select
                  value={form.machine_id || '__none__'}
                  onValueChange={(value) => setForm({ ...form, machine_id: value === '__none__' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Vyber vybavení" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Žádné</SelectItem>
                    {machines.map((machine) => (
                      <SelectItem key={machine.id} value={machine.id}>
                        {machine.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Sekundární vybavení (secondary_machine_id)</Label>
                <Select
                  value={form.secondary_machine_id || '__none__'}
                  onValueChange={(value) => setForm({ ...form, secondary_machine_id: value === '__none__' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Vyber sekundární vybavení" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Žádné</SelectItem>
                    {machines.map((machine) => (
                      <SelectItem key={machine.id} value={machine.id}>
                        {machine.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label>Cvik s váhami</Label>
                <Switch
                  checked={form.exercise_with_weights}
                  onCheckedChange={(checked) => setForm({ ...form, exercise_with_weights: checked })}
                />
              </div>

              <div>
                <Label>Primárne svaly</Label>
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
                <Label>Sekundárne svaly</Label>
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
                <Label>Cesta k videu</Label>
                <Input
                  value={form.video_path}
                  onChange={(e) => setForm({ ...form, video_path: e.target.value })}
                  placeholder="napr. Chest/push_up.mp4"
                />
              </div>

              <div>
                <Label>Primárna rola</Label>
                <Input
                  value={form.primary_role}
                  onChange={(e) => setForm({ ...form, primary_role: e.target.value })}
                  placeholder="napr. horizontal_push"
                />
              </div>
            </div>
            <DrawerFooter>
              <Button onClick={handleSave} className="w-full">
                {editingExercise ? 'Uložiť zmeny' : 'Pridať cvik'}
              </Button>
              <DrawerClose asChild>
                <Button variant="outline">Zrušiť</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>
    </AdminLayout>
  );
};

export default ExercisesManagement;
