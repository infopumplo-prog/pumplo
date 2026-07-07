import { groupForMuscle } from '@/lib/muscleGroups';

// Hevy-style muscle distribution: primary muscle = 1 point per completed set,
// secondary = 0.5. Grouped by MUSCLE_GROUPS keys; unmatched raw muscle names
// keep their own bucket (key: null) so the caller can label them directly.
export interface MuscleDistItem {
  primaryMuscles: string[];
  secondaryMuscles: string[];
  completedSets: number;
}

export interface MuscleDistEntry { key: string | null; raw: string; value: number }

export function computeMuscleDistribution(items: MuscleDistItem[]): MuscleDistEntry[] {
  const buckets = new Map<string, MuscleDistEntry>();
  const add = (muscle: string, amount: number) => {
    const gk = groupForMuscle(muscle);
    const bucketKey = gk ?? 'raw:' + muscle;
    const cur = buckets.get(bucketKey) || { key: gk, raw: muscle, value: 0 };
    cur.value += amount;
    buckets.set(bucketKey, cur);
  };
  items.forEach(it => {
    if (!it.completedSets) return;
    it.primaryMuscles.forEach(m => add(m, it.completedSets));
    it.secondaryMuscles.forEach(m => add(m, it.completedSets * 0.5));
  });
  return [...buckets.values()].filter(b => b.value > 0).sort((a, b) => b.value - a.value);
}

// Normalised 0–1 intensity per GROUP key (raw-only buckets dropped) — feeds
// the MuscleBodySvg highlight.
export function muscleIntensities(dist: MuscleDistEntry[]): Record<string, number> {
  const max = dist[0]?.value || 1;
  const out: Record<string, number> = {};
  dist.forEach(d => { if (d.key) out[d.key] = Math.max(out[d.key] ?? 0, d.value / max); });
  return out;
}
