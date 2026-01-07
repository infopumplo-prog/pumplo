import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Pencil, Trash2, Plus, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import AdminLayout from './AdminLayout';

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

const MachinesManagement = () => {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
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

  const openAddDialog = () => {
    setEditingMachine(null);
    setForm({
      name: '',
      description: '',
      equipment_type: 'machine',
      target_muscles: [],
    });
    setDialogOpen(true);
  };

  const openEditDialog = (machine: Machine) => {
    setEditingMachine(machine);
    setForm({
      name: machine.name,
      description: machine.description || '',
      equipment_type: machine.equipment_type,
      target_muscles: machine.target_muscles || [],
    });
    setDialogOpen(true);
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

    setDialogOpen(false);
    fetchMachines();
  };

  const handleDelete = async (id: string) => {
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

  const filteredMachines = machines.filter((machine) => {
    const matchesSearch = machine.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || machine.equipment_type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-foreground">Stroje</h2>
          <Button onClick={openAddDialog} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Pridať
          </Button>
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
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40">
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

        {/* Machines Table */}
        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Názov</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Svaly</TableHead>
                    <TableHead className="text-right">Akcie</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMachines.map((machine) => (
                    <TableRow key={machine.id}>
                      <TableCell>
                        <p className="font-medium">{machine.name}</p>
                        {machine.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {machine.description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="px-2 py-1 rounded-full text-xs bg-muted">
                          {EQUIPMENT_TYPES.find((t) => t.value === machine.equipment_type)?.label ||
                            machine.equipment_type}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[150px]">
                          {machine.target_muscles.slice(0, 3).map((muscle) => (
                            <span
                              key={muscle}
                              className="px-1.5 py-0.5 rounded text-xs bg-primary/10 text-primary"
                            >
                              {muscle}
                            </span>
                          ))}
                          {machine.target_muscles.length > 3 && (
                            <span className="text-xs text-muted-foreground">
                              +{machine.target_muscles.length - 3}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(machine)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(machine.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        <p className="text-sm text-muted-foreground text-center">
          {filteredMachines.length} z {machines.length} strojov
        </p>

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingMachine ? 'Upraviť stroj' : 'Pridať stroj'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
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
              <Button onClick={handleSave} className="w-full">
                {editingMachine ? 'Uložiť zmeny' : 'Pridať stroj'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default MachinesManagement;
