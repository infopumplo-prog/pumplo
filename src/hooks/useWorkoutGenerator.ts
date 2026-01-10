import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TrainingRoleId } from '@/lib/trainingRoles';
import { TrainingGoalId, UserLevel, DayTemplate, DayTemplateSlot } from '@/lib/trainingGoals';

interface Exercise {
  id: string;
  name: string;
  primary_role: string | null;
  secondary_role: string | null;
  difficulty: number | null;
  requires_machine: boolean | null;
  machine_id: string | null;
  contraindicated_injuries: string[] | null;
  equipment: string[] | null;
}

interface AssignedExercise {
  exercise: Exercise | null;
  isFallback: boolean;
  fallbackReason: string | null;
}

export const useWorkoutGenerator = () => {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Map user level to difficulty number
  const getLevelNumber = (level: UserLevel): number => {
    switch (level) {
      case 'beginner': return 1;
      case 'intermediate': return 2;
      case 'advanced': return 3;
      default: return 1;
    }
  };

  // Get sets for user level
  const getSetsForLevel = (slot: DayTemplateSlot, level: UserLevel): number => {
    switch (level) {
      case 'beginner': return slot.beginnerSets;
      case 'intermediate': return slot.intermediateSets;
      case 'advanced': return slot.advancedSets;
      default: return slot.beginnerSets;
    }
  };

  // Assign exercise for a specific role
  const assignExerciseForRole = useCallback(async (
    role: string,
    gymId: string,
    userLevel: UserLevel,
    userInjuries: string[],
    usedExerciseIds: string[],
    equipmentPreference: string | null
  ): Promise<AssignedExercise> => {
    const levelNumber = getLevelNumber(userLevel);
    
    // 1. Get gym equipment
    const { data: gymMachines } = await supabase
      .from('gym_machines')
      .select('machine_id, machines(id, equipment_type)')
      .eq('gym_id', gymId);
    
    const availableMachineIds = gymMachines?.map(m => m.machine_id).filter(Boolean) || [];
    const rawEquipmentTypes = gymMachines?.map(m => (m.machines as any)?.equipment_type).filter(Boolean) || [];
    
    // Expand equipment types to include sub-types
    // e.g. 'free_weights' should match 'barbell', 'dumbbell', 'kettlebell'
    const expandedEquipment = new Set<string>(rawEquipmentTypes);
    if (rawEquipmentTypes.includes('free_weights')) {
      expandedEquipment.add('barbell');
      expandedEquipment.add('dumbbell');
      expandedEquipment.add('kettlebell');
    }
    // Machine types often include plate loaded machines too
    if (rawEquipmentTypes.includes('machine') || rawEquipmentTypes.includes('plate_loaded')) {
      expandedEquipment.add('machine');
      expandedEquipment.add('plate_loaded');
    }
    // Always include bodyweight as available
    expandedEquipment.add('bodyweight');
    
    const availableEquipmentTypes = Array.from(expandedEquipment);
    
    // 2. Get exercises with primary_role
    const { data: exercises, error: exError } = await supabase
      .from('exercises')
      .select('*')
      .eq('primary_role', role);
    
    if (exError || !exercises) {
      console.error('Error fetching exercises:', exError);
      return { exercise: null, isFallback: false, fallbackReason: 'db_error' };
    }

    // 3. Filter exercises
    const activeInjuries = userInjuries.filter(i => i && i !== 'none');
    
    let filteredExercises = exercises.filter(ex => {
      // Filter by difficulty
      if (ex.difficulty && ex.difficulty > levelNumber * 2) return false;
      
      // Filter by injuries - check both singular and plural forms
      if (activeInjuries.length > 0 && ex.contraindicated_injuries && ex.contraindicated_injuries.length > 0) {
        const normalizedInjuries = activeInjuries.map(i => i.toLowerCase());
        const hasContraindication = ex.contraindicated_injuries.some((injury: string) => {
          const normalizedInjury = injury.toLowerCase();
          return normalizedInjuries.some(userInjury => 
            normalizedInjury.includes(userInjury) || 
            userInjury.includes(normalizedInjury) ||
            // Check singular/plural variants
            normalizedInjury === userInjury.replace(/s$/, '') ||
            normalizedInjury + 's' === userInjury
          );
        });
        if (hasContraindication) return false;
      }
      
      // Filter by already used
      if (usedExerciseIds.includes(ex.id)) return false;
      
      // Filter by equipment availability
      const exerciseEquipment = ex.equipment || [];
      
      // Bodyweight exercises are always available
      if (exerciseEquipment.includes('bodyweight')) {
        return true;
      }
      
      // Free weights (barbell, dumbbell, kettlebell) - check equipment array, IGNORE machine_id
      const isFreeWeightsExercise = exerciseEquipment.some(eq => 
        ['barbell', 'dumbbell', 'kettlebell', 'free_weights'].includes(eq)
      );
      
      if (isFreeWeightsExercise) {
        // Check if gym has free_weights equipment type - expand to specific types
        const hasBarbell = availableEquipmentTypes.includes('barbell') || rawEquipmentTypes.includes('free_weights');
        const hasDumbbell = availableEquipmentTypes.includes('dumbbell') || rawEquipmentTypes.includes('free_weights');
        const hasKettlebell = availableEquipmentTypes.includes('kettlebell') || rawEquipmentTypes.includes('free_weights');
        
        if (exerciseEquipment.includes('barbell') && hasBarbell) return true;
        if (exerciseEquipment.includes('dumbbell') && hasDumbbell) return true;
        if (exerciseEquipment.includes('kettlebell') && hasKettlebell) return true;
        if (exerciseEquipment.includes('free_weights') && (hasBarbell || hasDumbbell || hasKettlebell)) return true;
        
        return false;
      }
      
      // Cable exercises
      const isCableExercise = exerciseEquipment.includes('cable');
      if (isCableExercise) {
        return availableEquipmentTypes.includes('cable') || 
               rawEquipmentTypes.includes('machine'); // cable stations often counted as machines
      }
      
      // Actual machine exercises that REQUIRE a specific machine - check machine_id
      if (ex.requires_machine && ex.machine_id) {
        return availableMachineIds.includes(ex.machine_id);
      }
      
      // Default: check if any equipment matches
      if (exerciseEquipment.length > 0) {
        return exerciseEquipment.some(eq => availableEquipmentTypes.includes(eq));
      }
      
      return true;
    });

    // 4. Sort/prioritize based on equipment preference
    if (filteredExercises.length > 0) {
      let sortedExercises = [...filteredExercises];
      
      if (equipmentPreference === 'machines') {
        // Prefer machine exercises, then cable, then others
        sortedExercises.sort((a, b) => {
          const aIsMachine = a.requires_machine || a.equipment?.includes('machine') || a.equipment?.includes('cable') || a.machine_id;
          const bIsMachine = b.requires_machine || b.equipment?.includes('machine') || b.equipment?.includes('cable') || b.machine_id;
          if (aIsMachine && !bIsMachine) return -1;
          if (!aIsMachine && bIsMachine) return 1;
          return 0;
        });
      } else if (equipmentPreference === 'bodyweight') {
        // Prefer bodyweight exercises
        sortedExercises.sort((a, b) => {
          const aIsBodyweight = a.equipment?.includes('bodyweight');
          const bIsBodyweight = b.equipment?.includes('bodyweight');
          if (aIsBodyweight && !bIsBodyweight) return -1;
          if (!aIsBodyweight && bIsBodyweight) return 1;
          return 0;
        });
      } else if (equipmentPreference === 'free_weights') {
        // Prefer free weights
        sortedExercises.sort((a, b) => {
          const aIsFreeWeights = a.equipment?.some(eq => ['barbell', 'dumbbell', 'kettlebell', 'free_weights'].includes(eq));
          const bIsFreeWeights = b.equipment?.some(eq => ['barbell', 'dumbbell', 'kettlebell', 'free_weights'].includes(eq));
          if (aIsFreeWeights && !bIsFreeWeights) return -1;
          if (!aIsFreeWeights && bIsFreeWeights) return 1;
          return 0;
        });
      }
      
      // Pick from top 3 (if available) for some variety within preference
      const topCandidates = sortedExercises.slice(0, Math.min(3, sortedExercises.length));
      const randomIndex = Math.floor(Math.random() * topCandidates.length);
      return { 
        exercise: topCandidates[randomIndex], 
        isFallback: false, 
        fallbackReason: null 
      };
    }

    // 5. Fallback: try secondary_role exercises
    const { data: secondaryExercises } = await supabase
      .from('exercises')
      .select('*')
      .eq('secondary_role', role);
    
    if (secondaryExercises && secondaryExercises.length > 0) {
      const validSecondary = secondaryExercises.filter(ex => {
        if (ex.difficulty && ex.difficulty > levelNumber * 2) return false;
        if (usedExerciseIds.includes(ex.id)) return false;
        if (activeInjuries.length > 0 && ex.contraindicated_injuries) {
          if (ex.contraindicated_injuries.some((i: string) => activeInjuries.includes(i))) return false;
        }
        return true;
      });
      
      if (validSecondary.length > 0) {
        const randomIndex = Math.floor(Math.random() * validSecondary.length);
        return { 
          exercise: validSecondary[randomIndex], 
          isFallback: true, 
          fallbackReason: 'secondary_role' 
        };
      }
    }

    // 6. Fallback: try bodyweight exercises for this role
    const { data: bodyweightExercises } = await supabase
      .from('exercises')
      .select('*')
      .eq('primary_role', role)
      .eq('requires_machine', false);
    
    if (bodyweightExercises && bodyweightExercises.length > 0) {
      // Filter for bodyweight or exercises without equipment requirements
      const validBodyweight = bodyweightExercises.filter(ex => {
        if (usedExerciseIds.includes(ex.id)) return false;
        if (activeInjuries.length > 0 && ex.contraindicated_injuries) {
          if (ex.contraindicated_injuries.some((i: string) => activeInjuries.includes(i))) return false;
        }
        // Accept if equipment includes bodyweight or is empty (fallback)
        const hasBodyweight = ex.equipment?.includes('bodyweight') || ex.equipment?.length === 0;
        return hasBodyweight;
      });
      
      if (validBodyweight.length > 0) {
        const randomIndex = Math.floor(Math.random() * validBodyweight.length);
        return { 
          exercise: validBodyweight[randomIndex], 
          isFallback: true, 
          fallbackReason: 'bodyweight' 
        };
      }
    }

    // 7. No exercise found - skip slot
    return { exercise: null, isFallback: true, fallbackReason: 'skipped' };
  }, []);

  // Fetch day templates from database
  const fetchDayTemplates = async (goalId: TrainingGoalId): Promise<DayTemplate[]> => {
    const { data, error } = await supabase
      .from('day_templates')
      .select('*')
      .eq('goal_id', goalId)
      .order('day_letter')
      .order('slot_order');
    
    if (error || !data) {
      console.error('Error fetching day templates:', error);
      return [];
    }

    // Group by day_letter
    const grouped = data.reduce((acc, row) => {
      if (!acc[row.day_letter]) {
        acc[row.day_letter] = {
          dayLetter: row.day_letter,
          dayName: row.day_name,
          slots: []
        };
      }
      acc[row.day_letter].slots.push({
        id: row.id,
        slotOrder: row.slot_order,
        roleId: row.role_id as TrainingRoleId,
        beginnerSets: row.beginner_sets,
        intermediateSets: row.intermediate_sets,
        advancedSets: row.advanced_sets,
        repMin: row.rep_min || 8,
        repMax: row.rep_max || 12,
      });
      return acc;
    }, {} as Record<string, DayTemplate>);

    return Object.values(grouped);
  };

  // Generate complete workout plan
  const generateWorkoutPlan = useCallback(async (
    gymId: string,
    goalId: TrainingGoalId,
    userLevel: UserLevel,
    userInjuries: string[],
    equipmentPreference: string | null
  ): Promise<string | null> => {
    if (!user) {
      setError('Uživatel není přihlášen');
      return null;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // 1. Deactivate existing plans
      await supabase
        .from('user_workout_plans')
        .update({ is_active: false })
        .eq('user_id', user.id);

      // 2. Create new plan
      const { data: newPlan, error: planError } = await supabase
        .from('user_workout_plans')
        .insert({
          user_id: user.id,
          gym_id: gymId,
          goal_id: goalId,
          is_active: true
        })
        .select()
        .single();

      if (planError || !newPlan) {
        throw new Error('Nepodařilo se vytvořit tréninkový plán');
      }

      // 3. Fetch day templates
      const templates = await fetchDayTemplates(goalId);
      
      if (templates.length === 0) {
        throw new Error('Nenalezeny šablony pro tento cíl');
      }

      // 4. Generate exercises for each day and slot
      const exerciseInserts: any[] = [];
      
      for (const day of templates) {
        const usedExerciseIds: string[] = [];
        
        for (const slot of day.slots) {
          const { exercise, isFallback, fallbackReason } = await assignExerciseForRole(
            slot.roleId,
            gymId,
            userLevel,
            userInjuries,
            usedExerciseIds,
            equipmentPreference
          );
          
          if (exercise) {
            usedExerciseIds.push(exercise.id);
          }

          exerciseInserts.push({
            plan_id: newPlan.id,
            day_letter: day.dayLetter,
            slot_order: slot.slotOrder,
            role_id: slot.roleId,
            exercise_id: exercise?.id || null,
            sets: getSetsForLevel(slot, userLevel),
            rep_min: slot.repMin,
            rep_max: slot.repMax,
            is_fallback: isFallback,
            fallback_reason: fallbackReason
          });
        }
      }

      // 5. Insert all exercises
      const { error: insertError } = await supabase
        .from('user_workout_exercises')
        .insert(exerciseInserts);

      if (insertError) {
        throw new Error('Nepodařilo se uložit cviky');
      }

      return newPlan.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Neznámá chyba';
      setError(message);
      console.error('Error generating workout plan:', err);
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [user, assignExerciseForRole]);

  return {
    generateWorkoutPlan,
    isGenerating,
    error
  };
};
