import { createClient } from "npm:@supabase/supabase-js@2";
import {
  getCurrentDayLetter,
  getNextDayLetter,
  getRestSecondsForCategory,
  getRIRGuidance,
} from "../_shared/planRules.ts";

// Backend samostatných hodinek. Hodinky nemají webovou vrstvu appky, takže
// pravidla plánu (který den, jaké RIR, jak dlouhá pauza) musí někdo složit —
// dělá to tahle funkce, aby nevznikla druhá kopie pravidel ve Swiftu.
//
// Uživatel se VŽDY bere z tokenu, nikdy z těla požadavku.
//
// Cesty:
//   GET  /watch-api/menu      co nabídnout, když trénink neběží
//   GET  /watch-api/workout   hotový trénink k odcvičení
//                             ?kind=plan | ?kind=custom&planId=&dayId=

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Klient bez vygenerovaných typů databáze vrací řádky jako `never`, takže by
// každý přístup k sloupci byl chyba. Ostatní funkce v repu to mají stejně —
// typovou jistotu tu nahrazuje to, že se sloupce vyjmenovávají v selectu.
// deno-lint-ignore no-explicit-any
type DB = any;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SPLIT_DAYS: Record<string, number> = { full_body: 2, upper_lower: 2, ppl: 3 };

// Náhled cviku leží vedle videa jako thumb.jpg. video_path je celá veřejná
// adresa, takže stačí vyměnit poslední segment (stejně jako getVideoThumbUrl).
const thumbUrlFor = (videoPath: string | null): string | null => {
  if (!videoPath) return null;
  const slash = videoPath.lastIndexOf("/");
  if (slash === -1) return null;
  return `${videoPath.substring(0, slash)}/thumb.jpg`;
};

interface PlanContext {
  planId: string;
  goalId: string;
  gymId: string | null;
  dayLetter: string;
  dayName: string | null;
  dayCount: number;
  currentDayIndex: number;
  exercises: Array<Record<string, unknown>>;
}

