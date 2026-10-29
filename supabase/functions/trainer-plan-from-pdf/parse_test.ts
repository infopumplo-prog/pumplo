import { assertEquals } from "jsr:@std/assert@1";
import {
  MAX_DAYS,
  MAX_EXERCISES_PER_DAY,
  normalisePlan,
  PLAN_INPUT_SCHEMA,
  planFromMessageResponse,
  TOOL_NAME,
} from "./parse.ts";

// Realistic Messages API response (Sonnet 5.5, thinking block + strict tool_use).
const SAMPLE_RESPONSE = {
  id: "msg_01ABC",
  type: "message",
  role: "assistant",
  model: "claude-sonnet-5-5",
  stop_reason: "tool_use",
  content: [
    { type: "thinking", thinking: "", signature: "sig" },
    {
      type: "tool_use",
      id: "toolu_01XYZ",
      name: TOOL_NAME,
      input: {
        plan: {
          name: "  Hypertrofie 12 týdnů ",
          days: [
            {
              name: "Den A – Push",
              phase: "Týden 1-4",
              exercises: [
                { name: "Bench press", sets: 4, reps: "8–10", weight_kg: 60, rest_seconds: 120, notes: "RPE 8" },
                { name: "Tlaky s jednoručkami na šikmé lavici", sets: "3", reps: "10 - 12", weight_kg: "22,5 kg", rest_seconds: "90 s", notes: null },
                { name: "Triceps stahování kladky", sets: 3, reps: 15, weight_kg: null, rest_seconds: "1 min", notes: "" },
              ],
            },
            {
              name: "Day B - Pull",
              phase: null,
              exercises: [
                { name: "Lat pulldown", sets: 4, reps: "AMRAP", weight_kg: "100 lbs", rest_seconds: null, notes: "slow eccentric" },
              ],
            },
            { name: "Výživa", phase: null, exercises: [] },
          ],
        },
      },
    },
  ],
  usage: { input_tokens: 3000, output_tokens: 400 },
};

Deno.test("realistic tool_use response is normalised", () => {
  const plan = planFromMessageResponse(SAMPLE_RESPONSE)!;
  assertEquals(plan.name, "Hypertrofie 12 týdnů");
  assertEquals(plan.days.length, 2); // empty "Výživa" day dropped
  const [a, b] = plan.days;
  assertEquals(a.name, "Den A – Push");
  assertEquals(a.phase, "Týden 1-4");
  assertEquals(a.exercises[0], {
    name: "Bench press", sets: 4, reps: "8-10", weight_kg: 60, rest_seconds: 120, notes: "RPE 8",
  });
  assertEquals(a.exercises[1], {
    name: "Tlaky s jednoručkami na šikmé lavici", sets: 3, reps: "10-12", weight_kg: 22.5, rest_seconds: 90, notes: null,
  });
  assertEquals(a.exercises[2].reps, "15");
  assertEquals(a.exercises[2].rest_seconds, 60);
  assertEquals(a.exercises[2].notes, null);
  assertEquals(b.exercises[0].reps, "AMRAP");
  assertEquals(b.exercises[0].weight_kg, 45.36);
});

Deno.test("response without matching tool_use → null", () => {
  assertEquals(planFromMessageResponse({ content: [{ type: "text", text: "No plan." }] }), null);
  assertEquals(planFromMessageResponse({ content: [{ type: "tool_use", name: "other", input: {} }] }), null);
  assertEquals(planFromMessageResponse(null), null);
  assertEquals(planFromMessageResponse("garbage"), null);
  assertEquals(planFromMessageResponse({ content: "nope" }), null);
});

Deno.test("garbage input never throws and yields empty plan", () => {
  for (const g of [null, undefined, 42, "x", [], {}, { plan: null }, { plan: { days: "x" } }, { plan: { days: [null, 1, "a", []] } }]) {
    assertEquals(normalisePlan(g), { name: null, days: [] });
  }
});

Deno.test("bare plan object (without wrapper) is accepted", () => {
  const plan = normalisePlan({ name: "P", days: [{ name: "D1", exercises: [{ name: "Squat", sets: "4", reps: "8-12", weight_kg: "60 kg" }] }] });
  assertEquals(plan.days[0].exercises[0], {
    name: "Squat", sets: 4, reps: "8-12", weight_kg: 60, rest_seconds: null, notes: null,
  });
  assertEquals(plan.days[0].phase, null);
});

Deno.test("exercises without names dropped; bad numbers nulled", () => {
  const plan = normalisePlan({
    plan: {
      name: "",
      days: [{
        name: "  ",
        exercises: [
          { name: "   " },
          { name: null, sets: 3 },
          { name: "Deadlift", sets: "abc", reps: "", weight_kg: -5, rest_seconds: "n/a" },
          { name: "Plank", sets: 0, reps: "30 s", weight_kg: "bodyweight", rest_seconds: "2'" },
        ],
      }],
    },
  });
  assertEquals(plan.name, null);
  assertEquals(plan.days[0].name, "Day 1"); // fallback label
  assertEquals(plan.days[0].exercises.length, 2);
  assertEquals(plan.days[0].exercises[0], {
    name: "Deadlift", sets: null, reps: null, weight_kg: null, rest_seconds: null, notes: null,
  });
  assertEquals(plan.days[0].exercises[1].sets, null);
  assertEquals(plan.days[0].exercises[1].reps, "30 s");
  assertEquals(plan.days[0].exercises[1].weight_kg, null);
  assertEquals(plan.days[0].exercises[1].rest_seconds, 120);
});

Deno.test("caps: days, exercises per day, string lengths", () => {
  const ex = Array.from({ length: 60 }, (_, i) => ({ name: `Ex ${i}`, sets: 3, reps: "10" }));
  const days = Array.from({ length: 20 }, (_, i) => ({ name: `D${i}`, exercises: ex }));
  const plan = normalisePlan({ plan: { name: "x".repeat(500), days } });
  assertEquals(plan.days.length, MAX_DAYS);
  assertEquals(plan.days[0].exercises.length, MAX_EXERCISES_PER_DAY);
  assertEquals(plan.name!.length, 120);
  const long = normalisePlan({ days: [{ name: "D", exercises: [{ name: "a".repeat(300), notes: "n".repeat(2000), reps: "r".repeat(100) }] }] });
  assertEquals(long.days[0].exercises[0].name.length, 120);
  assertEquals(long.days[0].exercises[0].notes!.length, 500);
  assertEquals(long.days[0].exercises[0].reps!.length, 40);
});

Deno.test("schema is strict-compatible (all properties required, no extras)", () => {
  const check = (s: Record<string, unknown>) => {
    if (s.type === "object") {
      assertEquals(s.additionalProperties, false);
      const props = Object.keys(s.properties as object).sort();
      assertEquals([...(s.required as string[])].sort(), props);
      for (const p of Object.values(s.properties as Record<string, Record<string, unknown>>)) check(p);
    }
    if (s.type === "array") check(s.items as Record<string, unknown>);
  };
  check(PLAN_INPUT_SCHEMA as unknown as Record<string, unknown>);
});
