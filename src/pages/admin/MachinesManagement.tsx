import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Pencil, Trash2, Plus, Search, Loader2, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import AdminLayout from './AdminLayout';
import MobileCard from '@/components/admin/MobileCard';
import AdminPagination from '@/components/admin/AdminPagination';

interface Machine {
  id: string;
  name: string;
  description: string | null;
  target_muscles: string[];
  equipment_type: string;
  image_url: string | null;
  created_at: string;
}

const EQUIPMENT_TYPES = [
  { value: 'machine', label: 'Stroj' },
  { value: 'free_weight', label: 'Voľné váhy' },
  { value: 'bodyweight', label: 'Vlastná váha' },
  { value: 'cardio', label: 'Kardio' },
  { value: 'accessory', label: 'Príslušenstvo' },
];

const MUSCLE_GROUPS = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
  'core', 'legs', 'quadriceps', 'hamstrings', 'glutes', 'calves', 'cardio',
];

const ITEMS_PER_PAGE = 100;

const MachinesManagement = () => {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [form, setForm] = useState({
    name: '',
    description: '',
    equipment_type: 'machine',
    target_muscles: [] as string[],
  });

  const fetchMachines = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('machines')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching machines:', error);
    } else {
      setMachines(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchMachines();
  }, []);

  // Filter machines based on search and type
  const filteredMachines = useMemo(() => {
    return machines.filter((machine) => {
      const matchesSearch = machine.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || machine.equipment_type === filterType;
      return matchesSearch && matchesType;
    });
  }, [machines, searchTerm, filterType]);

  // Paginate filtered results
  const totalPages = Math.ceil(filteredMachines.length / ITEMS_PER_PAGE);
  const paginatedMachines = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredMachines.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredMachines, currentPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType]);

  const openAddDrawer = () => {
    setEditingMachine(null);
    setForm({
      name: '',
      description: '',
      equipment_type: 'machine',
      target_muscles: [],
    });
    setDrawerOpen(true);
  };

  const openEditDrawer = (machine: Machine) => {
    setEditingMachine(machine);
    setForm({
      name: machine.name,
      description: machine.description || '',
      equipment_type: machine.equipment_type,
      target_muscles: machine.target_muscles || [],
    });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Názov je povinný');
      return;
    }

    if (editingMachine) {
      const { error } = await supabase
        .from('machines')
        .update({
          name: form.name,
          description: form.description || null,
          equipment_type: form.equipment_type,
          target_muscles: form.target_muscles,
        })
        .eq('id', editingMachine.id);

      if (error) {
        toast.error('Chyba pri ukladaní');
        return;
      }
      toast.success('Stroj aktualizovaný');
    } else {
      const { error } = await supabase.from('machines').insert({
        name: form.name,
        description: form.description || null,
        equipment_type: form.equipment_type,
        target_muscles: form.target_muscles,
      });

      if (error) {
        toast.error('Chyba pri vytváraní');
        return;
      }
      toast.success('Stroj pridaný');
    }

    setDrawerOpen(false);
    fetchMachines();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from('machines').delete().eq('id', id);

    if (error) {
      toast.error('Chyba pri mazaní');
      return;
    }

    toast.success('Stroj vymazaný');
    fetchMachines();
  };

  const toggleMuscle = (muscle: string) => {
    setForm((prev) => ({
      ...prev,
      target_muscles: prev.target_muscles.includes(muscle)
        ? prev.target_muscles.filter((m) => m !== muscle)
        : [...prev.target_muscles, muscle],
    }));
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Stroje</h2>
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
              placeholder="Hľadať stroj..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger>
              <SelectValue placeholder="Typ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všetky typy</SelectItem>
              {EQUIPMENT_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
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
            {paginatedMachines.map((machine) => (
              <MobileCard key={machine.id} onClick={() => openEditDrawer(machine)}>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{machine.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-muted">
                        {EQUIPMENT_TYPES.find((t) => t.value === machine.equipment_type)?.label}
                      </span>
                      {machine.target_muscles.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {machine.target_muscles.length} sval(ov)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={(e) => handleDelete(machine.id, e)}
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
          totalItems={filteredMachines.length}
          itemsPerPage={ITEMS_PER_PAGE}
        />

        {/* Add/Edit Drawer */}
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerContent className="max-h-[90vh]">
            <DrawerHeader>
              <DrawerTitle>
                {editingMachine ? 'Upraviť stroj' : 'Pridať stroj'}
              </DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-4 space-y-4 overflow-y-auto">
              <div>
                <Label>Názov</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Popis</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div>
                <Label>Typ vybavenia</Label>
                <Select
                  value={form.equipment_type}
                  onValueChange={(value) => setForm({ ...form, equipment_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EQUIPMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cieľové svaly</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {MUSCLE_GROUPS.map((muscle) => (
                    <button
                      key={muscle}
                      type="button"
                      onClick={() => toggleMuscle(muscle)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        form.target_muscles.includes(muscle)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {muscle}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <DrawerFooter>
              <Button onClick={handleSave} className="w-full">
                {editingMachine ? 'Uložiť zmeny' : 'Pridať stroj'}
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

export default MachinesManagement;