// Sestaví dnešní den z Pumplo plánu. Zrcadlí useWorkoutPlan.fetchActivePlan —
// včetně samoopravy počítadla dní a deload týdne, protože jinak by hodinky
// nabízely jiný den než appka.
const loadPlanContext = async (
  supabase: DB,
  userId: string,
): Promise<PlanContext | null> => {
  const { data: plan } = await supabase
    .from("user_workout_plans")
    .select("id, goal_id, gym_id, split_type, training_days, inputs_snapshot_json")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  if (!plan) return null;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("current_day_index")
    .eq("user_id", userId)
    .maybeSingle();

  let currentDayIndex = profile?.current_day_index ?? 0;

  const { data: exercises } = await supabase
    .from("user_workout_exercises")
    .select("id, day_letter, slot_order, role_id, exercise_id, sets, rep_min, rep_max, slot_category, exercises (id, name, name_en, video_path)")
    .eq("plan_id", plan.id)
    .order("day_letter")
    .order("slot_order");

  const rows = exercises ?? [];
  const dayCount = new Set(rows.map((e: DB) => e.day_letter as string)).size
    || SPLIT_DAYS[plan.split_type as string]
    || 2;

  // Samooprava počítadla: posun dne dělá appka až na konci tréninku a uživatel
  // ho může přeskočit zavřením appky. Když poslední dokončený trénink má týž
  // den, na který počítadlo ukazuje, posun se nestal — dožene se tady.
  const { data: lastSession } = await supabase
    .from("workout_sessions")
    .select("day_letter")
    .eq("user_id", userId)
    .eq("plan_id", plan.id)
    .eq("is_bonus", false)
    .not("completed_at", "is", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastLetter = (lastSession?.day_letter as string | undefined)?.replace("_EXT", "");
  if (lastLetter && lastLetter === getCurrentDayLetter(dayCount, currentDayIndex)) {
    currentDayIndex += 1;
    await supabase
      .from("user_profiles")
      .update({ current_day_index: currentDayIndex })
      .eq("user_id", userId);
  }

  const dayLetter = getCurrentDayLetter(dayCount, currentDayIndex);
  const splitType = (plan.split_type as string)
    || ((plan.inputs_snapshot_json as Record<string, unknown> | null)?.split_type as string)
    || "full_body";

  const { data: templates } = await supabase
    .from("day_templates")
    .select("day_letter, day_name, slot_order, slot_category, rir_min, rir_max")
    .eq("split_type", splitType)
    .eq("goal_id", plan.goal_id);

  const dayNameByLetter: Record<string, string> = {};
  const slotCategoryByKey: Record<string, string> = {};
  const rirByKey: Record<string, { min: number | null; max: number | null }> = {};
  for (const t of templates ?? []) {
    const letter = t.day_letter as string;
    if (!dayNameByLetter[letter]) dayNameByLetter[letter] = t.day_name as string;
    const key = `${letter}:${t.slot_order}`;
    slotCategoryByKey[key] = (t.slot_category as string) || "secondary";
    rirByKey[key] = { min: t.rir_min as number | null, max: t.rir_max as number | null };
  }

  // Deload: RIR ze šablon o cyklu neví, proto se v deload týdnu přebíjí na 5.
  let isDeloadWeek = false;
  const { count: completedCount } = await supabase
    .from("workout_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("plan_id", plan.id)
    .eq("is_bonus", false)
    .not("completed_at", "is", null);
  const daysPerWeek = (plan.training_days as string[] | null)?.length || dayCount;
  const weekNumber = Math.floor((completedCount ?? 0) / Math.max(daysPerWeek, 1)) + 1;
  isDeloadWeek = getRIRGuidance(weekNumber).label === "Deload";

  const dayExercises = rows
    .filter((e: DB) => e.day_letter === dayLetter && e.exercise_id)
    .map((e: DB) => {
      const key = `${e.day_letter}:${e.slot_order}`;
      const joined = e.exercises as Record<string, unknown> | null;
      const slotCategory = (e.slot_category as string) || slotCategoryByKey[key] || null;
      const rir = isDeloadWeek ? 5 : (rirByKey[key]?.max ?? rirByKey[key]?.min ?? null);
      return {
        exerciseId: e.exercise_id,
        name: (joined?.name as string) ?? "",
        nameEn: (joined?.name_en as string) ?? null,
        slotCategory,
        sets: e.sets as number,
        repMin: (e.rep_min as number) || 8,
        repMax: (e.rep_max as number) || 12,
        rir,
        targetWeight: null,
        restSeconds: getRestSecondsForCategory(plan.goal_id as string, slotCategory),
        isCardio: false,
        durationSeconds: null,
        thumbUrl: thumbUrlFor((joined?.video_path as string) ?? null),
      };
    });

  return {
    planId: plan.id as string,
    goalId: plan.goal_id as string,
    gymId: (plan.gym_id as string) ?? null,
    dayLetter,
    dayName: dayNameByLetter[dayLetter] ?? null,
    dayCount,
    currentDayIndex,
    exercises: dayExercises,
  };
};

const loadCustomWorkout = async (
  supabase: DB,
  userId: string,
  planId: string,
  dayId: string,
) => {
  const { data: plan } = await supabase
    .from("custom_plans")
    .select("id, name")
    .eq("id", planId)
    .eq("user_id", userId) // vlastnictví se ověřuje dotazem, ne důvěrou v klienta
    .maybeSingle();
  if (!plan) return null;

  const { data: day } = await supabase
    .from("custom_plan_days")
    .select("id, name, day_number")
    .eq("id", dayId)
    .eq("plan_id", planId)
    .maybeSingle();
  if (!day) return null;

  const { data: rows } = await supabase
    .from("custom_plan_exercises")
    .select("id, exercise_id, sets, reps, reps_per_set, weight_kg, weight_per_set, rest_seconds, rest_per_set, order_index, unit_type, category, exercises (name, name_en, video_path)")
    .eq("day_id", dayId)
    .order("order_index");

  const exercises = (rows ?? []).map((e: DB) => {
    const joined = e.exercises as Record<string, unknown> | null;
    const isCardio = e.unit_type === "time_min" || e.category === "cardio";
    return {
      exerciseId: e.exercise_id,
      name: (joined?.name as string) ?? "",
      nameEn: (joined?.name_en as string) ?? null,
      slotCategory: isCardio ? "conditioning" : null,
      sets: (e.sets as number) || 1,
      // Vlastní plán má jedno číslo opakování, ne rozmezí.
      repMin: (e.reps as number) || 0,
      repMax: (e.reps as number) || 0,
      rir: null,
      targetWeight: (e.weight_kg as number) ?? null,
      restSeconds: (e.rest_seconds as number) ?? 120,
      isCardio,
      durationSeconds: isCardio ? ((e.reps as number) || 0) * 60 : null,
      thumbUrl: thumbUrlFor((joined?.video_path as string) ?? null),
      repsPerSet: (e.reps_per_set as number[] | null) ?? null,
      weightPerSet: (e.weight_per_set as number[] | null) ?? null,
      restPerSet: (e.rest_per_set as number[] | null) ?? null,
    };
  });

  return {
    title: [plan.name, day.name].filter(Boolean).join(" · ") || (plan.name as string),
    kind: "custom",
    planId: plan.id,
    dayId: day.id,
    exercises,
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "unauthorized" }, 401);

  const supabase: DB = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return json({ error: "unauthorized" }, 401);

  const url = new URL(req.url);
  const route = url.pathname.split("/").filter(Boolean).pop();

  try {
    if (route === "menu") {
      const [planContext, customPlans] = await Promise.all([
        loadPlanContext(supabase, user.id),
        supabase
          .from("custom_plans")
          .select("id, name, custom_plan_days (id, day_number, name)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      const customDays = (customPlans.data ?? []).flatMap((p: DB) =>
        ((p.custom_plan_days as Array<Record<string, unknown>> | null) ?? [])
          .sort((a: DB, b: DB) => (a.day_number as number) - (b.day_number as number))
          .map((d: DB) => ({
            planId: p.id,
            dayId: d.id,
            label: `${p.name} · ${d.name ?? `Den ${d.day_number}`}`,
          }))
      );

      return json({
        plan: planContext
          ? {
            label: planContext.dayName ?? `Trénink ${planContext.dayLetter}`,
            dayLetter: planContext.dayLetter,
            exerciseCount: planContext.exercises.length,
          }
          : null,
        customDays,
      });
    }

    if (route === "workout") {
      const kind = url.searchParams.get("kind") ?? "plan";

      if (kind === "custom") {
        const planId = url.searchParams.get("planId");
        const dayId = url.searchParams.get("dayId");
        if (!planId || !dayId) return json({ error: "missing planId or dayId" }, 400);
        const workout = await loadCustomWorkout(supabase, user.id, planId, dayId);
        if (!workout) return json({ error: "not found" }, 404);
        return json(workout);
      }

      const planContext = await loadPlanContext(supabase, user.id);
      if (!planContext) return json({ error: "no active plan" }, 404);
      return json({
        title: planContext.dayName ?? `Trénink ${planContext.dayLetter}`,
        kind: "plan",
        planId: planContext.planId,
        gymId: planContext.gymId,
        dayLetter: planContext.dayLetter,
        goalId: planContext.goalId,
        exercises: planContext.exercises,
      });
    }

    if (route === "complete" && req.method === "POST") {
      // Uloží odcvičený trénink přesně jako telefon (useWorkoutHistory
      // .saveWorkoutSession): jeden řádek workout_sessions, dávka setů per
      // cvik kvůli pořadí v historii, a u plánového tréninku posun
      // current_day_index. Idempotentní přes clientSessionId — opakované
      // odeslání z offline fronty hodinek nesmí založit trénink dvakrát.
      const body = await req.json().catch(() => null);
      if (!body || typeof body.clientSessionId !== "string" || !Array.isArray(body.exercises)) {
        return json({ error: "bad body" }, 400);
      }

      const existing = await supabase
        .from("workout_sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("client_session_id", body.clientSessionId)
        .maybeSingle();
      if (existing.data?.id) return json({ sessionId: existing.data.id, deduped: true });

      let totalSets = 0, totalReps = 0, totalWeight = 0;
      for (const ex of body.exercises) {
        for (const set of ex.sets ?? []) {
          if (!set.completed) continue;
          totalSets++;
          totalReps += set.reps ?? 0;
          totalWeight += (set.weight ?? 0) * (set.reps ?? 0);
        }
      }

      const startedAt = typeof body.startedAt === "string" ? body.startedAt : new Date().toISOString();
      const completedAt = typeof body.completedAt === "string" ? body.completedAt : new Date().toISOString();
      const durationSeconds = Math.max(0, Math.floor(
        (new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000,
      ));

      const { data: session, error: sessionError } = await supabase
        .from("workout_sessions")
        .insert({
          user_id: user.id,
          client_session_id: body.clientSessionId,
          plan_id: body.planId ?? null,
          gym_id: body.gymId ?? null,
          // goal_id je NOT NULL; vlastní trénink bez cíle dostane totéž
          // zástupné general_fitness jako CustomWorkoutPlayer v telefonu.
          goal_id: body.goalId ?? "general_fitness",
          day_letter: body.dayLetter ?? "CU",
          started_at: startedAt,
          completed_at: completedAt,
          duration_seconds: durationSeconds,
          total_sets: totalSets,
          total_reps: totalReps,
          total_weight_kg: totalWeight,
          is_bonus: false,
        })
        .select("id")
        .single();
      if (sessionError) {
        // Souběh dvou odeslání: unikátní index vrátí duplicitu — dohledej ji.
        const dup = await supabase
          .from("workout_sessions")
          .select("id")
          .eq("user_id", user.id)
          .eq("client_session_id", body.clientSessionId)
          .maybeSingle();
        if (dup.data?.id) return json({ sessionId: dup.data.id, deduped: true });
        throw sessionError;
      }

      for (const ex of body.exercises) {
        const rows = (ex.sets ?? []).map((set: DB, index: number) => ({
          session_id: session.id,
          exercise_id: ex.exerciseId ?? null,
          exercise_name: ex.exerciseName ?? "",
          set_number: index + 1,
          weight_kg: set.weight ?? null,
          reps: set.reps ?? null,
          completed: !!set.completed,
        }));
        if (rows.length === 0) continue;
        const { error: setsError } = await supabase.from("workout_session_sets").insert(rows);
        if (setsError) throw setsError;
      }

      // Plánový trénink posouvá rotaci — bez toho by appka druhý den
      // nabízela tentýž den (viz useWorkoutPlan.advanceToNextDay).
      if (body.kind === "plan") {
        const ctx = await loadPlanContext(supabase, user.id);
        if (ctx) {
          const { nextIndex } = getNextDayLetter(ctx.dayCount, ctx.currentDayIndex);
          await supabase
            .from("user_profiles")
            .update({ current_day_index: nextIndex })
            .eq("user_id", user.id);
        }
      }

      return json({ sessionId: session.id });
    }

    return json({ error: "unknown route" }, 404);
  } catch (err) {
    console.error("watch-api failed", err);
    return json({ error: "internal" }, 500);
  }
});
