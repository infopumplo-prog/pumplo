// Anatomical front/back body figure with per-muscle-group highlight, Hevy-style.
// Keys follow MUSCLE_GROUPS (src/lib/muscleGroups.ts). Every region is ALWAYS
// painted in a light grey base and blends towards Pumplo cyan with load.
// Left-side muscles are defined once and mirrored for perfect symmetry.
// Deliberately standalone so it can be reused on exercise detail / statistics.
import React from 'react';

interface MuscleBodySvgProps {
  intensities: Record<string, number>; // group key -> 0..1
  side: 'front' | 'back';
  width?: number;
  dark?: boolean; // true on dark backgrounds (share card), false on app sheets
}

const CYAN: [number, number, number] = [76, 201, 255];
const BASE_LIGHT: [number, number, number] = [226, 232, 240]; // slate-200
const BASE_DARK: [number, number, number] = [148, 163, 184];  // slate-400

const fillFor = (intensities: Record<string, number>, key: string, dark: boolean) => {
  const base = dark ? BASE_DARK : BASE_LIGHT;
  const v = Math.min(Math.max(intensities[key] ?? 0, 0), 1);
  const t = v <= 0 ? 0 : 0.3 + 0.7 * v;
  const mix = base.map((b, i) => Math.round(b + (CYAN[i] - b) * t));
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
};

// Renders children twice: as-is (left half) and mirrored across x=50 (right half).
const Mirror = ({ children }: { children: React.ReactNode }) => (
  <>
    <g>{children}</g>
    <g transform="translate(100,0) scale(-1,1)">{children}</g>
  </>
);

// Connected humanoid silhouette (shared by both sides): head, neck, torso with
// waist taper, arms with hands, legs with feet.
const Silhouette = ({ dark }: { dark: boolean }) => (
  <g fill={dark ? 'rgba(255,255,255,0.10)' : 'rgba(100,116,139,0.15)'}>
    <circle cx="50" cy="12" r="8.5" />
    <path d="M46 19 h8 v8 h-8 z" />
    <Mirror>
      {/* half torso: shoulder → waist taper → hip */}
      <path d="M50 26 L38 29 Q31 31 29 38 L31 48 Q33 55 35 62 L36 76 Q36 84 34 92 L36 100 L50 102 Z" />
      {/* arm: delt → elbow → wrist → hand */}
      <path d="M31 31 Q25 33 23.5 40 L22 55 Q21 63 20 72 L17.5 90 Q17 94 19.5 94.5 Q22 95 22.8 91 L26 73 Q27 64 27.5 55 L29 40 Z" />
      <circle cx="18.6" cy="97.5" r="3.2" />
      {/* leg: hip → thigh → knee → calf → ankle → foot */}
      <path d="M35 96 Q34 112 36 128 L38 148 Q38.5 156 38 166 L38.5 186 Q38.6 191 41 191.5 L47 191.5 Q49 191 49 186 L48.5 150 L49.5 104 L50 98 Z" />
      <path d="M38 189 Q34 192 34.5 194.5 Q35 196.5 39 196.5 L46 196.5 Q48.5 196 48.5 193.5 L48.5 190 Z" />
    </Mirror>
  </g>
);

