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
    
    console.log('[WorkoutGenerator] Gym equipment types:', rawEquipmentTypes);
    console.log('[WorkoutGenerator] Equipment preference:', equipmentPreference);
    
    // Expand equipment types to include sub-types
    const expandedEquipment = new Set<string>(rawEquipmentTypes);
    
    // Free weights expansion
    if (rawEquipmentTypes.includes('free_weights')) {
      expandedEquipment.add('barbell');
      expandedEquipment.add('dumbbell');
      expandedEquipment.add('kettlebell');
    }
    
    // Machine types - CRITICAL: 'machine' in gym means 'cable', 'machine', 'plate_loaded' in exercises
    if (rawEquipmentTypes.includes('machine')) {
      expandedEquipment.add('machine');
      expandedEquipment.add('cable');
      expandedEquipment.add('plate_loaded');
    }
    if (rawEquipmentTypes.includes('plate_loaded')) {
      expandedEquipment.add('machine');
      expandedEquipment.add('plate_loaded');
    }
    if (rawEquipmentTypes.includes('cable')) {
      expandedEquipment.add('cable');
    }
    
    // Always include bodyweight as available
    expandedEquipment.add('bodyweight');
    
    const availableEquipmentTypes = Array.from(expandedEquipment);
    console.log('[WorkoutGenerator] Expanded equipment:', availableEquipmentTypes);
    
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
    console.log(`[WorkoutGenerator] Role ${role}: ${filteredExercises.length} exercises after filter, preference: ${equipmentPreference}`);
    
    if (filteredExercises.length > 0) {
      let sortedExercises = [...filteredExercises];
      
      if (equipmentPreference === 'machines') {
        // Prefer ACTUAL machine exercises - check equipment array for 'machine', 'cable', 'plate_loaded'
        // Score: machine/cable/plate_loaded = 100, everything else = 0
        sortedExercises.sort((a, b) => {
          const machineTypes = ['machine', 'cable', 'plate_loaded'];
          const bodyweightType = 'bodyweight';
          
          const aIsMachine = a.equipment?.some(eq => machineTypes.includes(eq));
          const bIsMachine = b.equipment?.some(eq => machineTypes.includes(eq));
          const aIsBodyweight = a.equipment?.includes(bodyweightType);
          const bIsBodyweight = b.equipment?.includes(bodyweightType);
          
          // Machines first, then free weights, then bodyweight last
          const aScore = aIsMachine ? 100 : (aIsBodyweight ? 0 : 50);
          const bScore = bIsMachine ? 100 : (bIsBodyweight ? 0 : 50);
          
          return bScore - aScore;
        });
        
        // Filter to ONLY machine exercises if available
        const machineOnly = sortedExercises.filter(ex => 
          ex.equipment?.some(eq => ['machine', 'cable', 'plate_loaded'].includes(eq))
        );
        
        if (machineOnly.length > 0) {
          console.log(`[WorkoutGenerator] Found ${machineOnly.length} machine exercises for ${role}`);
          const randomIndex = Math.floor(Math.random() * Math.min(3, machineOnly.length));
          return { 
            exercise: machineOnly[randomIndex], 
            isFallback: false, 
            fallbackReason: null 
          };
        }
        
        // Fallback to sorted list if no pure machine exercises
        console.log(`[WorkoutGenerator] No machine exercises for ${role}, using best available`);
      } else if (equipmentPreference === 'bodyweight') {
        // Prefer bodyweight exercises - ONLY select bodyweight if available
        const bodyweightOnly = sortedExercises.filter(ex => ex.equipment?.includes('bodyweight'));
        
        if (bodyweightOnly.length > 0) {
          const randomIndex = Math.floor(Math.random() * Math.min(3, bodyweightOnly.length));
          return { 
            exercise: bodyweightOnly[randomIndex], 
            isFallback: false, 
            fallbackReason: null 
          };
        }
      } else if (equipmentPreference === 'free_weights') {
        // Prefer free weights - ONLY select free weights if available
        const freeWeightsOnly = sortedExercises.filter(ex => 
          ex.equipment?.some(eq => ['barbell', 'dumbbell', 'kettlebell', 'free_weights'].includes(eq))
        );
        
        if (freeWeightsOnly.length > 0) {
          const randomIndex = Math.floor(Math.random() * Math.min(3, freeWeightsOnly.length));
          return { 
            exercise: freeWeightsOnly[randomIndex], 
            isFallback: false, 
            fallbackReason: null 
          };
        }
      }
      
      // Pick from top candidates if preference filter didn't return
      const topCandidates = sortedExercises.slice(0, Math.min(5, sortedExercises.length));
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

    // 7. LAST RESORT: Pick ANY exercise for this role (never return null)
    const { data: anyExercises } = await supabase
      .from('exercises')
      .select('*')
      .eq('primary_role', role)
      .limit(20);
    
    if (anyExercises && anyExercises.length > 0) {
      // Filter out only used exercises
      const available = anyExercises.filter(ex => !usedExerciseIds.includes(ex.id));
      if (available.length > 0) {
        const randomIndex = Math.floor(Math.random() * available.length);
        return { 
          exercise: available[randomIndex], 
          isFallback: true, 
          fallbackReason: 'any_available' 
        };
      }
      // Even if all are used, still return one
      const randomIndex = Math.floor(Math.random() * anyExercises.length);
      return { 
        exercise: anyExercises[randomIndex], 
        isFallback: true, 
        fallbackReason: 'any_available' 
      };
    }

    // 8. Absolute fallback - should never happen but just in case
    console.warn(`No exercises found for role: ${role}`);
    return { exercise: null, isFallback: true, fallbackReason: 'no_exercises_in_db' };
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
