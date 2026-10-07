// Pure request validation for log-qr (kept apart from Deno.serve so it is testable).
export const ACTIONS = ["scan", "store_click", "lead_prompt_shown", "lead_prompt_dismissed", "lead_prompt_skipped", "lead"] as const;
export type Action = typeof ACTIONS[number];
export const isAction = (v: unknown): v is Action => typeof v === "string" && (ACTIONS as readonly string[]).includes(v);

export const SOURCE_TYPES = ["station", "flyer"] as const;
export const isSourceType = (v: unknown): v is typeof SOURCE_TYPES[number] =>
  typeof v === "string" && (SOURCE_TYPES as readonly string[]).includes(v);

// Why the e-mail prompt stayed hidden (qr_events.detail of lead_prompt_skipped).
// Must match the qr_events_detail_check constraint.
export const LEAD_SKIP_REASONS = ["native_app", "logged_in", "already_submitted", "dismissed_recently"] as const;
export type LeadSkipReason = typeof LEAD_SKIP_REASONS[number];
export const skipReason = (v: unknown): LeadSkipReason | null =>
  typeof v === "string" && (LEAD_SKIP_REASONS as readonly string[]).includes(v) ? v as LeadSkipReason : null;

// A scan sent from inside the Pumplo app carries native: true → qr_events.detail = 'native'.
// Old clients send nothing and stay null (web scan).
export const scanDetail = (native: unknown): "native" | null => (native === true ? "native" : null);

// Minimal slice of the Supabase client used to resolve a code (fakeable in tests).
type Row = Record<string, unknown> | null;
export interface CodeLookup {
  from(table: string): { select(cols: string): { eq(col: string, v: string): { maybeSingle(): PromiseLike<{ data: Row }> } } };
}

/** Gym (and machine for stations) behind a scanned code. Flyer: gym from qr_codes, machine
 *  always null; unknown flyer → null (404). Unknown station code still resolves to nulls
 *  (sticker of a deleted machine is still logged). */
export const resolveTarget = async (
  db: CodeLookup, sourceType: typeof SOURCE_TYPES[number], code: string,
): Promise<{ gymId: string | null; machineId: string | null } | null> => {
  if (sourceType === "flyer") {
    const { data } = await db.from("qr_codes").select("gym_id").eq("code", code).maybeSingle();
    return data ? { gymId: (data.gym_id as string) ?? null, machineId: null } : null;
  }
  const { data } = await db.from("gym_machines").select("id, gym_id").eq("short_code", code).maybeSingle();
  return data ? { gymId: data.gym_id as string, machineId: data.id as string } : { gymId: null, machineId: null };
};

/** Where a flyer QR forwards (pumplo.com): UTM tags + the scan id for the website's e-mail prompt. */
export const flyerDestination = (webUrl: string, code: string, scanId: string | null): string => {
  const dest = new URL(webUrl);
  dest.searchParams.set("utm_source", "qr");
  dest.searchParams.set("utm_medium", "flyer");
  if (code) dest.searchParams.set("utm_campaign", code);
  if (scanId) dest.searchParams.set("qr_scan", scanId);
  return dest.toString();
};
