// Anatomical front/back body figure with per-muscle highlight. Rendering uses
// react-body-highlighter (MIT) — real muscle-shaped polygons, individually
// addressable — wrapped so callers keep our simple API: MUSCLE_GROUPS keys
// (src/lib/muscleGroups.ts) with 0..1 intensity blending grey → Pumplo cyan.
import { useMemo } from 'react';
import Model, { type IExerciseData, type Muscle } from 'react-body-highlighter';
import { ACCENT_SWATCH, asAccent } from '@/lib/accentColors';

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

// 6-step ramp: the MORE a muscle is trained, the DARKER the colour.
// grey → app accent (mid) → deep accent (top). Accent = the colour the person
// picked (blue default); before 13. 10. 2026 it was always Pumplo cyan.
const STEPS = 6;
type RGB = [number, number, number];
const hslToRgb = (h: number, s: number, l: number): RGB => {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
};
const parseHsl = (v: string): [number, number, number] => {
  const [h, s, l] = v.replace(/%/g, '').split(/\s+/).map(Number);
  return [h, s, l];
};
const lerp = (a: RGB, b: RGB, t: number) =>
  a.map((v, k) => Math.round(v + (b[k] - v) * t)) as RGB;
const rampColor = (i: number, dark: boolean, mid: RGB, deep: RGB): string => {
  const base: RGB = dark ? [148, 163, 184] : [203, 213, 225];
  const t = i / (STEPS - 1);
  const mix = t <= 0.5
    ? lerp(base, mid, 0.3 + 1.4 * t)   // 0→0.5: grey → accent
    : lerp(mid, deep, (t - 0.5) * 2);   // 0.5→1: accent → deep accent
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
};

export const MuscleBodySvg = ({ intensities, side, width = 110, dark = false }: MuscleBodySvgProps) => {
  // Z <html data-accent> (ThemeContext) — funguje i ve share kartě mimo provider.
  const accent = asAccent(typeof document !== 'undefined' ? document.documentElement.dataset.accent : null);
  const highlightedColors = useMemo(() => {
    const [h, sat, l] = parseHsl(ACCENT_SWATCH[accent].light);
    const mid = accent === 'blue' ? [76, 201, 255] as RGB : hslToRgb(h, sat, l);
    const deep = accent === 'blue' ? [13, 94, 175] as RGB : hslToRgb(h, Math.min(100, sat + 5), Math.max(18, l * 0.55));
    return Array.from({ length: STEPS }, (_, i) => rampColor(i, dark, mid, deep));
  }, [dark, accent]);

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
