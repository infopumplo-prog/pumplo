// ZRCADLO src/lib/warmupCooldownSelection.ts — stejná pravidla výběru
// rozcvičky a cooldownu, jaká používá appka (WarmupPlayer). Při změně pravidel
// změnit OBĚ kopie; vrací se tu přímo vybrané cviky z poolu, mapování na
// výstupní tvar si dělá volající.

export interface WarmupPoolExercise {
  id: string;
  name: string;
  name_en?: string | null;
  video_path: string | null;
  primary_muscles: string[] | null;
  body_region: string | null;
}

export const getTrainingFocus = (
  splitType: string,
  dayLetter: string,
): "upper" | "lower" | "full" => {
  switch (splitType) {
    case "ppl":
      // A = Push (upper), B = Pull (upper), C = Legs (lower)
      return dayLetter === "C" ? "lower" : "upper";
    case "upper_lower":
      // A = Upper, B = Lower
      return dayLetter === "B" ? "lower" : "upper";
    case "full_body":
    default:
      return "full";
  }
};

// 6 cviků rozcvičky (6 × 30 s = 3 min) podle zaměření dne.
// Upper: 3 upper + 3 core, Lower: 3 lower + 3 core, Full: 2+2+2.
export const selectWarmupExercises = (
  available: WarmupPoolExercise[],
  focus: "upper" | "lower" | "full",
  mainWorkoutMuscles: string[],
): WarmupPoolExercise[] => {
  const upper = available.filter((e) => e.body_region === "upper");
  const lower = available.filter((e) => e.body_region === "lower");
  const core = available.filter((e) => e.body_region === "core");

  let slots: { region: string; count: number }[];
  switch (focus) {
    case "upper":
      slots = [{ region: "upper", count: 3 }, { region: "core", count: 3 }];
      break;
    case "lower":
      slots = [{ region: "lower", count: 3 }, { region: "core", count: 3 }];
      break;
    case "full":
    default:
      slots = [
        { region: "upper", count: 2 },
        { region: "lower", count: 2 },
        { region: "core", count: 2 },
      ];
      break;
  }

  const pools: Record<string, WarmupPoolExercise[]> = { upper, lower, core };
  const selected: WarmupPoolExercise[] = [];
  const usedIds = new Set<string>();

  for (const slot of slots) {
    const pool = pools[slot.region] || [];
    const scored = pool
      .filter((e) => !usedIds.has(e.id))
      .map((e) => {
        const muscles = e.primary_muscles ?? [];
        const overlap = muscles.filter((m) => mainWorkoutMuscles.includes(m)).length;
        return { exercise: e, score: overlap };
      })
      .sort((a, b) => b.score - a.score);

    for (let i = 0; i < slot.count && i < scored.length; i++) {
      const ex = scored[i].exercise;
      selected.push(ex);
      usedIds.add(ex.id);
    }
  }

  if (selected.length < 6) {
    const remaining = available.filter((e) => !usedIds.has(e.id));
    for (const ex of remaining) {
      if (selected.length >= 6) break;
      selected.push(ex);
    }
  }

  return selected.slice(0, 6);
};

// 6 cviků cooldownu — vždy celé tělo, řazeno podle překryvu svalů.
export const selectCooldownExercises = (
  available: WarmupPoolExercise[],
  mainWorkoutMuscles: string[],
): WarmupPoolExercise[] => {
  const scored = available
    .map((e) => {
      const muscles = e.primary_muscles ?? [];
      const overlap = muscles.filter((m) => mainWorkoutMuscles.includes(m)).length;
      return { exercise: e, score: overlap };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 6).map((s) => s.exercise);
};
