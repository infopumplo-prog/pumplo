import { useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Machine {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  equipment_category: string;
  is_cardio: boolean;
  created_at: string;
}

interface MachineWithUsage extends Machine {
  exerciseCount: number;
  gymCount: number;
}

interface DuplicateGroup {
  name: string;
  items: MachineWithUsage[];
}

export const useDuplicateMachines = (machines: Machine[], onMergeComplete: () => void) => {
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [selectedPrimary, setSelectedPrimary] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isMerging, setIsMerging] = useState(false);

  const findDuplicates = useCallback(async () => {
    setIsLoading(true);
    
    try {
      // Group machines by name (case-insensitive)
      const nameGroups = machines.reduce((acc, m) => {
        const key = m.name.toLowerCase().trim();
        if (!acc[key]) acc[key] = [];
        acc[key].push(m);
        return acc;
      }, {} as Record<string, Machine[]>);
      
      // Filter only groups with duplicates
      const duplicateEntries = Object.entries(nameGroups)
        .filter(([_, items]) => items.length > 1);
      
      if (duplicateEntries.length === 0) {
        setDuplicateGroups([]);
        setIsLoading(false);
        return;
      }
      
      // Get all machine IDs that are duplicates
      const allDuplicateIds = duplicateEntries.flatMap(([_, items]) => items.map(m => m.id));
      
      // Fetch usage counts in parallel
      const [exercisesResult, gymMachinesResult] = await Promise.all([
        supabase
          .from('exercises')
          .select('machine_id')
          .in('machine_id', allDuplicateIds),
        supabase
          .from('gym_machines')
          .select('machine_id')
          .in('machine_id', allDuplicateIds),
      ]);
      
      // Count exercises per machine
      const exerciseCounts: Record<string, number> = {};
      (exercisesResult.data || []).forEach(e => {
        exerciseCounts[e.machine_id] = (exerciseCounts[e.machine_id] || 0) + 1;
      });
      
      // Count gyms per machine
      const gymCounts: Record<string, number> = {};
      (gymMachinesResult.data || []).forEach(gm => {
        gymCounts[gm.machine_id] = (gymCounts[gm.machine_id] || 0) + 1;
      });
      
      // Build groups with usage data
      const groups: DuplicateGroup[] = duplicateEntries.map(([name, items]) => ({
        name: items[0].name, // Use original case from first item
        items: items.map(m => ({
          ...m,
          exerciseCount: exerciseCounts[m.id] || 0,
          gymCount: gymCounts[m.id] || 0,
        })).sort((a, b) => {
          // Sort by usage (most used first)
          const aTotal = a.exerciseCount + a.gymCount;
          const bTotal = b.exerciseCount + b.gymCount;
          return bTotal - aTotal;
        }),
      }));
      
      // Auto-select the most used machine as primary
      const autoSelected: Record<string, string> = {};
      groups.forEach(group => {
        autoSelected[group.name] = group.items[0].id;
      });
      
      setDuplicateGroups(groups);
      setSelectedPrimary(autoSelected);
    } catch (error) {
      console.error('Error finding duplicates:', error);
      toast.error('Chyba při hledání duplicit');
    } finally {
      setIsLoading(false);
    }
  }, [machines]);

  const mergeDuplicates = useCallback(async (groupName: string) => {
    const primaryId = selectedPrimary[groupName];
    const group = duplicateGroups.find(g => g.name === groupName);
    
    if (!group || !primaryId) {
      toast.error('Vyberte primární stroj');
      return;
    }
    
    const duplicateIds = group.items
      .filter(m => m.id !== primaryId)
      .map(m => m.id);
    
    if (duplicateIds.length === 0) return;
    
    setIsMerging(true);
    
    try {
      // 1. Update exercises.machine_id (NOT secondary_machine_id!)
      const { error: exerciseError } = await supabase
        .from('exercises')
        .update({ machine_id: primaryId })
        .in('machine_id', duplicateIds);
      
      if (exerciseError) throw exerciseError;
      
      // 2. Handle gym_machines with conflict detection
      for (const dupId of duplicateIds) {
        // Find all gym_machines that reference this duplicate
        const { data: gymMachineRecords } = await supabase
          .from('gym_machines')
          .select('id, gym_id')
          .eq('machine_id', dupId);
        
        for (const record of gymMachineRecords || []) {
          // Check if this gym already has the primary machine
          const { data: existingPrimary } = await supabase
            .from('gym_machines')
            .select('id')
            .eq('gym_id', record.gym_id)
            .eq('machine_id', primaryId)
            .maybeSingle();
          
          if (existingPrimary) {
            // Gym already has primary machine - delete the duplicate reference
            await supabase
              .from('gym_machines')
              .delete()
              .eq('id', record.id);
          } else {
            // Update to point to primary machine
            await supabase
              .from('gym_machines')
              .update({ machine_id: primaryId })
              .eq('id', record.id);
          }
        }
      }
      
      // 3. Delete duplicate machines
      const { error: deleteError } = await supabase
        .from('machines')
        .delete()
        .in('id', duplicateIds);
      
      if (deleteError) throw deleteError;
      
      toast.success(`Sloučeno ${duplicateIds.length + 1} strojů do jednoho`);
      
      // Refresh data
      onMergeComplete();
      
      // Remove merged group from state
      setDuplicateGroups(prev => prev.filter(g => g.name !== groupName));
      
    } catch (error) {
      console.error('Error merging duplicates:', error);
      toast.error('Chyba při slučování duplicit');
    } finally {
      setIsMerging(false);
    }
  }, [selectedPrimary, duplicateGroups, onMergeComplete]);

  const selectPrimary = useCallback((groupName: string, machineId: string) => {
    setSelectedPrimary(prev => ({ ...prev, [groupName]: machineId }));
  }, []);

  return {
    duplicateGroups,
    selectedPrimary,
    isLoading,
    isMerging,
    findDuplicates,
    mergeDuplicates,
    selectPrimary,
  };
};
