import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import { Pencil, Trash2, Plus, Search, Loader2, ChevronRight, Dumbbell, Cog, Box, GitMerge, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import AdminLayout from './AdminLayout';
import MobileCard from '@/components/admin/MobileCard';
import AdminPagination from '@/components/admin/AdminPagination';
import DuplicateMachinesDrawer from '@/components/admin/DuplicateMachinesDrawer';
import MachineExercisesList from '@/components/admin/MachineExercisesList';
import { useDuplicateMachines } from '@/hooks/useDuplicateMachines';
import { useMachineExercises } from '@/hooks/useMachineExercises';

interface Machine {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  equipment_category: string;
  is_cardio: boolean;
  created_at: string;
}

const ITEMS_PER_PAGE = 100;

const EQUIPMENT_CATEGORIES = [
  { value: 'machine', label: 'Stroj', icon: Cog },
  { value: 'free_weight', label: 'Volná váha', icon: Dumbbell },
  { value: 'accessory', label: 'Příslušenství', icon: Box },
] as const;

const getCategoryLabel = (value: string) => {
  const cat = EQUIPMENT_CATEGORIES.find(c => c.value === value);
  return cat?.label || value;
};

const getCategoryVariant = (value: string): 'default' | 'secondary' | 'outline' => {
  switch (value) {
    case 'machine': return 'default';
    case 'free_weight': return 'secondary';
    case 'accessory': return 'outline';
    default: return 'default';
  }
};

const MachinesManagement = () => {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [form, setForm] = useState({
    name: '',
    description: '',
    equipment_category: 'machine',
    is_cardio: false,
  });
  const [duplicatesDrawerOpen, setDuplicatesDrawerOpen] = useState(false);

  const fetchMachines = useCallback(async () => {
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
  }, []);

  const {
    duplicateGroups,
    selectedPrimary,
    isLoading: isDuplicatesLoading,
    isMerging,
    findDuplicates,
    mergeDuplicates,
    selectPrimary,
  } = useDuplicateMachines(machines, fetchMachines);

  // Fetch exercises linked to the currently edited machine
  const {
    exercises: linkedExercises,
    isLoading: isExercisesLoading,
    updateSecondaryMachine,
  } = useMachineExercises(editingMachine?.id || null);

  useEffect(() => {
    fetchMachines();
  }, []);

  // Filter machines based on search and category
  const filteredMachines = useMemo(() => {
    return machines.filter((machine) => {
      const matchesSearch = machine.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || machine.equipment_category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [machines, searchTerm, categoryFilter]);

  // Paginate filtered results
  const totalPages = Math.ceil(filteredMachines.length / ITEMS_PER_PAGE);
  const paginatedMachines = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredMachines.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredMachines, currentPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter]);

  const openDuplicatesDrawer = async () => {
    setDuplicatesDrawerOpen(true);
    await findDuplicates();
  };

  const openAddDrawer = () => {
    setEditingMachine(null);
    setForm({
      name: '',
      description: '',
      equipment_category: 'machine',
      is_cardio: false,
    });
    setDrawerOpen(true);
  };

  const openEditDrawer = (machine: Machine) => {
    setEditingMachine(machine);
    setForm({
      name: machine.name,
      description: machine.description || '',
      equipment_category: machine.equipment_category || 'machine',
      is_cardio: machine.is_cardio || false,
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
          equipment_category: form.equipment_category,
          is_cardio: form.is_cardio,
        })
        .eq('id', editingMachine.id);

      if (error) {
        toast.error('Chyba při ukladaní');
        return;
      }
      toast.success('Stroj aktualizovaný');
    } else {
      const { error } = await supabase.from('machines').insert({
        name: form.name,
        description: form.description || null,
        equipment_category: form.equipment_category,
        is_cardio: form.is_cardio,
      });

      if (error) {
        toast.error('Chyba při vytváraní');
        return;
      }
      toast.success('Stroj přidaný');
    }

    setDrawerOpen(false);
    fetchMachines();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from('machines').delete().eq('id', id);

    if (error) {
      toast.error('Chyba při mazaní');
      return;
    }

    toast.success('Stroj vymazaný');
    fetchMachines();
  };

  // Category stats
  const categoryStats = useMemo(() => {
    const stats = { machine: 0, free_weight: 0, accessory: 0 };
    machines.forEach(m => {
      const cat = m.equipment_category as keyof typeof stats;
      if (stats[cat] !== undefined) stats[cat]++;
    });
    return stats;
  }, [machines]);

  // Bulk fix categories based on name patterns
  const handleFixCategories = async () => {
    const updates: { id: string; category: string }[] = [];

    machines.forEach((m) => {
      const nameLower = m.name.toLowerCase();
      let newCategory: string | null = null;

      // Free weights
      if (
        nameLower.includes('dumbbell') ||
        nameLower.includes('barbell') ||
        nameLower.includes('kettlebell') ||
        nameLower.includes('ez bar') ||
        nameLower.includes('olympic bar')
      ) {
        newCategory = 'free_weight';
      }
      // Accessories
      else if (
        nameLower.includes('bench') ||
        nameLower.includes('mat') ||
        nameLower.includes('roller') ||
        nameLower.includes('ball') ||
        nameLower.includes('step')
      ) {
        newCategory = 'accessory';
      }

      if (newCategory && m.equipment_category !== newCategory) {
        updates.push({ id: m.id, category: newCategory });
      }
    });

    if (updates.length === 0) {
      toast.info('Všechny kategorie jsou již správné');
      return;
    }

    let successCount = 0;
    for (const update of updates) {
      const { error } = await supabase
        .from('machines')
        .update({ equipment_category: update.category })
        .eq('id', update.id);

      if (!error) successCount++;
    }

    toast.success(`Opraveno ${successCount} z ${updates.length} strojů`);
    fetchMachines();
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Stroje</h2>
          <div className="flex gap-2">
            <Button onClick={handleFixCategories} size="sm" variant="outline">
              <Wand2 className="w-4 h-4 mr-1" />
              Fix
            </Button>
            <Button onClick={openDuplicatesDrawer} size="sm" variant="outline">
              <GitMerge className="w-4 h-4 mr-1" />
              Duplicity
            </Button>
            <Button onClick={openAddDrawer} size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Pridať
            </Button>
          </div>
        </div>

        {/* Category Stats */}
        <div className="flex gap-2 flex-wrap">
          {EQUIPMENT_CATEGORIES.map(cat => (
            <Badge 
              key={cat.value} 
              variant={getCategoryVariant(cat.value)}
              className="cursor-pointer"
              onClick={() => setCategoryFilter(categoryFilter === cat.value ? 'all' : cat.value)}
            >
              <cat.icon className="w-3 h-3 mr-1" />
              {cat.label}: {categoryStats[cat.value as keyof typeof categoryStats]}
            </Badge>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Hľadať stroj..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Kategorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny</SelectItem>
              {EQUIPMENT_CATEGORIES.map(cat => (
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
            {paginatedMachines.map((machine) => (
              <MobileCard key={machine.id} onClick={() => openEditDrawer(machine)}>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{machine.name}</p>
                      <Badge variant={getCategoryVariant(machine.equipment_category)} className="text-xs">
                        {getCategoryLabel(machine.equipment_category)}
                      </Badge>
                      {machine.is_cardio && (
                        <Badge variant="outline" className="text-xs">
                          Kardio
                        </Badge>
                      )}
                    </div>
                    {machine.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {machine.description}
                      </p>
                    )}
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
                {editingMachine ? 'Upravit stroj' : 'Přidat stroj'}
              </DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-4 space-y-4 overflow-y-auto">
              <div>
                <Label>Název</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              
              <div>
                <Label>Kategorie vybavení</Label>
                <Select
                  value={form.equipment_category}
                  onValueChange={(value) => setForm({ ...form, equipment_category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EQUIPMENT_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between py-2">
                <Label htmlFor="is-cardio">Kardio vybavení</Label>
                <Switch
                  id="is-cardio"
                  checked={form.is_cardio}
                  onCheckedChange={(checked) => setForm({ ...form, is_cardio: checked })}
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

              {/* Linked exercises section - only show when editing */}
              {editingMachine && (
                <div className="pt-4 border-t">
                  <MachineExercisesList
                    exercises={linkedExercises}
                    machines={machines}
                    currentMachineId={editingMachine.id}
                    isLoading={isExercisesLoading}
                    onUpdateSecondary={updateSecondaryMachine}
                  />
                </div>
              )}
            </div>
            <DrawerFooter>
              <Button onClick={handleSave} className="w-full">
                {editingMachine ? 'Uložit změny' : 'Přidat stroj'}
              </Button>
              <DrawerClose asChild>
                <Button variant="outline">Zrušit</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        {/* Duplicates Drawer */}
        <DuplicateMachinesDrawer
          open={duplicatesDrawerOpen}
          onOpenChange={setDuplicatesDrawerOpen}
          duplicateGroups={duplicateGroups}
          selectedPrimary={selectedPrimary}
          isLoading={isDuplicatesLoading}
          isMerging={isMerging}
          onSelectPrimary={selectPrimary}
          onMerge={mergeDuplicates}
        />
      </div>
    </AdminLayout>
  );
};

export default MachinesManagement;
