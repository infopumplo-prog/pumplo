// useWorkoutGenerator - PUMPLO implementácia podľa dokumentu
// Cviky sa vyberajú na základe:
// 1. Training Role (primary_role)
// 2. Vybavenia fitka (equipment matching)
// 3. Difficulty level (podľa user_level)
// 4. Contraindicated injuries
// BEZ workout_split filtrovania

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
  equipment_type: string | null;
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

  // Map user level to max difficulty (podľa dokumentu: beginner=1-3, intermediate=4-6, advanced=7-10)
  const getMaxDifficulty = (level: UserLevel): number => {
    switch (level) {
      case 'beginner': return 3;
      case 'intermediate': return 6;
      case 'advanced': return 10;
      default: return 3;
    }
  };

  // Get sets for user level from slot template
  const getSetsForLevel = (slot: DayTemplateSlot, level: UserLevel): number => {
    switch (level) {
      case 'beginner': return slot.beginnerSets;
      case 'intermediate': return slot.intermediateSets;
      case 'advanced': return slot.advancedSets;
      default: return slot.beginnerSets;
    }
  };

  // Expand gym equipment types to match exercise equipment
  const expandEquipmentTypes = (rawTypes: string[]): Set<string> => {
    const expanded = new Set<string>(rawTypes);
    
    // Always include bodyweight
    expanded.add('bodyweight');
    
    // Free weights expansion
    if (rawTypes.includes('free_weights')) {
      expanded.add('barbell');
      expanded.add('dumbbell');
      expanded.add('kettlebell');
    }
    
    // Machine types expansion
    if (rawTypes.includes('machine')) {
      expanded.add('machine');
      expanded.add('cable');
      expanded.add('plate_loaded');
    }
    if (rawTypes.includes('plate_loaded')) {
      expanded.add('plate_loaded');
    }
    if (rawTypes.includes('cable')) {
      expanded.add('cable');
    }
    
    return expanded;
  };

  // Check if exercise equipment matches gym equipment
  const exerciseMatchesGymEquipment = (
    exercise: Exercise,
    gymEquipmentTypes: string[],
    expandedEquipment: Set<string>
  ): boolean => {
    const exEquipment = exercise.equipment || [];
    
    // Bodyweight exercises are always available
    if (exEquipment.includes('bodyweight') || exEquipment.length === 0) {
      return true;
    }
    
    // Free weights (barbell, dumbbell, kettlebell)
    const isFreeWeights = exEquipment.some(eq => 
      ['barbell', 'dumbbell', 'kettlebell', 'free_weights'].includes(eq)
    );
    if (isFreeWeights) {
      return gymEquipmentTypes.includes('free_weights') || 
             exEquipment.some(eq => expandedEquipment.has(eq));
    }
    
    // Cable exercises
    if (exEquipment.includes('cable')) {
      return expandedEquipment.has('cable') || gymEquipmentTypes.includes('machine');
    }
    
    // Machine/plate_loaded exercises
    const isMachine = exEquipment.some(eq => ['machine', 'plate_loaded'].includes(eq));
    if (isMachine) {
      return gymEquipmentTypes.includes('machine') || gymEquipmentTypes.includes('plate_loaded');
    }
    
    // Default: check if any equipment matches
    return exEquipment.some(eq => expandedEquipment.has(eq));
  };

  // Filter by injuries
  const exerciseContraindicatedForInjuries = (
    exercise: Exercise,
    userInjuries: string[]
  ): boolean => {
    const activeInjuries = userInjuries.filter(i => i && i !== 'none');
    if (activeInjuries.length === 0) return false;
    
    const contraindications = exercise.contraindicated_injuries || [];
    if (contraindications.length === 0) return false;
    
    return contraindications.some(injury => {
      const lowerInjury = injury.toLowerCase();
      return activeInjuries.some(userInjury => {
        const lowerUserInjury = userInjury.toLowerCase();
        return lowerInjury.includes(lowerUserInjury) || 
               lowerUserInjury.includes(lowerInjury) ||
               lowerInjury === lowerUserInjury.replace(/s$/, '') ||
               lowerInjury + 's' === lowerUserInjury;
      });
    });
  };

  // Apply equipment preference sorting
  const sortByEquipmentPreference = (
    exercises: Exercise[],
    preference: string | null
  ): Exercise[] => {
    if (!preference || exercises.length === 0) return exercises;
    
    const sorted = [...exercises];
    
    if (preference === 'machines') {
      const machineExercises = sorted.filter(ex =>
        ex.equipment?.some(eq => ['machine', 'cable', 'plate_loaded'].includes(eq))
      );
      if (machineExercises.length > 0) return machineExercises;
    } else if (preference === 'free_weights') {
      const fwExercises = sorted.filter(ex =>
        ex.equipment?.some(eq => ['barbell', 'dumbbell', 'kettlebell', 'free_weights'].includes(eq))
      );
      if (fwExercises.length > 0) return fwExercises;
    } else if (preference === 'bodyweight') {
      const bwExercises = sorted.filter(ex => ex.equipment?.includes('bodyweight'));
      if (bwExercises.length > 0) return bwExercises;
    }
    
    return sorted;
  };

  /**
   * Assign exercise for a specific role - PUMPLO logic (kapitola 5.3 + 5.4)
   * 
   * Výber cviku:
   * 1. Všetky cviky s odpovídajúcou primary_role
   * 2. Filter podľa vybavenia dostupného vo fitku
   * 3. Filter podľa difficulty_level ≤ max pre user_level
   * 4. Filter podľa zranení (contraindicated_injuries)
   * 5. Ak je viac možností → vyber náhodne z top kandidátov
   * 
   * Fallback (kapitola 5.4):
   * 1. Rovnaká primary_role, iné vybavenie
   * 2. Cviky so secondary_role
   * 3. Bodyweight varianta
   * 4. Ak nič nie je dostupné → vráť null (slot sa vynechá)
   */
  const assignExerciseForRole = useCallback(async (
    role: string,
    gymId: string,
    userLevel: UserLevel,
    userInjuries: string[],
    usedExerciseIds: string[],
    equipmentPreference: string | null
  ): Promise<AssignedExercise> => {
    const maxDifficulty = getMaxDifficulty(userLevel);
    
    // 1. Get gym equipment
    const { data: gymMachines } = await supabase
      .from('gym_machines')
      .select('machine_id, machines(id, equipment_type)')
      .eq('gym_id', gymId);
    
    const gymEquipmentTypes = gymMachines?.map(m => (m.machines as any)?.equipment_type).filter(Boolean) || [];
    const expandedEquipment = expandEquipmentTypes(gymEquipmentTypes);
    
    console.log(`[WorkoutGenerator] Role: ${role}, Gym equipment:`, gymEquipmentTypes);
    
    // 2. Get ALL exercises with primary_role
    const { data: allExercises, error: exError } = await supabase
      .from('exercises')
      .select('*')
      .eq('primary_role', role);
    
    if (exError || !allExercises) {
      console.error('Error fetching exercises:', exError);
      return { exercise: null, isFallback: false, fallbackReason: 'db_error' };
    }

    // 3. Filter exercises - podľa dokumentu (equipment, difficulty, injuries, not used)
    let filteredExercises = allExercises.filter(ex => {
      // Difficulty filter
      if (ex.difficulty && ex.difficulty > maxDifficulty) return false;
      
      // Already used filter
      if (usedExerciseIds.includes(ex.id)) return false;
      
      // Injury filter
      if (exerciseContraindicatedForInjuries(ex, userInjuries)) return false;
      
      // Equipment filter
      if (!exerciseMatchesGymEquipment(ex, gymEquipmentTypes, expandedEquipment)) return false;
      
      return true;
    });

    console.log(`[WorkoutGenerator] Role ${role}: ${filteredExercises.length} exercises after filter`);

    // 4. Apply equipment preference
    if (filteredExercises.length > 0) {
      const preferredExercises = sortByEquipmentPreference(filteredExercises, equipmentPreference);
      
      // Pick random from top candidates
      const topCandidates = preferredExercises.slice(0, Math.min(5, preferredExercises.length));
      const randomIndex = Math.floor(Math.random() * topCandidates.length);
      
      return { 
        exercise: topCandidates[randomIndex], 
        isFallback: false,
        fallbackReason: null 
      };
    }

    // === FALLBACK 1: Same role, different equipment (ignore gym equipment) ===
    console.log(`[WorkoutGenerator] Fallback 1: Trying different equipment for ${role}`);
    
    const fallback1 = allExercises.filter(ex => {
      if (ex.difficulty && ex.difficulty > maxDifficulty) return false;
      if (usedExerciseIds.includes(ex.id)) return false;
      if (exerciseContraindicatedForInjuries(ex, userInjuries)) return false;
      return true;
    });
    
    if (fallback1.length > 0) {
      const randomIndex = Math.floor(Math.random() * Math.min(3, fallback1.length));
      return { 
        exercise: fallback1[randomIndex], 
        isFallback: true, 
        fallbackReason: 'different_equipment' 
      };
    }

    // === FALLBACK 2: Secondary role exercises ===
    console.log(`[WorkoutGenerator] Fallback 2: Trying secondary_role for ${role}`);
    
    const { data: secondaryExercises } = await supabase
      .from('exercises')
      .select('*')
      .eq('secondary_role', role);
    
    if (secondaryExercises && secondaryExercises.length > 0) {
      const validSecondary = secondaryExercises.filter(ex => {
        if (ex.difficulty && ex.difficulty > maxDifficulty) return false;
        if (usedExerciseIds.includes(ex.id)) return false;
        if (exerciseContraindicatedForInjuries(ex, userInjuries)) return false;
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

    // === FALLBACK 3: Bodyweight variant ===
    console.log(`[WorkoutGenerator] Fallback 3: Trying bodyweight for ${role}`);
    
    const { data: bodyweightExercises } = await supabase
      .from('exercises')
      .select('*')
      .eq('primary_role', role)
      .contains('equipment', ['bodyweight']);
    
    if (bodyweightExercises && bodyweightExercises.length > 0) {
      const validBodyweight = bodyweightExercises.filter(ex => {
        if (usedExerciseIds.includes(ex.id)) return false;
        if (exerciseContraindicatedForInjuries(ex, userInjuries)) return false;
        return true;
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

    // === FALLBACK 4: No exercise available - slot will be skipped ===
    console.warn(`[WorkoutGenerator] No exercises found for role: ${role}`);
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
        roleId: row.role_id,
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

  /**
   * Generate complete workout plan - PUMPLO logic
   * Vytvorí plán a priradí cviky pre všetky dni podľa day_templates
   */
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
            
            exerciseInserts.push({
              plan_id: newPlan.id,
              day_letter: day.dayLetter,
              slot_order: slot.slotOrder,
              role_id: slot.roleId,
              exercise_id: exercise.id,
              sets: getSetsForLevel(slot, userLevel),
              rep_min: slot.repMin,
              rep_max: slot.repMax,
              is_fallback: isFallback,
              fallback_reason: fallbackReason
            });
          }
        }
      }

      // 5. Insert exercises
      if (exerciseInserts.length > 0) {
        const { error: insertError } = await supabase
          .from('user_workout_exercises')
          .insert(exerciseInserts);
        
        if (insertError) {
          console.error('Error inserting exercises:', insertError);
          throw new Error('Nepodařilo se uložit cviky');
        }
      }

      console.log(`[WorkoutGenerator] Plan created with ${exerciseInserts.length} exercises`);
      return newPlan.id;

    } catch (err) {
      console.error('Error generating workout plan:', err);
      setError(err instanceof Error ? err.message : 'Neznámá chyba');
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [user, assignExerciseForRole]);

  return {
    generateWorkoutPlan,
    assignExerciseForRole,
    isGenerating,
    error
  };
};
