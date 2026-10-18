import { supabase } from '@/integrations/supabase/client';
import { FOCUS_IMAGES } from '@/lib/focusImages';

// Veřejné tréninky (sekce Tréninky): vlastní plán, který trenér zveřejnil do katalogu.
// is_public/share_token = jen odkaz; published_at = navíc vidět v katalogu.
// Zveřejňovat smí jen schválený trenér pod posilovnou — hlídá to i trigger v DB.

export const WORKOUT_GOALS = ['strength', 'muscle', 'weight_loss', 'endurance', 'general'] as const;
export const WORKOUT_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
// Partie těla = kategorie cviků v appce (+ hýždě). Připraveno i pro budoucí plány podle partií.
export const WORKOUT_FOCUSES = ['full_body', 'glutes', 'legs', 'chest', 'back', 'shoulders', 'arms', 'core', 'cardio'] as const;
export const DESCRIPTION_MAX = 500;

export type WorkoutGoal = (typeof WORKOUT_GOALS)[number];
export type WorkoutLevel = (typeof WORKOUT_LEVELS)[number];
export type WorkoutFocus = (typeof WORKOUT_FOCUSES)[number];
export type WorkoutSort = 'popular' | 'newest' | 'liked';

export interface PublishMeta {
  description: string;
  goal: WorkoutGoal | null;
  level: WorkoutLevel | null;
  focus: WorkoutFocus | null;
  secondary_focuses?: WorkoutFocus[];
  cover_url?: string | null;
}

export interface PublicWorkout {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  goal: WorkoutGoal | null;
  level: WorkoutLevel | null;
  focus: WorkoutFocus | null;
  secondary_focuses: WorkoutFocus[];
  cover_url: string | null;
  share_token: string;
  published_at: string;
  is_own: boolean;
  trainer_name: string;
  trainer_photo_url: string | null;
  trainer_gym_name: string | null;
  day_count: number;
  exercise_count: number;
  save_count: number;
  like_count: number;
  liked_by_me: boolean;
}

export interface PublicWorkoutFilters {
  gymId?: string | null;
  goal?: WorkoutGoal | null;
  focus?: WorkoutFocus | null;
  search?: string;
  sort?: WorkoutSort;
}

export type PublishError = 'empty_plan' | 'description_too_long' | 'invalid_goal' | 'invalid_level' | 'invalid_focus';

const isOneOf = <T extends string>(list: readonly T[], v: string | null): v is T => v !== null && (list as readonly string[]).includes(v);

/** Pravidla zveřejnění — stejná jako CHECK constrainty v DB, ať chyba přijde dřív než z API. */
export const validatePublish = (meta: PublishMeta, exerciseCount: number): PublishError | null => {
  if (exerciseCount < 1) return 'empty_plan';
  if (meta.description.trim().length > DESCRIPTION_MAX) return 'description_too_long';
  if (meta.goal !== null && !isOneOf(WORKOUT_GOALS, meta.goal)) return 'invalid_goal';
  if (meta.level !== null && !isOneOf(WORKOUT_LEVELS, meta.level)) return 'invalid_level';
  if (meta.focus !== null && !isOneOf(WORKOUT_FOCUSES, meta.focus)) return 'invalid_focus';
  const secondary = meta.secondary_focuses ?? [];
  if (secondary.some((f) => !isOneOf(WORKOUT_FOCUSES, f) || f === meta.focus)) return 'invalid_focus';
  return null;
};

/** Hledaný text: oříznout, prázdný = bez filtru, max 60 znaků. */
export const normalizeSearch = (raw: string | undefined): string | null => {
  const s = (raw ?? '').trim().slice(0, 60);
  return s.length ? s : null;
};

/** Lajk přepnutý lokálně (optimisticky) — počet nikdy pod nulu. */
export const toggleLikeLocal = (w: PublicWorkout): PublicWorkout => ({
  ...w,
  liked_by_me: !w.liked_by_me,
  like_count: Math.max(0, w.like_count + (w.liked_by_me ? -1 : 1)),
});

