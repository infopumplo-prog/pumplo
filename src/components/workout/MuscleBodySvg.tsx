// Anatomical front/back body figure with per-muscle highlight. Rendering uses
// react-body-highlighter (MIT) — real muscle-shaped polygons, individually
// addressable — wrapped so callers keep our simple API: MUSCLE_GROUPS keys
// (src/lib/muscleGroups.ts) with 0..1 intensity blending grey → Pumplo cyan.
import { useMemo } from 'react';
import Model, { type IExerciseData, type Muscle } from 'react-body-highlighter';

interface MuscleBodySvgProps {
  intensities: Record<string, number>; // group key -> 0..1
  side: 'front' | 'back';
  width?: number;
  dark?: boolean; // true on dark backgrounds (share card), false on app sheets
}

// Our muscle-group keys → the highlighter's anatomical muscle names.
const GROUP_TO_MUSCLES: Record<string, Muscle[]> = {
  chest: ['chest'],
  back: ['trapezius', 'upper-back'],
  shoulders: ['front-deltoids', 'back-deltoids'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  arms: ['forearm'],
  core: ['abs', 'obliques', 'lower-back'],
  legs: ['quadriceps', 'hamstring', 'adductor', 'abductors'],
  glutes: ['gluteal'],
  calves: ['calves'],
};

// 6-step ramp: the MORE a muscle is trained, the DARKER the blue.
// grey-blue → Pumplo cyan (mid) → deep blue (top).
const STEPS = 6;
const CYAN: [number, number, number] = [76, 201, 255];
const DEEP: [number, number, number] = [13, 94, 175]; // deep blue for the most-trained
const lerp = (a: [number, number, number], b: [number, number, number], t: number) =>
  a.map((v, k) => Math.round(v + (b[k] - v) * t)) as [number, number, number];
const rampColor = (i: number, dark: boolean): string => {
  const base: [number, number, number] = dark ? [148, 163, 184] : [203, 213, 225];
  const t = i / (STEPS - 1);
  const mix = t <= 0.5
    ? lerp(base, CYAN, 0.3 + 1.4 * t)   // 0→0.5: grey → cyan
    : lerp(CYAN, DEEP, (t - 0.5) * 2);   // 0.5→1: cyan → deep blue
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
};

export const MuscleBodySvg = ({ intensities, side, width = 110, dark = false }: MuscleBodySvgProps) => {
  const highlightedColors = useMemo(
    () => Array.from({ length: STEPS }, (_, i) => rampColor(i, dark)),
    [dark]
  );

  // One synthetic "exercise" per bucket so frequency == bucket index + 1.
  const data = useMemo(() => {
    const byBucket = new Map<number, Muscle[]>();
    Object.entries(intensities).forEach(([group, v]) => {
      const muscles = GROUP_TO_MUSCLES[group];
      if (!muscles || !v || v <= 0) return;
      const bucket = Math.min(STEPS - 1, Math.max(0, Math.round(v * (STEPS - 1))));
      byBucket.set(bucket, [...(byBucket.get(bucket) || []), ...muscles]);
    });
    const out: IExerciseData[] = [];
    byBucket.forEach((muscles, bucket) => {
      out.push({ name: `bucket-${bucket}`, muscles, frequency: bucket + 1 });
    });
    return out;
  }, [intensities]);

  return (
    <Model
      type={side === 'front' ? 'anterior' : 'posterior'}
      data={data}
      bodyColor={dark ? 'rgba(255,255,255,0.16)' : '#E2E8F0'}
      highlightedColors={highlightedColors}
      style={{ width, padding: 0 }}
    />
  );
};
