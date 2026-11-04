// Trenérská platforma: převod PDF tréninkového plánu na strukturovaný JSON (Claude).
// POST { pdf_base64, filename? } s JWT trenéra → { plan: { name, days: [{ name, phase, exercises: [...] }] } }.
// Admin appka pak názvy cviků páruje s katalogem. Nic nezapisuje do DB.
// NENASAZENO — deploy: supabase functions deploy trainer-plan-from-pdf --project-ref udqwjqgdsjobdufdxbpn
//
// Abuse guard: max 20 volání / trenér / den, ale BEZ tabulky — počítadlo jen v paměti instance
// (best-effort; při studeném startu nebo více instancích se nuluje). Trvalý limit by chtěl tabulku.
import { createClient } from "npm:@supabase/supabase-js@2";
import { PLAN_INPUT_SCHEMA, planFromMessageResponse, TOOL_NAME } from "./parse.ts";

const MODEL = "claude-sonnet-5-5";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_TIMEOUT_MS = 60_000;
const MAX_PDF_BYTES = 8 * 1024 * 1024;
const DAILY_LIMIT = 20;

const DEFAULT_ORIGINS = [
  "https://admin.pumplo.com",
  "https://pumplo-admin.vercel.app",
  "http://localhost:5173",
  "http://localhost:8080",
];
const allowedOrigins = (): string[] => {
  const extra = (Deno.env.get("TRAINER_ALLOWED_ORIGINS") ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  return [...DEFAULT_ORIGINS, ...extra];
};

const corsHeadersFor = (req: Request): Record<string, string> => {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = allowedOrigins();
  return {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
};

const json = (req: Request, body: unknown, status = 200, internalError?: unknown): Response => {
  if (internalError) console.error("trainer-plan-from-pdf:", internalError);
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersFor(req), "Content-Type": "application/json" },
  });
};

// In-memory per-instance daily counter (see header comment).
const usage = new Map<string, { day: string; count: number }>();
function consumeQuota(userId: string): boolean {
  const day = new Date().toISOString().slice(0, 10);
  const cur = usage.get(userId);
  if (!cur || cur.day !== day) {
    usage.set(userId, { day, count: 1 });
    return true;
  }
  if (cur.count >= DAILY_LIMIT) return false;
  cur.count++;
  return true;
}

function decodedBase64Length(b64: string): number {
  const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

const INSTRUCTION = `You are reading a training plan PDF written by a fitness trainer (Czech or English; tables or free text).
Extract the workout program and call the ${TOOL_NAME} tool exactly once with the result. Do not answer in prose.

Rules:
- One day entry per training day / session (e.g. "Den A", "Day 1", "Push", "Trénink 2"). If the plan has phases or weeks with different exercises, create separate days and put the phase/week label in "phase".
- One exercise entry per exercise per day, in document order. Keep exercise names exactly as written in the PDF — do not translate or rename.
- "4×8-10" / "4x8–10" means sets = 4, reps = "8-10". Reps are text (ranges, "AMRAP", "30 s" allowed). Use null when a value is not stated.
- weight_kg: load in kilograms only if stated (convert lb to kg). rest_seconds: rest between sets in seconds (e.g. "2 min" → 120).
- notes: other per-exercise info (tempo, RPE, technique cues, supersets). Keep it short.
- Ignore nutrition, meal plans, supplements, and general text that is not part of the workouts.
- If no workout exercises are found, return days: [].`;

const PLAN_TOOL = {
  name: TOOL_NAME,
  description: "Record the structured training plan extracted from the PDF.",
  strict: true,
  input_schema: PLAN_INPUT_SCHEMA,
};

type CallResult =
  | { ok: true; body: unknown }
  | { ok: false; status: number; error: string; detail?: unknown };

async function callAnthropic(pdfBase64: string, apiKey: string): Promise<CallResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS);
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        // Server-side fallback when the model declines (refusal) — retries on the recommended model.
        "anthropic-beta": "server-side-fallback-2026-07-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 16000,
        fallbacks: "default",
        // Extraction task: low effort is enough and keeps latency under the timeout.
        output_config: { effort: "low" },
        tools: [PLAN_TOOL],
        // Sonnet 5.5 rejects forced tool_choice ("tool"/"any"); strict tool + instruction instead.
        tool_choice: { type: "auto", disable_parallel_tool_use: true },
        messages: [{
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
            { type: "text", text: INSTRUCTION },
          ],
        }],
      }),
    });
    if (!res.ok) {
      // Log status + Anthropic error type only (never the request body / key).
      const errBody = await res.json().catch(() => null) as { error?: { type?: string } } | null;
      return {
        ok: false,
        status: 502,
        error: res.status === 429 || res.status === 529 ? "ai_busy" : "ai_failed",
        detail: { status: res.status, type: errBody?.error?.type ?? null },
      };
    }
    return { ok: true, body: await res.json() };
  } catch (e) {
    const aborted = e instanceof DOMException && e.name === "AbortError";
    return { ok: false, status: aborted ? 504 : 502, error: aborted ? "ai_timeout" : "ai_failed", detail: aborted ? "timeout" : String((e as Error)?.name ?? "error") };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeadersFor(req) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) return json(req, { error: "not_configured" }, 500, "ANTHROPIC_API_KEY not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(req, { error: "missing_authorization" }, 401);

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json(req, { error: "invalid_authorization" }, 401, userError);

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: roleRow, error: roleError } = await adminClient
      .from("user_roles")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("role", "trainer")
      .limit(1)
      .maybeSingle();
    if (roleError) return json(req, { error: "role_check_failed" }, 500, roleError);
    if (!roleRow) return json(req, { error: "forbidden" }, 403);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json(req, { error: "invalid_json" }, 400);
    }
    const raw = (body as { pdf_base64?: unknown } | null)?.pdf_base64;
    if (typeof raw !== "string" || !raw.trim()) return json(req, { error: "missing_pdf_base64" }, 400);
    // Accept data URLs and strip whitespace/newlines (API requires plain base64).
    const pdfBase64 = raw.replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(pdfBase64)) return json(req, { error: "invalid_base64" }, 400);
    if (decodedBase64Length(pdfBase64) > MAX_PDF_BYTES) return json(req, { error: "pdf_too_large", max_bytes: MAX_PDF_BYTES }, 413);
    // Magic bytes "%PDF" = base64 "JVBERi".
    if (!pdfBase64.startsWith("JVBERi")) return json(req, { error: "not_a_pdf" }, 415);

    if (!consumeQuota(user.id)) return json(req, { error: "rate_limited", limit_per_day: DAILY_LIMIT }, 429);

    const result = await callAnthropic(pdfBase64, anthropicKey);
    if (!result.ok) return json(req, { error: result.error }, result.status, result.detail);

    const resp = result.body as { stop_reason?: string };
    if (resp.stop_reason === "refusal") return json(req, { error: "ai_refused" }, 502, "refusal");
    const plan = planFromMessageResponse(result.body);
    if (!plan) {
      // tool_choice is "auto", so the model may answer in prose when it finds nothing → empty plan.
      if (resp.stop_reason === "end_turn") return json(req, { plan: { name: null, days: [] } });
      return json(req, { error: "ai_no_result" }, 502, `no tool_use (stop_reason=${resp.stop_reason ?? "?"})`);
    }
    return json(req, { plan });
  } catch (error) {
    return json(req, { error: "internal_error" }, 500, error);
  }
});
