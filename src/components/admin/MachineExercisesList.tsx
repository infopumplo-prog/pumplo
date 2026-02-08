import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, X, Plus, Link2, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { MachineExercise } from '@/hooks/useMachineExercises';
import { getEquipmentTypeLabel } from '@/lib/equipmentTypes';

interface Machine {
  id: string;
  name: string;
  equipment_category: string;
}

interface MachineExercisesListProps {
  exercises: MachineExercise[];
  machines: Machine[];
  currentMachineId: string;
  isLoading: boolean;
  onUpdateSecondary: (exerciseId: string, newSecondaryId: string | null) => Promise<boolean>;
}

const MachineExercisesList = ({
  exercises,
  machines,
  currentMachineId,
  isLoading,
  onUpdateSecondary,
}: MachineExercisesListProps) => {
  const navigate = useNavigate();
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Filter machines suitable for secondary (accessories like benches)
  const accessoryMachines = machines.filter(
    (m) => m.equipment_category === 'accessory' || m.equipment_category === 'free_weight'
  );

  const handleSetSecondary = async (exerciseId: string, machineId: string) => {
    setIsSaving(true);
    const success = await onUpdateSecondary(exerciseId, machineId || null);
    if (success) {
      toast.success('Sekundární vybavení nastaveno');
    } else {
      toast.error('Chyba při ukládání');
    }
    setEditingExerciseId(null);
    setIsSaving(false);
  };

  const handleRemoveSecondary = async (exerciseId: string) => {
    setIsSaving(true);
    const success = await onUpdateSecondary(exerciseId, null);
    if (success) {
      toast.success('Sekundární vybavení odebráno');
    } else {
      toast.error('Chyba při ukládání');
    }
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (exercises.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Žádné cviky nejsou napojeny na tento stroj
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <Link2 className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">
          Napojené cviky ({exercises.length})
        </span>
      </div>

      <div className="max-h-[300px] overflow-y-auto space-y-2">
        {exercises.map((exercise) => (
          <div
            key={exercise.id}
            className="p-3 bg-muted/50 rounded-lg space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">{exercise.name}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => navigate(`/admin/exercises?edit=${exercise.id}`)}
                    title="Otevřít cvik"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </div>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {exercise.equipment_type && (
                    <Badge variant="outline" className="text-xs">
                      {getEquipmentTypeLabel(exercise.equipment_type)}
                    </Badge>
                  )}
                  {!exercise.is_primary && (
                    <Badge variant="secondary" className="text-xs">
                      jako sekundární
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Secondary machine section - only show for primary connections */}
            {exercise.is_primary && (
              <div className="pt-2 border-t border-border/50">
                {exercise.secondary_machine_id ? (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">+</span>
                      <Badge variant="default" className="text-xs">
                        {exercise.secondary_machine_name}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={isSaving}
                      onClick={() => handleRemoveSecondary(exercise.id)}
                    >
                      <X className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                ) : editingExerciseId === exercise.id ? (
                  <Select
                    onValueChange={(value) => handleSetSecondary(exercise.id, value)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Vybrat sekundární vybavení..." />
                    </SelectTrigger>
                    <SelectContent>
                      {accessoryMachines
                        .filter((m) => m.id !== currentMachineId)
                        .map((machine) => (
                          <SelectItem key={machine.id} value={machine.id}>
                            {machine.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => setEditingExerciseId(exercise.id)}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Přidat sekundární vybavení
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MachineExercisesList;
