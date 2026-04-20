import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Loader2, ChevronDown, ChevronUp, Dumbbell, Building2, Search } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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

interface EditState {
  quantity: string;
  maxWeight: string;
  brand: string;
}

export const GYM_EQUIPMENT_BRANDS = [
  'Life Fitness',
  'Technogym',
  'Precor',
  'Matrix Fitness',
  'Hammer Strength',
  'Cybex',
  'Star Trac',
  'Body-Solid',
  'Panatta',
  'ZIVA',
  'Bootybuilder',
  'Keiser',
  'Concept2',
  'Eleiko',
  'York Barbell',
  'Rogue',
  'Watson',
  'Atlantis',
  'Inspire Fitness',
  'FreeMotion',
  'Hoist',
  'Nautilus',
  'StairMaster',
  'True Fitness',
  'Woodway',
  'Valor Fitness',
  'Gymmaster',
  'Jiná značka',
];

const GymMachines = () => {
  const { gym, gyms, gymMachines, isLoading, addMachine, updateMachine, removeMachine } = useGym();
  const [allMachines, setAllMachines] = useState<Machine[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<Record<string, boolean>>({});
  const [editState, setEditState] = useState<Record<string, EditState>>({});

  useEffect(() => {
    const fetchMachines = async () => {
      const { data } = await supabase
        .from('machines')
        .select('id, name, description, requires_bench_config')
        .order('name');
      if (data) setAllMachines(data);
    };
    fetchMachines();
  }, []);

  // Sync editState when gymMachines loads (only for machines not yet in editState)
  useEffect(() => {
    setEditState(prev => {
      const next = { ...prev };
      gymMachines.forEach(gm => {
        if (!next[gm.machine_id]) {
          next[gm.machine_id] = {
            quantity: gm.quantity.toString(),
            maxWeight: gm.max_weight_kg?.toString() || '',
            brand: gm.brand || '',
          };
        }
      });
      return next;
    });
  }, [gymMachines]);

  const getGymMachine = useCallback(
    (machineId: string): GymMachine | undefined =>
      gymMachines.find(gm => gm.machine_id === machineId),
    [gymMachines]
  );

  const handleToggle = async (machine: Machine) => {
    const gm = getGymMachine(machine.id);
    setIsSubmitting(prev => ({ ...prev, [machine.id]: true }));
    if (gm) {
      await removeMachine(gm.id);
      setEditState(prev => {
        const next = { ...prev };
        delete next[machine.id];
        return next;
      });
      if (expandedId === machine.id) setExpandedId(null);
    } else {
      await addMachine(machine.id, 1);
      setEditState(prev => ({
        ...prev,
        [machine.id]: { quantity: '1', maxWeight: '', brand: '' },
      }));
    }
    setIsSubmitting(prev => ({ ...prev, [machine.id]: false }));
  };

  const saveEdits = async (machineId: string) => {
    const gm = getGymMachine(machineId);
    if (!gm) return;
    const state = editState[machineId];
    if (!state) return;
    const qty = parseInt(state.quantity) || 1;
    const maxW = state.maxWeight ? parseFloat(state.maxWeight) : undefined;
    const benchCfgs = gm.bench_configs || undefined;
    const brand = state.brand || undefined;
    await updateMachine(gm.id, qty, maxW, benchCfgs, brand);
  };

  const updateField = (machineId: string, field: keyof EditState, value: string) => {
    setEditState(prev => ({
      ...prev,
      [machineId]: { ...(prev[machineId] || { quantity: '1', maxWeight: '', brand: '' }), [field]: value },
    }));
  };

  const filteredMachines = allMachines.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            Pre správu strojov musíte mať vytvorený profil posilňovne.
          </AlertDescription>
        </Alert>
        <Link to="/business" className="block mt-4 w-full text-center py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium">
          Vytvoriť profil
        </Link>
      </BusinessLayout>
    );
  }

  return (
    <BusinessLayout>
      <div className="space-y-4">
        {gyms.length > 1 && (
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Stroje pre:</span>
            <Badge variant="secondary">{gym.name}</Badge>
            <Link to="/business" className="ml-auto text-xs text-primary hover:underline">Zmeniť</Link>
          </div>
        )}

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Dumbbell className="w-5 h-5" />
            Vybavení ({gymMachines.length})
          </h2>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Hledat vybavení..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="space-y-2">
          {filteredMachines.map(machine => {
            const gm = getGymMachine(machine.id);
            const isChecked = !!gm;
            const isExpanded = expandedId === machine.id;
            const isBusy = !!isSubmitting[machine.id];
            const state = editState[machine.id] || { quantity: '1', maxWeight: '', brand: '' };

            return (
              <div
                key={machine.id}
                className={`rounded-lg border transition-colors ${isChecked ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'}`}
              >
                {/* Main row */}
                <div className="flex items-center gap-3 px-3 py-2.5">
                  {isBusy ? (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />
                  ) : (
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => handleToggle(machine)}
                      className="shrink-0"
                    />
                  )}

                  <span
                    className="flex-1 text-sm font-medium cursor-pointer select-none"
                    onClick={() => handleToggle(machine)}
                  >
                    {machine.name}
                  </span>

                  {isChecked && (
                    <Input
                      type="number"
                      min={1}
                      value={state.quantity}
                      onChange={e => updateField(machine.id, 'quantity', e.target.value)}
                      onBlur={() => saveEdits(machine.id)}
                      className="w-16 h-8 text-center text-sm px-1"
                      onClick={e => e.stopPropagation()}
                    />
                  )}

                  {isChecked && (
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : machine.id)}
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  )}
                </div>

                {/* Expanded section */}
                {isChecked && isExpanded && (
                  <div className="px-3 pb-3 pt-0 border-t border-border/50 space-y-3">
                    <div className="flex gap-3 pt-3">
                      <div className="flex-1 space-y-1">
                        <label className="text-xs text-muted-foreground">Max váha (kg)</label>
                        <Input
                          type="number"
                          placeholder="Nepovinné"
                          value={state.maxWeight}
                          onChange={e => updateField(machine.id, 'maxWeight', e.target.value)}
                          onBlur={() => saveEdits(machine.id)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <label className="text-xs text-muted-foreground">Značka</label>
                        <select
                          value={state.brand}
                          onChange={e => {
                            updateField(machine.id, 'brand', e.target.value);
                            setTimeout(() => saveEdits(machine.id), 0);
                          }}
                          className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
                        >
                          <option value="">— Vybrat —</option>
                          {GYM_EQUIPMENT_BRANDS.map(b => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {machine.requires_bench_config && gm && (
                      <BenchConfigSelector
                        selectedConfigs={gm.bench_configs || []}
                        onChange={async configs => {
                          const qty = parseInt(state.quantity) || 1;
                          const maxW = state.maxWeight ? parseFloat(state.maxWeight) : undefined;
                          await updateMachine(gm.id, qty, maxW, configs, state.brand || undefined);
                        }}
                      />
                    )}

                    {gm?.bench_configs && gm.bench_configs.length > 0 && !machine.requires_bench_config && (
                      <p className="text-xs text-muted-foreground">
                        {getBenchConfigLabels(gm.bench_configs)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {filteredMachines.length === 0 && (
            <p className="text-center text-muted-foreground py-8 text-sm">
              Žiadne stroje nenájdené
            </p>
          )}
        </div>
      </div>
    </BusinessLayout>
  );
};

export default GymMachines;
