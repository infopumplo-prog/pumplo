import { WarmupExercise } from '@/components/workout/WarmupPlayer';

// Determine training focus based on split type and day letter
export const getTrainingFocus = (splitType: string, dayLetter: string): 'upper' | 'lower' | 'full' => {
  switch (splitType) {
    case 'ppl':
      // A = Push (upper), B = Pull (upper), C = Legs (lower)
      return dayLetter === 'C' ? 'lower' : 'upper';
    case 'upper_lower':
      // A = Upper, B = Lower
      return dayLetter === 'B' ? 'lower' : 'upper';
    case 'full_body':
    default:
      return 'full';
  }
};

interface DbExercise {
  id: string;
  name: string;
  video_path: string | null;
  primary_muscles: string[] | null;
  body_region: string | null;
}

// Select 6 warmup exercises (6 × 30s = 3 min) based on training focus
// Upper day: 3 upper + 3 core, Lower day: 3 lower + 3 core, Full: 2+2+2
export const selectWarmupExercises = (
  available: DbExercise[],
  focus: 'upper' | 'lower' | 'full',
  mainWorkoutMuscles: string[]
): WarmupExercise[] => {
  const upper = available.filter(e => e.body_region === 'upper');
  const lower = available.filter(e => e.body_region === 'lower');
  const core = available.filter(e => e.body_region === 'core');

  let slots: { region: string; count: number }[];
  switch (focus) {
    case 'upper':
      slots = [
        { region: 'upper', count: 3 },
        { region: 'core', count: 3 },
      ];
      break;
    case 'lower':
      slots = [
        { region: 'lower', count: 3 },
        { region: 'core', count: 3 },
      ];
      break;
    case 'full':
    default:
      slots = [
        { region: 'upper', count: 2 },
        { region: 'lower', count: 2 },
        { region: 'core', count: 2 },
      ];
      break;
  }

  const pools: Record<string, DbExercise[]> = { upper, lower, core };
  const selected: WarmupExercise[] = [];
  const usedIds = new Set<string>();

  for (const slot of slots) {
    const pool = pools[slot.region] || [];

    // Score by muscle overlap with main workout
    const scored = pool
      .filter(e => !usedIds.has(e.id))
      .map(e => {
        const muscles = e.primary_muscles ?? [];
        const overlap = muscles.filter(m => mainWorkoutMuscles.includes(m)).length;
        return { exercise: e, score: overlap };
      })
      .sort((a, b) => b.score - a.score);

    // Pick top N for this slot
    for (let i = 0; i < slot.count && i < scored.length; i++) {
      const ex = scored[i].exercise;
      selected.push({
        id: ex.id,
        name: ex.name,
        duration: 30,
        videoPath: ex.video_path,
        primaryMuscles: ex.primary_muscles ?? [],
      });
      usedIds.add(ex.id);
    }
  }

  // If we have less than 6, fill from any remaining
  if (selected.length < 6) {
    const remaining = available.filter(e => !usedIds.has(e.id));
    for (const ex of remaining) {
      if (selected.length >= 6) break;
      selected.push({
        id: ex.id,
        name: ex.name,
        duration: 30,
        videoPath: ex.video_path,
        primaryMuscles: ex.primary_muscles ?? [],
      });
    }
  }

  return selected.slice(0, 6);
};

// Select 6 cooldown exercises — always full body (mix all available)
export const selectCooldownExercises = (
  available: DbExercise[],
  mainWorkoutMuscles: string[]
): WarmupExercise[] => {
  // Score all by muscle overlap, pick top 6
  const scored = available
    .map(e => {
      const muscles = e.primary_muscles ?? [];
      const overlap = muscles.filter(m => mainWorkoutMuscles.includes(m)).length;
      return { exercise: e, score: overlap };
    })
    .sort((a, b) => b.score - a.score);

  const selected: WarmupExercise[] = [];
  for (let i = 0; i < 6 && i < scored.length; i++) {
    const ex = scored[i].exercise;
    selected.push({
      id: ex.id,
      name: ex.name,
      duration: 30,
      videoPath: ex.video_path,
      primaryMuscles: ex.primary_muscles ?? [],
    });
  }
  return selected;
};

// Extract all target muscles from main workout exercises
export const getMainWorkoutMuscles = (
  exercises: { primary_muscles?: string[]; secondary_muscles?: string[] }[]
): string[] => {
  const muscles = new Set<string>();
  for (const ex of exercises) {
    ex.primary_muscles?.forEach(m => muscles.add(m));
    ex.secondary_muscles?.forEach(m => muscles.add(m));
  }
  return Array.from(muscles);
};
