import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

async function translateText(csText: string): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `Translate this fitness/gym text from Czech to English. Return ONLY the translated text, no explanation, no quotes:\n\n${csText}`,
      }],
    }),
  });
  const data = await response.json();
  return data.content?.[0]?.text?.trim() ?? csText;
}

async function translateExercise(exercise: Record<string, string | null>) {
  const updates: Record<string, string | null> = {};

  const fields: Array<[string, string]> = [
    ["name", "name_en"],
    ["description", "description_en"],
    ["setup_instructions", "setup_instructions_en"],
    ["common_mistakes", "common_mistakes_en"],
    ["tips", "tips_en"],
  ];

  for (const [cs, en] of fields) {
    if (exercise[cs] && !exercise[en]) {
      updates[en] = await translateText(exercise[cs]!);
    }
  }

  if (Object.keys(updates).length > 0) {
    await supabase.from("exercises").update(updates).eq("id", exercise.id);
  }

  return Object.keys(updates).length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const exerciseId: string | null = body.exercise_id ?? null;

    if (exerciseId) {
      // Single exercise mode — called from admin on save
      const { data: exercise } = await supabase
        .from("exercises")
        .select("id, name, name_en, description, description_en, setup_instructions, setup_instructions_en, common_mistakes, common_mistakes_en, tips, tips_en")
        .eq("id", exerciseId)
        .single();

      if (!exercise) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: corsHeaders });

      const updated = await translateExercise(exercise);
      return new Response(JSON.stringify({ updated_fields: updated }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Batch mode — translate all exercises with missing EN fields
    const { data: exercises } = await supabase
      .from("exercises")
      .select("id, name, name_en, description, description_en, setup_instructions, setup_instructions_en, common_mistakes, common_mistakes_en, tips, tips_en")
      .or("name_en.is.null,description_en.is.null,tips_en.is.null");

    if (!exercises?.length) {
      return new Response(JSON.stringify({ message: "All exercises already translated", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    let totalUpdated = 0;
    for (const exercise of exercises) {
      totalUpdated += await translateExercise(exercise);
    }

    return new Response(JSON.stringify({ message: "Done", exercises_processed: exercises.length, fields_updated: totalUpdated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
