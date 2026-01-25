// useWorkoutGenerator - PUMPLO implementácia podľa dokumentácie
// Nový algoritmus výberu cvikov:
// 1. Svalové skórovanie (primary_muscles +2, secondary_muscles +1)
// 2. Training Role (primary_role)
// 3. Validácia machine_id voči gym_machines
// 4. Equipment type filtering + user preference
// 5. Difficulty level podľa user_level
// 6. Fallback hierarchia (kapitola 5.4)

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TrainingGoalId, UserLevel, DayTemplate, DayTemplateSlot } from '@/lib/trainingGoals';

interface Exercise {
  id: string;
  name: string;
  primary_role: string | null;
  difficulty: number | null;
  machine_id: string | null;
  equipment_type: string | null;
  allowed_phase: string | null;
  primary_muscles: string[];
  secondary_muscles: string[];
}

interface TargetMuscles {
  primary: string[];
  secondary: string[];
}

interface ScoredExercise {
  exercise: Exercise;
  score: number;
}

interface AssignedExercise {
  exercise: Exercise | null;
  isFallback: boolean;
  fallbackReason: string | null;
  newCoveredMuscles: string[];
}

export const useWorkoutGenerator = () => {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Map user level to max difficulty (beginner=1-3, intermediate=4-6, advanced=7-10)
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

  /**
   * Fetch target muscles for a role from role_muscles table
   */
  const fetchTargetMuscles = async (roleId: string): Promise<TargetMuscles> => {
    const { data, error } = await supabase
      .from('role_muscles')
      .select('muscle, is_primary')
      .eq('role_id', roleId);

    if (error || !data) {
      console.warn(`[WorkoutGenerator] No muscles found for role: ${roleId}`);
      return { primary: [], secondary: [] };
    }

    return {
      primary: data.filter(m => m.is_primary).map(m => m.muscle),
      secondary: data.filter(m => !m.is_primary).map(m => m.muscle)
    };
  };

  /**
   * Calculate muscle score for an exercise
   * +2 points for each uncovered muscle in primary_muscles that matches target
   * +1 point for each uncovered muscle in secondary_muscles
   */
  const calculateMuscleScore = (
    exercise: Exercise,
    coveredMuscles: Set<string>,
    targetMuscles: TargetMuscles
  ): number => {
    let score = 0;

    // +2 za každý nepokrytý sval v primary_muscles, ktorý je v cieľových svaloch
    for (const muscle of exercise.primary_muscles || []) {
      if (targetMuscles.primary.includes(muscle) && !coveredMuscles.has(muscle)) {
        score += 2;
      }
    }

    // +1 za každý nepokrytý sval v secondary_muscles
    for (const muscle of exercise.secondary_muscles || []) {
      if (!coveredMuscles.has(muscle)) {
        score += 1;
      }
    }

    return score;
  };

  /**
   * Get preferred equipment types based on user level and preference
   * Kapitola 5.6 - Beginner preferuje bezpečnejšie vybavenie
   */
  const getPreferredEquipmentTypes = (
    level: UserLevel,
    preference: string | null
  ): string[] | null => {
    // Beginner má bezpečnostné obmedzenia
    if (level === 'beginner') {
      return ['machine', 'cable', 'bodyweight'];
    }

    // Podľa user preference z dotazníka (krok 8)
    if (preference === 'machines') {
      return ['machine', 'cable', 'plate_loaded'];
    }
    if (preference === 'free_weights') {
      return ['barbell', 'dumbbell', 'kettlebell'];
    }

    // Mix alebo žiadna preferencia - vráť null (všetky typy OK)
    return null;
  };

  /**
   * Check if exercise equipment_type is compatible with gym equipment
   */
  const isEquipmentAvailable = (
    exerciseEquipmentType: string | null,
    gymEquipmentTypes: Set<string>,
    preferredTypes: string[] | null
  ): boolean => {
    const exType = exerciseEquipmentType || 'bodyweight';

    // Bodyweight je vždy dostupné
    if (exType === 'bodyweight') return true;

    // Ak máme preference, filtruj podľa nich
    if (preferredTypes && !preferredTypes.includes(exType)) {
      return false;
    }

    // Mapovanie equipment_type na gym equipment
    if (['barbell', 'dumbbell', 'kettlebell'].includes(exType)) {
      return gymEquipmentTypes.has('free_weights') || gymEquipmentTypes.has(exType);
    }

    if (exType === 'cable') {
      return gymEquipmentTypes.has('cable') || gymEquipmentTypes.has('machine');
    }

    if (['machine', 'plate_loaded'].includes(exType)) {
      return gymEquipmentTypes.has('machine') || gymEquipmentTypes.has('plate_loaded');
    }

    return gymEquipmentTypes.has(exType);
  };

  /**
   * Apply equipment preference sorting - prioritize preferred types
   */
  const sortByEquipmentPreference = (
    exercises: ScoredExercise[],
    preference: string | null
  ): ScoredExercise[] => {
    if (!preference || exercises.length === 0) return exercises;

    const sorted = [...exercises];

    sorted.sort((a, b) => {
      // First by score (descending)
      if (b.score !== a.score) return b.score - a.score;

      // Then by equipment preference
      const aType = a.exercise.equipment_type || 'bodyweight';
      const bType = b.exercise.equipment_type || 'bodyweight';

      if (preference === 'machines') {
        const machineTypes = ['machine', 'cable', 'plate_loaded'];
        const aIsMachine = machineTypes.includes(aType);
        const bIsMachine = machineTypes.includes(bType);
        if (aIsMachine && !bIsMachine) return -1;
        if (!aIsMachine && bIsMachine) return 1;
      } else if (preference === 'free_weights') {
        const fwTypes = ['barbell', 'dumbbell', 'kettlebell'];
        const aIsFW = fwTypes.includes(aType);
        const bIsFW = fwTypes.includes(bType);
        if (aIsFW && !bIsFW) return -1;
        if (!aIsFW && bIsFW) return 1;
      }

      return 0;
    });

    return sorted;
  };

  /**
   * Assign exercise for a specific role - PUMPLO algorithm (kapitola 5.3 + 5.4)
   * 
   * Výber cviku:
   * 1. Získaj cieľové svaly z role_muscles
   * 2. Všetky cviky s odpovídajúcou primary_role
   * 3. Filter: difficulty, machine_id, equipment_type, not used
   * 4. Skórovanie podľa svalového pokrytia
   * 5. Vyber náhodne z top kandidátov
   * 
   * Fallback (kapitola 5.4):
   * 1. Rovnaká primary_role, iné vybavenie
   * 2. Cviky kde target sval je v secondary_muscles
   * 3. Bodyweight varianta
   * 4. Skip slot
   */
  const assignExerciseForRole = useCallback(async (
    role: string,
    gymId: string,
    userLevel: UserLevel,
    usedExerciseIds: string[],
    equipmentPreference: string | null,
    coveredMuscles: Set<string>
  ): Promise<AssignedExercise> => {
    const maxDifficulty = getMaxDifficulty(userLevel);
    const preferredEquipment = getPreferredEquipmentTypes(userLevel, equipmentPreference);

    console.log(`[WorkoutGenerator] === Selecting exercise for role: ${role} ===`);
    console.log(`[WorkoutGenerator] User level: ${userLevel}, Max difficulty: ${maxDifficulty}`);
    console.log(`[WorkoutGenerator] Equipment preference: ${equipmentPreference}`);
    console.log(`[WorkoutGenerator] Covered muscles:`, Array.from(coveredMuscles));

    // 1. Fetch target muscles for this role
    const targetMuscles = await fetchTargetMuscles(role);
    console.log(`[WorkoutGenerator] Target muscles for ${role}:`, targetMuscles);

    // 2. Get gym equipment info
    const { data: gymMachines } = await supabase
      .from('gym_machines')
      .select('machine_id, machines(id, equipment_type)')
      .eq('gym_id', gymId);

    const availableMachineIds = new Set(
      gymMachines?.map(m => m.machine_id).filter(Boolean) || []
    );
    const gymEquipmentTypes = new Set(
      gymMachines?.map(m => (m.machines as any)?.equipment_type).filter(Boolean) || []
    );

    console.log(`[WorkoutGenerator] Available machine IDs:`, Array.from(availableMachineIds));
    console.log(`[WorkoutGenerator] Gym equipment types:`, Array.from(gymEquipmentTypes));

    // 3. Get ALL exercises with primary_role and allowed_phase = 'main'
    const { data: allExercises, error: exError } = await supabase
      .from('exercises')
      .select('*')
      .eq('primary_role', role)
      .eq('allowed_phase', 'main');

    if (exError || !allExercises) {
      console.error('[WorkoutGenerator] Error fetching exercises:', exError);
      return { exercise: null, isFallback: false, fallbackReason: 'db_error', newCoveredMuscles: [] };
    }

    console.log(`[WorkoutGenerator] Found ${allExercises.length} exercises for role ${role}`);

    // 4. Filter exercises - PUMPLO logic
    const filteredExercises = allExercises.filter(ex => {
      // a) Difficulty filter
      if (ex.difficulty && ex.difficulty > maxDifficulty) {
        return false;
      }

      // b) Already used filter
      if (usedExerciseIds.includes(ex.id)) {
        return false;
      }

      // c) Machine ID validation - ak má machine_id, musí byť v gym_machines
      if (ex.machine_id && !availableMachineIds.has(ex.machine_id)) {
        return false;
      }

      // d) Equipment type filter
      if (!isEquipmentAvailable(ex.equipment_type, gymEquipmentTypes, preferredEquipment)) {
        return false;
      }

      return true;
    });

    console.log(`[WorkoutGenerator] ${filteredExercises.length} exercises after filtering`);

    // 5. Score candidates by muscle coverage
    if (filteredExercises.length > 0) {
      const scoredExercises: ScoredExercise[] = filteredExercises.map(ex => ({
        exercise: ex,
        score: calculateMuscleScore(ex, coveredMuscles, targetMuscles)
      }));

      // Sort by score and apply equipment preference
      const sortedExercises = sortByEquipmentPreference(scoredExercises, equipmentPreference);

      console.log(`[WorkoutGenerator] Top 5 candidates:`, sortedExercises.slice(0, 5).map(s => 
        `${s.exercise.name} (score: ${s.score}, type: ${s.exercise.equipment_type})`
      ));

      // Pick random from top 5 candidates
      const topCandidates = sortedExercises.slice(0, Math.min(5, sortedExercises.length));
      const randomIndex = Math.floor(Math.random() * topCandidates.length);
      const selected = topCandidates[randomIndex].exercise;

      // Calculate newly covered muscles
      const newCoveredMuscles = [
        ...(selected.primary_muscles || []),
        ...(selected.secondary_muscles || [])
      ];

      console.log(`[WorkoutGenerator] ✓ Selected: ${selected.name}`);

      return {
        exercise: selected,
        isFallback: false,
        fallbackReason: null,
        newCoveredMuscles
      };
    }

    // === FALLBACK 1: Same role, different equipment (ignore gym filter) ===
    console.log(`[WorkoutGenerator] Fallback 1: Trying different equipment for ${role}`);

    const fallback1 = allExercises.filter(ex => {
      if (ex.difficulty && ex.difficulty > maxDifficulty) return false;
      if (usedExerciseIds.includes(ex.id)) return false;
      return true;
    });

    if (fallback1.length > 0) {
      const scoredFallback1 = fallback1.map(ex => ({
        exercise: ex,
        score: calculateMuscleScore(ex, coveredMuscles, targetMuscles)
      })).sort((a, b) => b.score - a.score);

      const selected = scoredFallback1[0].exercise;
      const newCoveredMuscles = [
        ...(selected.primary_muscles || []),
        ...(selected.secondary_muscles || [])
      ];

      console.log(`[WorkoutGenerator] ✓ Fallback 1 selected: ${selected.name}`);

      return {
        exercise: selected,
        isFallback: true,
        fallbackReason: 'different_equipment',
        newCoveredMuscles
      };
    }

    // === FALLBACK 2: Exercises with target muscle in secondary_muscles ===
    console.log(`[WorkoutGenerator] Fallback 2: Searching exercises with target muscles in secondary_muscles`);

    if (targetMuscles.primary.length > 0) {
      const { data: secondaryExercises } = await supabase
        .from('exercises')
        .select('*')
        .eq('allowed_phase', 'main')
        .not('id', 'in', `(${usedExerciseIds.join(',')})`);

      if (secondaryExercises) {
        const matchingExercises = secondaryExercises.filter(ex => {
          if (ex.difficulty && ex.difficulty > maxDifficulty) return false;
          if (usedExerciseIds.includes(ex.id)) return false;

          // Check if any target primary muscle is in exercise's secondary_muscles
          const exSecondary = ex.secondary_muscles || [];
          return targetMuscles.primary.some(muscle => exSecondary.includes(muscle));
        });

        if (matchingExercises.length > 0) {
          const randomIndex = Math.floor(Math.random() * Math.min(3, matchingExercises.length));
          const selected = matchingExercises[randomIndex];
          const newCoveredMuscles = [
            ...(selected.primary_muscles || []),
            ...(selected.secondary_muscles || [])
          ];

          console.log(`[WorkoutGenerator] ✓ Fallback 2 selected: ${selected.name}`);

          return {
            exercise: selected,
            isFallback: true,
            fallbackReason: 'target_in_secondary',
            newCoveredMuscles
          };
        }
      }
    }

    // === FALLBACK 3: Bodyweight variant ===
    console.log(`[WorkoutGenerator] Fallback 3: Trying bodyweight for ${role}`);

    const { data: bodyweightExercises } = await supabase
      .from('exercises')
      .select('*')
      .eq('primary_role', role)
      .eq('equipment_type', 'bodyweight')
      .eq('allowed_phase', 'main');

    if (bodyweightExercises && bodyweightExercises.length > 0) {
      const validBodyweight = bodyweightExercises.filter(ex => {
        if (usedExerciseIds.includes(ex.id)) return false;
        return true;
      });

      if (validBodyweight.length > 0) {
        const randomIndex = Math.floor(Math.random() * validBodyweight.length);
        const selected = validBodyweight[randomIndex];
        const newCoveredMuscles = [
          ...(selected.primary_muscles || []),
          ...(selected.secondary_muscles || [])
        ];

        console.log(`[WorkoutGenerator] ✓ Fallback 3 selected: ${selected.name}`);

        return {
          exercise: selected,
          isFallback: true,
          fallbackReason: 'bodyweight',
          newCoveredMuscles
        };
      }
    }

    // === FALLBACK 4: No exercise available - slot will be skipped ===
    console.warn(`[WorkoutGenerator] ✗ No exercises found for role: ${role} - skipping slot`);
    return { exercise: null, isFallback: true, fallbackReason: 'no_exercises_in_db', newCoveredMuscles: [] };
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
   * Vypočíta počet cvikov podľa trvania tréningu
   * 
   * Nová formula (per user request):
   * - Rozcvička: ~4 min (dynamická, reálny odhad)
   * - Jeden cvik (vrátane prestávok): ~8 min
   * - Padding: 3 min max ponad užívateľom nastavený čas
   * 
   * Príklady:
   * - 30 min = (30 - 4 + 3) / 8 = 3 cviky
   * - 45 min = (45 - 4 + 3) / 8 = 5 cvikov
   * - 60 min = (60 - 4 + 3) / 8 = 7 cvikov
   * - 90 min = (90 - 4 + 3) / 8 = 11 cvikov
   * - 120 min = (120 - 4 + 3) / 8 = 14 cvikov
   */
  const calculateSlotsForDuration = (
    durationMinutes: number,
    templateSlots: DayTemplateSlot[],
    userLevel: UserLevel
  ): DayTemplateSlot[] => {
    const WARMUP_MINUTES = 4;
    const PADDING_MINUTES = 3;
    const MINUTES_PER_EXERCISE = 8;
    
    // Available time = userDuration - warmup + allowed padding
    const availableMinutes = durationMinutes - WARMUP_MINUTES + PADDING_MINUTES;
    let targetExerciseCount = Math.floor(availableMinutes / MINUTES_PER_EXERCISE);
    
    // Minimum 3 cviky, maximum rozumne na základe šablóny
    const MIN_EXERCISES = 3;
    const MAX_EXERCISES = Math.max(templateSlots.length + 4, 10); // max +4 nad šablónu
    
    targetExerciseCount = Math.max(MIN_EXERCISES, Math.min(targetExerciseCount, MAX_EXERCISES));
    
    console.log(`[WorkoutGenerator] Duration: ${durationMinutes}min -> Target: ${targetExerciseCount} exercises`);
    
    // Ak template má dosť slotov, použiť toľko koľko treba
    if (targetExerciseCount <= templateSlots.length) {
      // Prioritne zachovať compound cviky (prvé sloty)
      return templateSlots.slice(0, targetExerciseCount);
    }
    
    // Ak potrebujeme VIAC slotov, roztiahnuť šablónu
    const extended = [...templateSlots];
    let i = 0;
    while (extended.length < targetExerciseCount) {
      // Opakovať role z template (cyklicky)
      const originalSlot = templateSlots[i % templateSlots.length];
      extended.push({
        ...originalSlot,
        id: `${originalSlot.id}_ext_${extended.length}`,
        slotOrder: extended.length + 1
      });
      i++;
    }
    
    return extended;
  };

  /**
   * Generate complete workout plan - PUMPLO logic
   * Vytvorí plán a priradí cviky pre všetky dni podľa day_templates
   * Sleduje pokrytie svalov naprieč celým dňom
   * Dynamicky upravuje počet cvikov podľa training_duration_minutes
   */
  const generateWorkoutPlan = useCallback(async (
    gymId: string,
    goalId: TrainingGoalId,
    userLevel: UserLevel,
    userInjuries: string[],
    equipmentPreference: string | null,
    durationMinutes: number = 60 // NEW: Duration parameter for slot calculation
  ): Promise<string | null> => {
    if (!user) {
      setError('Uživatel není přihlášen');
      return null;
    }

    setIsGenerating(true);
    setError(null);

    try {
      console.log('[WorkoutGenerator] ========================================');
      console.log('[WorkoutGenerator] Starting workout plan generation');
      console.log('[WorkoutGenerator] Gym ID:', gymId);
      console.log('[WorkoutGenerator] Goal ID:', goalId);
      console.log('[WorkoutGenerator] User Level:', userLevel);
      console.log('[WorkoutGenerator] Equipment Preference:', equipmentPreference);
      console.log('[WorkoutGenerator] ========================================');

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

      console.log(`[WorkoutGenerator] Found ${templates.length} day templates`);

      // 4. Generate exercises for each day and slot
      const exerciseInserts: any[] = [];

      for (const day of templates) {
        console.log(`\n[WorkoutGenerator] === Processing day: ${day.dayLetter} (${day.dayName}) ===`);

        // NEW: Adjust slots based on training duration
        const adjustedSlots = calculateSlotsForDuration(durationMinutes, day.slots, userLevel);
        console.log(`[WorkoutGenerator] Adjusted to ${adjustedSlots.length} slots (was ${day.slots.length}) for ${durationMinutes}min duration`);

        const usedExerciseIds: string[] = [];
        const coveredMuscles = new Set<string>(); // Track covered muscles per day

        for (const slot of adjustedSlots) {
          console.log(`[WorkoutGenerator] Slot ${slot.slotOrder}: Role = ${slot.roleId}`);

          const result = await assignExerciseForRole(
            slot.roleId,
            gymId,
            userLevel,
            usedExerciseIds,
            equipmentPreference,
            coveredMuscles
          );

          if (result.exercise) {
            usedExerciseIds.push(result.exercise.id);

            // Update covered muscles
            result.newCoveredMuscles.forEach(muscle => coveredMuscles.add(muscle));

            exerciseInserts.push({
              plan_id: newPlan.id,
              day_letter: day.dayLetter,
              slot_order: slot.slotOrder,
              role_id: slot.roleId,
              exercise_id: result.exercise.id,
              sets: getSetsForLevel(slot, userLevel),
              rep_min: slot.repMin,
              rep_max: slot.repMax,
              is_fallback: result.isFallback,
              fallback_reason: result.fallbackReason
            });
          }
        }

        console.log(`[WorkoutGenerator] Day ${day.dayLetter} complete. Covered muscles:`, Array.from(coveredMuscles));
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

      console.log(`\n[WorkoutGenerator] ========================================`);
      console.log(`[WorkoutGenerator] Plan created with ${exerciseInserts.length} exercises`);
      console.log(`[WorkoutGenerator] ========================================`);

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
