// Hevy-style set types for custom workouts. Shared by the routine editor
// (CustomPlanDetail) and the player (CustomWorkoutPlayer / CompactWorkoutView)
// so badges, colours and the ? explanations stay identical everywhere.
//
// Persisted per exercise in custom_plan_exercises.set_types (text[]), parallel
// to reps_per_set / weight_per_set. A missing / null entry means a normal
// working set, so the feature degrades gracefully before the column exists.

export type SetType = 'W' | 'normal' | 'F' | 'D';

// Order shown in the "Typ série" sheet (Remove is handled separately).
export const SELECTABLE_SET_TYPES: SetType[] = ['W', 'normal', 'F', 'D'];

interface SetTypeMeta {
  // Tailwind text colour for the badge letter.
  color: string;
  // i18n key for the short label shown in the type sheet.
  labelKey: string;
  // i18n key for the ? explanation alert.
  explainKey: string;
}

export const SET_TYPE_META: Record<SetType, SetTypeMeta> = {
  W: { color: 'text-orange-500', labelKey: 'set_type.warmup_label', explainKey: 'set_type.warmup_explain' },
  normal: { color: 'text-muted-foreground', labelKey: 'set_type.normal_label', explainKey: 'set_type.normal_explain' },
  F: { color: 'text-red-500', labelKey: 'set_type.failure_label', explainKey: 'set_type.failure_explain' },
  D: { color: 'text-blue-500', labelKey: 'set_type.drop_label', explainKey: 'set_type.drop_explain' },
};

export const getSetType = (types: (string | null | undefined)[] | null | undefined, index: number): SetType => {
  const raw = types?.[index];
  return raw === 'W' || raw === 'F' || raw === 'D' ? raw : 'normal';
};

// Badge label shown in the SÉRIE column: W/F/D as letters, normal sets numbered
// by their working-set ordinal (warm-ups don't count towards the number).
export const setBadgeLabel = (types: (string | null | undefined)[] | null | undefined, index: number): string => {
  const t = getSetType(types, index);
  if (t !== 'normal') return t;
  let n = 0;
  for (let i = 0; i <= index; i++) {
    if (getSetType(types, i) !== 'W') n++;
  }
  return String(n);
};

export const setBadgeColor = (types: (string | null | undefined)[] | null | undefined, index: number): string =>
  SET_TYPE_META[getSetType(types, index)].color;
