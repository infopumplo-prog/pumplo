// Stylised front/back body figure with per-muscle-group highlight, Hevy-style.
// Keys follow MUSCLE_GROUPS (src/lib/muscleGroups.ts). A connected silhouette
// sits underneath; muscle regions are painted on top of it. Deliberately
// standalone so it can be reused on exercise detail / statistics later.
interface MuscleBodySvgProps {
  intensities: Record<string, number>; // group key -> 0..1
  side: 'front' | 'back';
  width?: number;
}

const BASE = 'rgba(255,255,255,0.10)';
const fillFor = (intensities: Record<string, number>, key: string) => {
  const v = intensities[key];
  if (!v || v <= 0) return 'transparent';
  return `rgba(76, 201, 255, ${(0.3 + 0.7 * Math.min(v, 1)).toFixed(2)})`;
};

// Connected humanoid silhouette shared by both sides.
const Silhouette = () => (
  <g fill={BASE}>
    <circle cx="50" cy="13" r="9" />
    <rect x="45" y="21" width="10" height="9" rx="3" />
    {/* torso + pelvis */}
    <path d="M33 30 h34 q4 0 4 5 l-3 46 q-1 5 -5 6 l-4 10 h-18 l-4 -10 q-4 -1 -5 -6 l-3 -46 q0 -5 4 -5 z" />
    {/* arms */}
    <path d="M30 31 q-8 2 -10 12 l-4 40 q0 6 5 6 t6 -5 l6 -40 z" />
    <path d="M70 31 q8 2 10 12 l4 40 q0 6 -5 6 t-6 -5 l-6 -40 z" />
    {/* legs */}
    <path d="M35 96 l13 1 v78 q0 5 -6 5 t-6 -5 z" />
    <path d="M65 96 l-13 1 v78 q0 5 6 5 t6 -5 z" />
  </g>
);

export const MuscleBodySvg = ({ intensities, side, width = 110 }: MuscleBodySvgProps) => {
  const f = (key: string) => fillFor(intensities, key);

  return (
    <svg width={width} viewBox="0 0 100 220" fill="none">
      <Silhouette />
      {side === 'front' ? (
        <g>
          {/* shoulders */}
          <ellipse cx="30" cy="37" rx="8" ry="6" fill={f('shoulders')} />
          <ellipse cx="70" cy="37" rx="8" ry="6" fill={f('shoulders')} />
          {/* chest */}
          <path d="M37 34 h26 v12 a13 8 0 0 1 -26 0 z" fill={f('chest')} />
          {/* biceps */}
          <ellipse cx="25" cy="55" rx="5" ry="10" fill={f('biceps')} />
          <ellipse cx="75" cy="55" rx="5" ry="10" fill={f('biceps')} />
          {/* forearms (arms) */}
          <ellipse cx="21.5" cy="77" rx="4.5" ry="11" fill={f('arms')} />
          <ellipse cx="78.5" cy="77" rx="4.5" ry="11" fill={f('arms')} />
          {/* core */}
          <rect x="39" y="53" width="22" height="28" rx="7" fill={f('core')} />
          {/* quads (legs) */}
          <ellipse cx="41.5" cy="118" rx="7" ry="21" fill={f('legs')} />
          <ellipse cx="58.5" cy="118" rx="7" ry="21" fill={f('legs')} />
        </g>
      ) : (
        <g>
          {/* rear shoulders */}
          <ellipse cx="30" cy="37" rx="8" ry="6" fill={f('shoulders')} />
          <ellipse cx="70" cy="37" rx="8" ry="6" fill={f('shoulders')} />
          {/* back (traps + lats as one region) */}
          <path d="M37 33 h26 l-2 32 a11 9 0 0 1 -22 0 z" fill={f('back')} />
          {/* triceps */}
          <ellipse cx="25" cy="55" rx="5" ry="10" fill={f('triceps')} />
          <ellipse cx="75" cy="55" rx="5" ry="10" fill={f('triceps')} />
          {/* forearms (arms) */}
          <ellipse cx="21.5" cy="77" rx="4.5" ry="11" fill={f('arms')} />
          <ellipse cx="78.5" cy="77" rx="4.5" ry="11" fill={f('arms')} />
          {/* glutes */}
          <ellipse cx="43.5" cy="89" rx="8.5" ry="8" fill={f('glutes')} />
          <ellipse cx="56.5" cy="89" rx="8.5" ry="8" fill={f('glutes')} />
          {/* hamstrings (legs) */}
          <ellipse cx="41.5" cy="122" rx="6.5" ry="19" fill={f('legs')} />
          <ellipse cx="58.5" cy="122" rx="6.5" ry="19" fill={f('legs')} />
          {/* calves */}
          <ellipse cx="42" cy="160" rx="5.5" ry="15" fill={f('calves')} />
          <ellipse cx="58" cy="160" rx="5.5" ry="15" fill={f('calves')} />
        </g>
      )}
    </svg>
  );
};