export const MuscleBodySvg = ({ intensities, side, width = 110, dark = false }: MuscleBodySvgProps) => {
  const f = (key: string) => fillFor(intensities, key, dark);
  const gap = dark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.85)'; // separation lines

  return (
    <svg width={width} viewBox="0 0 100 220" fill="none">
      <Silhouette dark={dark} />
      {side === 'front' ? (
        <g>
          <Mirror>
            {/* upper traps (neck → shoulder) */}
            <path d="M46 25 Q40 27 34 30.5 L45 31 Q46.5 28 46 25 Z" fill={f('back')} />
            {/* deltoid cap */}
            <path d="M37.5 30 Q30.5 30.5 28.5 37 Q28 42 31 45 Q34.5 44 36 39.5 Q37 34 37.5 30 Z" fill={f('shoulders')} />
            {/* pec — fan from sternum to armpit */}
            <path d="M49.2 32.5 Q41 32.5 37 36 Q34 39.5 35.5 44.5 Q38 49.5 44 50.5 Q48 51 49.2 49.5 Z" fill={f('chest')} />
            {/* biceps (two subtle lobes) */}
            <path d="M30.5 46 Q27.5 48 26.5 54 Q26 61 28.5 65.5 Q31.5 64 32.5 58 Q33.2 50 30.5 46 Z" fill={f('biceps')} />
            {/* forearm */}
            <path d="M26.5 67 Q23.5 70 22.3 77 L20.5 88 Q22.5 90.5 24.5 88.5 L26.8 77 Q27.6 71 26.5 67 Z" fill={f('arms')} />
            {/* obliques (side slats) */}
            <path d="M39 54 Q37.5 62 38 70 Q38.5 77 41 81 L43 80 Q41.5 72 41.5 63 Q41.5 57 41 53.5 Z" fill={f('core')} />
            {/* rectus abdominis — 3 blocks + lower slab (left column) */}
            <rect x="44" y="52.5" width="5.2" height="7.6" rx="2" fill={f('core')} />
            <rect x="44" y="61.1" width="5.2" height="7.6" rx="2" fill={f('core')} />
            <rect x="44" y="69.7" width="5.2" height="7.6" rx="2" fill={f('core')} />
            <path d="M44 78.5 h5.2 v6 Q49.2 88.5 46.5 89.5 Q44 88 44 84 Z" fill={f('core')} />
            {/* quads: vastus lateralis / rectus femoris / vastus medialis */}
            <path d="M36.5 103 Q34.8 116 36 128 Q36.8 136 38.5 140 Q40 133 39.5 120 Q39 109 38.5 103.5 Z" fill={f('legs')} />
            <path d="M40.5 102 Q39.5 116 40.5 130 Q41.3 138 43 141 Q44.8 135 44.6 121 Q44.4 108 43.5 102 Z" fill={f('legs')} />
            <path d="M45.5 124 Q44.8 133 46 139.5 Q48.3 141.5 48.6 136 Q48.8 129 47.6 124 Z" fill={f('legs')} />
            {/* adductor (inner upper thigh) */}
            <path d="M45.5 103 Q44.8 111 45.6 119 Q47.6 121 48.2 114 Q48.5 107 47.8 103 Z" fill={f('legs')} />
            {/* calf peeking from the side + tibialis stays neutral */}
            <path d="M38.5 150 Q37.3 158 37.8 167 Q38.6 172 40 174 Q40.8 166 40.4 157 Q40.2 152 39.6 150 Z" fill={f('calves')} />
          </Mirror>
        </g>
      ) : (
        <g>
          <Mirror>
            {/* trapezius (upper diamond half) */}
            <path d="M49.5 24 Q45 27 37 31 Q42 34 46 39 Q48.5 45 49.5 56 L49.5 24 Z" fill={f('back')} />
            {/* rear deltoid */}
            <path d="M36.5 30 Q30 31 28.5 37.5 Q28.2 42 31 45 Q34.5 43.5 35.8 39 Q36.6 34 36.5 30 Z" fill={f('shoulders')} />
            {/* latissimus — V from armpit to lower spine */}
            <path d="M35 42 Q32.5 48 34.5 56 Q37.5 65 44 71.5 Q48 74.5 49.3 74 L49.3 58 Q42 52 38 46 Q36 43.5 35 42 Z" fill={f('back')} />
            {/* teres/infraspinatus patch between trap and lat */}
            <path d="M36.5 40 Q40.5 44 45 47.5 Q47.5 49 49 49.5 L49 42.5 Q44 41 39.5 38.5 Z" fill={f('back')} />
            {/* erector spinae (lower back column) */}
            <path d="M45.5 74 Q44.8 82 45.5 90 Q47 93 49.2 92.5 L49.2 74.5 Q47 73.5 45.5 74 Z" fill={f('core')} />
            {/* triceps (horseshoe) */}
            <path d="M30 46 Q27 49 26.3 55.5 Q26 62 28.3 66 Q31.5 64.5 32.5 57.5 Q33 50 30 46 Z" fill={f('triceps')} />
            {/* forearm */}
            <path d="M26.5 67 Q23.5 70 22.3 77 L20.5 88 Q22.5 90.5 24.5 88.5 L26.8 77 Q27.6 71 26.5 67 Z" fill={f('arms')} />
            {/* glute */}
            <path d="M37 92.5 Q34.5 96 34.8 102 Q35.5 108.5 41 110.5 Q47.5 111.5 49.3 106.5 Q50 100 48 95.5 Q44.5 91.5 40.5 91.8 Q38.5 92 37 92.5 Z" fill={f('glutes')} />
            {/* hamstrings: biceps femoris + semitendinosus */}
            <path d="M36.8 113 Q35.5 124 36.6 135 Q37.5 142 39.3 145 Q40.8 137 40.3 125 Q40 117 39 113 Z" fill={f('legs')} />
            <path d="M42 112.5 Q41 124 42 136 Q42.8 143 44.5 146 Q46.2 139 45.8 126 Q45.5 116 44.8 112.5 Z" fill={f('legs')} />
            {/* gastrocnemius (two lobes) + soleus taper */}
            <path d="M37.8 150 Q36.3 156 36.8 163 Q37.5 169 39.5 171 Q40.8 165 40.4 156 Q40.2 151.5 39.4 150 Z" fill={f('calves')} />
            <path d="M42.5 149.5 Q41.5 156 42 163 Q42.7 168.5 44.5 170.5 Q45.8 164 45.4 155.5 Q45.2 151 44.4 149.5 Z" fill={f('calves')} />
            <path d="M39.5 173 Q39 178 39.6 183 Q41 185 42.6 183.5 Q43.2 178 42.8 173.5 Q41 172 39.5 173 Z" fill={f('calves')} />
          </Mirror>
          {/* spine separation line */}
          <line x1="50" y1="27" x2="50" y2="92" stroke={gap} strokeWidth="0.8" />
        </g>
      )}
    </svg>
  );
};