export const asGoal = (v: string | null): WorkoutGoal | null => (isOneOf(WORKOUT_GOALS, v) ? v : null);
export const asLevel = (v: string | null): WorkoutLevel | null => (isOneOf(WORKOUT_LEVELS, v) ? v : null);
export const asFocus = (v: string | null): WorkoutFocus | null => (isOneOf(WORKOUT_FOCUSES, v) ? v : null);

// RPC a nová tabulka zatím nejsou ve vygenerovaných typech Supabase.
// Musí zůstat navázané na klienta (this) — odpojené supabase.rpc v appce spadne ještě před dotazem.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args?: Record<string, unknown>) => (supabase as any).rpc(name, args);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const likes = () => (supabase as any).from('workout_likes');

export const fetchPublicWorkouts = async (filters: PublicWorkoutFilters): Promise<PublicWorkout[]> => {
  const { data, error } = await rpc('list_public_workouts', {
    p_gym_id: filters.gymId ?? null,
    p_goal: filters.goal ?? null,
    p_focus: filters.focus ?? null,
    p_search: normalizeSearch(filters.search),
    p_sort: filters.sort ?? 'popular',
    p_limit: 50,
  });
  if (error) throw error;
  return (data ?? []) as PublicWorkout[];
};

/** ID trenérského záznamu přihlášeného uživatele, nebo null (není trenér pod posilovnou). */
export const fetchMyTrainerId = async (): Promise<string | null> => {
  const { data, error } = await rpc('my_active_trainer_id');
  if (error) return null;
  return (data as string | null) ?? null;
};

export const setWorkoutLiked = async (planId: string, userId: string, liked: boolean) => {
  const { error } = liked
    ? await likes().insert({ plan_id: planId, user_id: userId })
    : await likes().delete().eq('plan_id', planId).eq('user_id', userId);
  // Dvojklik: lajk už existuje → není to chyba.
  if (error && error.code !== '23505') throw error;
};

export const publishPlan = async (planId: string, meta: PublishMeta, alreadyPublishedAt: string | null) => {
  const { error } = await supabase
    .from('custom_plans')
    .update({
      is_public: true,
      // Úprava popisu zveřejněný plán neposouvá na začátek katalogu.
      published_at: alreadyPublishedAt ?? new Date().toISOString(),
      description: meta.description.trim() || null,
      goal: meta.goal,
      level: meta.level,
      focus: meta.focus,
      // Hlavní partie nesmí být zároveň další (CHECK v DB).
      secondary_focuses: (meta.secondary_focuses ?? []).filter((f) => f !== meta.focus),
      ...(meta.cover_url !== undefined ? { cover_url: meta.cover_url } : {}),
    })
    .eq('id', planId);
  if (error) throw error;
};

/** Stáhne z katalogu. Odkaz (is_public) nechává, ať nepřestanou fungovat už poslané odkazy. */
export const unpublishPlan = async (planId: string) => {
  const { error } = await supabase
    .from('custom_plans')
    .update({ published_at: null })
    .eq('id', planId);
  if (error) throw error;
};

// --- Obrázky -----------------------------------------------------------------
// Dlaždice partií = snímky z videí cviků Pumplo (přibalené v appce, public/img/workouts/).
// Mapa fotek je v src/lib/focusImages.ts (feedback 13. 10.).
export const focusImage = (focus: WorkoutFocus | null | undefined): string =>
  FOCUS_IMAGES[focus ?? 'full_body'] ?? (FOCUS_IMAGES.full_body as string);

/** Obálka tréninku: nahraná trenérem, jinak obrázek partie. */
export const coverFor = (w: { cover_url?: string | null; focus?: WorkoutFocus | string | null }): string =>
  w.cover_url || focusImage(asFocus((w.focus as string) ?? null));

const COVER_MAX_PX = 1080;

