import { useState, useEffect } from 'react';
import { AlertTriangle, Loader2, Plus, Pencil, Trash2, Search, Dumbbell, Building2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import BusinessLayout from './BusinessLayout';
import { useGym, GymMachine } from '@/hooks/useGym';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { BenchConfigSelector, BENCH_CONFIGS } from '@/components/business/BenchConfigSelector';

interface Machine {
  id: string;
  name: string;
  description: string | null;
  requires_bench_config: boolean | null;
}

const GymMachines = () => {
  const { gym, gyms, gymMachines, isLoading, addMachine, updateMachine, removeMachine } = useGym();
  const [allMachines, setAllMachines] = useState<Machine[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [selectedGymMachine, setSelectedGymMachine] = useState<GymMachine | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [maxWeight, setMaxWeight] = useState<string>('');
  const [benchConfigs, setBenchConfigs] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Fetch all machines for selection
  useEffect(() => {
    const fetchMachines = async () => {
      const { data } = await supabase
        .from('machines')
        .select('id, name, description, requires_bench_config')
        .order('name');
      
      if (data) {
        setAllMachines(data);
      }
    };
    fetchMachines();
  }, []);

  const filteredMachines = allMachines.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !gymMachines.some(gm => gm.machine_id === m.id)
  );

  const handleAddMachine = async () => {
    if (!selectedMachine) return;
    setIsSubmitting(true);
    const result = await addMachine(
      selectedMachine.id,
      quantity,
      maxWeight ? parseFloat(maxWeight) : undefined,
      selectedMachine.requires_bench_config ? benchConfigs : undefined
    );
    setIsSubmitting(false);
    if (result.success) {
      setIsAddDrawerOpen(false);
      setSelectedMachine(null);
      setQuantity(1);
      setMaxWeight('');
      setBenchConfigs([]);
    }
  };

  const handleEditMachine = async () => {
    if (!selectedGymMachine) return;
    setIsSubmitting(true);
    const requiresBenchConfig = selectedGymMachine.machine?.requires_bench_config;
    const result = await updateMachine(
      selectedGymMachine.id,
      quantity,
      maxWeight ? parseFloat(maxWeight) : undefined,
      requiresBenchConfig ? benchConfigs : undefined
    );
    setIsSubmitting(false);
    if (result.success) {
      setIsEditDrawerOpen(false);
      setSelectedGymMachine(null);
      setBenchConfigs([]);
    }
  };

  const handleDeleteMachine = async () => {
    if (!deleteId) return;
    await removeMachine(deleteId);
    setDeleteId(null);
  };

  const openEditDrawer = (gm: GymMachine) => {
    setSelectedGymMachine(gm);
    setQuantity(gm.quantity);
    setMaxWeight(gm.max_weight_kg?.toString() || '');
    setBenchConfigs(gm.bench_configs || []);
    setIsEditDrawerOpen(true);
  };

  const getBenchConfigLabels = (configs: string[] | null) => {
    if (!configs || configs.length === 0) return null;
    return configs.map(c => BENCH_CONFIGS.find(bc => bc.value === c)?.label || c).join(', ');
  };

  if (isLoading) {
    return (
      <BusinessLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </BusinessLayout>
    );
  }

  if (!gym) {
    return (
      <BusinessLayout>
        <Alert variant="default" className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-200">
            Najprv vytvorte profil posilňovne
          </AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            Pre pridávanie strojov musíte mať vytvorený profil posilňovne.
          </AlertDescription>
        </Alert>
        <Button asChild className="w-full mt-4">
          <Link to="/business">Vytvoriť profil</Link>
        </Button>
      </BusinessLayout>
    );
  }

  return (
    <BusinessLayout>
      <div className="space-y-4">
        {/* Current Gym Indicator */}
        {gyms.length > 1 && (
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Stroje pre:</span>
            <Badge variant="secondary">{gym.name}</Badge>
            <Link to="/business" className="ml-auto text-xs text-primary hover:underline">
              Zmeniť
            </Link>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Stroje ({gymMachines.length})</h2>
          <Button size="sm" onClick={() => setIsAddDrawerOpen(true)} className="gap-1">
            <Plus className="w-4 h-4" />
            Pridať
          </Button>
        </div>

        {/* Machines List */}
        {gymMachines.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Dumbbell className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Zatiaľ nemáte pridané žiadne stroje</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setIsAddDrawerOpen(true)}
              >
                Pridať prvý stroj
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {gymMachines.map((gm) => (
              <Card key={gm.id}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{gm.machine?.name}</h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="secondary" className="text-xs">
                          {gm.quantity}x
                        </Badge>
                        {gm.max_weight_kg && (
                          <Badge variant="outline" className="text-xs">
                            max {gm.max_weight_kg} kg
                          </Badge>
                        )}
                        {gm.bench_configs && gm.bench_configs.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {getBenchConfigLabels(gm.bench_configs)}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => openEditDrawer(gm)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => setDeleteId(gm.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Add Machine Drawer */}
        <Drawer open={isAddDrawerOpen} onOpenChange={setIsAddDrawerOpen}>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader>
              <DrawerTitle>Pridať stroj</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-8 overflow-y-auto space-y-4">
              {!selectedMachine ? (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Hľadať stroj..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                    {filteredMachines.map((machine) => (
                      <Card 
                        key={machine.id} 
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setSelectedMachine(machine)}
                      >
                        <CardContent className="py-3 px-4">
                          <h4 className="font-medium">{machine.name}</h4>
                          {machine.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {machine.description}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                    {filteredMachines.length === 0 && (
                      <p className="text-center text-muted-foreground py-4">
                        Žiadne stroje nenájdené
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <Button 
                    variant="ghost" 
                    onClick={() => setSelectedMachine(null)}
                    className="mb-2"
                  >
                    ← Vybrať iný stroj
                  </Button>
                  <Card>
                    <CardContent className="py-3 px-4">
                      <h4 className="font-medium">{selectedMachine.name}</h4>
                      {selectedMachine.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {selectedMachine.description}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Počet kusov</Label>
                      <Input
                        type="number"
                        min={1}
                        value={quantity}
                        onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Maximálna váha (kg)</Label>
                      <Input
                        type="number"
                        placeholder="Nepovinné"
                        value={maxWeight}
                        onChange={(e) => setMaxWeight(e.target.value)}
                      />
                    </div>
                    {selectedMachine?.requires_bench_config && (
                      <BenchConfigSelector
                        selectedConfigs={benchConfigs}
                        onChange={setBenchConfigs}
                      />
                    )}
                    <Button 
                      className="w-full" 
                      onClick={handleAddMachine}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Pridávanie...
                        </>
                      ) : (
                        'Pridať stroj'
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </DrawerContent>
        </Drawer>

        {/* Edit Machine Drawer */}
        <Drawer open={isEditDrawerOpen} onOpenChange={setIsEditDrawerOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Upraviť stroj</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-8 space-y-4">
              {selectedGymMachine && (
                <>
                  <Card>
                    <CardContent className="py-3 px-4">
                      <h4 className="font-medium">{selectedGymMachine.machine?.name}</h4>
                    </CardContent>
                  </Card>
                  <div className="space-y-2">
                    <Label>Počet kusov</Label>
                    <Input
                      type="number"
                      min={1}
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Maximálna váha (kg)</Label>
                    <Input
                      type="number"
                      placeholder="Nepovinné"
                      value={maxWeight}
                      onChange={(e) => setMaxWeight(e.target.value)}
                    />
                  </div>
                  {selectedGymMachine.machine?.requires_bench_config && (
                    <BenchConfigSelector
                      selectedConfigs={benchConfigs}
                      onChange={setBenchConfigs}
                    />
                  )}
                  <Button
                    className="w-full" 
                    onClick={handleEditMachine}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Ukladanie...
                      </>
                    ) : (
                      'Uložiť zmeny'
                    )}
                  </Button>
                </>
              )}
            </div>
          </DrawerContent>
        </Drawer>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Odstrániť stroj?</AlertDialogTitle>
              <AlertDialogDescription>
                Táto akcia je nezvratná. Stroj bude odstránený z vašej posilňovne.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Zrušiť</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteMachine}>
                Odstrániť
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </BusinessLayout>
  );
};

export default GymMachines;