/** Zmenší fotku na max 1080 px (JPEG) a nahraje ji do gym-assets/workout-covers/<uid>/. */
export const uploadWorkoutCover = async (file: File, userId: string, planId: string): Promise<string> => {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, COVER_MAX_PX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  if (!blob) throw new Error('cover_encode_failed');
  const path = `workout-covers/${userId}/${planId}-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from('gym-assets').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '3600' });
  if (error) throw error;
  return supabase.storage.from('gym-assets').getPublicUrl(path).data.publicUrl;
};

// --- Přizpůsobení posilovně --------------------------------------------------
/**
 * Po uložení tréninku z katalogu vymění cviky, na které posilovna nemá stroj,
 * za nejlepší náhradu (stejná role, nejvíc společných svalů) — stejná logika
 * jako kontrola vybavení před startem tréninku. Vrací počet vyměněných cviků.
 */
export const adaptPlanToGym = async (planId: string, gymId: string): Promise<number> => {
  const { checkCustomPlanEquipment } = await import('@/lib/gymEquipmentCheck');
  const incompatible = await checkCustomPlanEquipment(planId, gymId);
  const { data: days } = await supabase.from('custom_plan_days').select('id').eq('plan_id', planId);
  const dayIds = (days ?? []).map((d) => d.id);
  if (!dayIds.length) return 0;
  let swapped = 0;
  for (const ex of incompatible) {
    const best = ex.alternatives[0];
    if (!best) continue;
    const { error } = await supabase
      .from('custom_plan_exercises')
      .update({ exercise_id: best.id })
      .in('day_id', dayIds)
      .eq('exercise_id', ex.exercise_id);
    if (!error) swapped++;
  }
  return swapped;
};

// --- Hledání podle partie ------------------------------------------------------
// „zadek“, „prsa“, „ruce“… → filtr partie místo fulltextu (David hledal „Zadek“).
const FOCUS_WORDS: Record<WorkoutFocus, string[]> = {
  glutes: ['zadek', 'hyzde', 'hyzdovy', 'booty', 'glutes', 'pozadi'],
  legs: ['nohy', 'noha', 'stehna', 'leg', 'legs', 'lytka'],
  chest: ['prsa', 'hrudnik', 'chest', 'prsni', 'hrud'],
  back: ['zada', 'back', 'zadni'],
  arms: ['ruce', 'paze', 'biceps', 'triceps', 'arms', 'arm'],
  shoulders: ['ramena', 'rameno', 'shoulders', 'delty'],
  core: ['bricho', 'core', 'stred', 'stred tela', 'abs', 'sixpack'],
  full_body: ['cele telo', 'full body', 'fullbody', 'celotelovy'],
  cardio: ['kardio', 'cardio', 'vytrvalost', 'beh', 'spalovani'],
};

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Vrátí partii, pokud hledaný text je jen slovo pro partii; jinak null. */
export const searchToFocus = (raw: string | undefined): WorkoutFocus | null => {
  const q = fold(raw ?? '');
  if (!q) return null;
  for (const f of WORKOUT_FOCUSES) {
    if (FOCUS_WORDS[f].some((w) => w === q || (q.length >= 4 && w.startsWith(q)))) return f;
  }
  return null;
};

// --- Jazyk ---------------------------------------------------------------------
/** Název/popis v jazyce appky; anglická verze, když existuje, jinak originál od trenéra. */
export const localizedText = (cs: string | null, en: string | null | undefined, lang: string): string | null =>
  lang.startsWith('en') ? (en?.trim() ? en : cs) : cs;

/** Přepne další partii; hlavní partie mezi dalšími být nemůže. Pořadí drží WORKOUT_FOCUSES. */
export const toggleSecondaryFocus = (current: WorkoutFocus[], f: WorkoutFocus, primary: WorkoutFocus | null): WorkoutFocus[] => {
  if (f === primary) return current;
  const next = current.includes(f) ? current.filter((x) => x !== f) : [...current, f];
  return WORKOUT_FOCUSES.filter((x) => next.includes(x));
};
