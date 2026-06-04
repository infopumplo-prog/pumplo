import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { sendFcmToUser } from "../_shared/fcm.ts";

// Delivers a push notification to app users when they RECEIVE a message.
// Invoked by AFTER INSERT triggers on `gym_messages` and `direct_messages`
// (via pg_net) with body { table, row_id }. Email-to-gym is a separate feature.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Lang = "cs" | "en";
function pickLang(v: string | null | undefined): Lang {
  return v === "en" ? "en" : "cs";
}

// Only framing/fallback words are localized; sender name + message text are content.
const FALLBACK: Record<Lang, { trainer: string; gym: string; newMsg: string }> = {
  cs: { trainer: "Trenér", gym: "Posilovna", newMsg: "Nová zpráva" },
  en: { trainer: "Trainer", gym: "Gym", newMsg: "New message" },
};

function preview(text: string, max = 140): string {
  const t = (text || "").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getLang(supabase: SupabaseClient<any>, userId: string): Promise<Lang> {
  const { data } = await supabase
    .from("user_profiles").select("language").eq("user_id", userId).single();
  return pickLang(data?.language);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getDisplayName(supabase: SupabaseClient<any>, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("user_profiles").select("first_name, last_name").eq("user_id", userId).single();
  if (!data) return null;
  const name = [data.first_name, data.last_name].filter(Boolean).join(" ").trim();
  return name || null;
}

interface Results { sent: number; skipped: number; errors: number }

// Resolves the recipient's language, builds the localized title/body, sends FCM.
// Never notifies the sender; no-ops when the recipient has no device token.
async function deliver(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  recipientId: string | null,
  senderId: string,
  makeTitle: (lang: Lang) => string,
  bodyRaw: string,
  route: string,
  results: Results,
): Promise<void> {
  if (!recipientId || recipientId === senderId) {
    results.skipped++;
    return;
  }
  const lang = await getLang(supabase, recipientId);
  const title = makeTitle(lang);
  const body = bodyRaw && bodyRaw.trim() ? preview(bodyRaw) : FALLBACK[lang].newMsg;
  try {
    const fcm = await sendFcmToUser(supabase, recipientId, { title, body, data: { route } });
    if (fcm.sent > 0) results.sent++;
    else results.skipped++;
  } catch (e) {
    console.error(`FCM failed for ${recipientId}:`, e);
    results.errors++;
  }
}

// gym -> member(s): one targeted member, or broadcast to all gym members.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleGymMessage(supabase: SupabaseClient<any>, rowId: string, results: Results): Promise<void> {
  const { data: msg } = await supabase
    .from("gym_messages")
    .select("id, gym_id, sender_id, title, body, target_type, target_user_id")
    .eq("id", rowId).single();
  if (!msg) return;

  const { data: gym } = await supabase.from("gyms").select("name").eq("id", msg.gym_id).single();
  const gymName: string | null = gym?.name ?? null;

  let recipients: string[] = [];
  if (msg.target_user_id) {
    recipients = [msg.target_user_id];
  } else {
    // Broadcast (e.g. target_type='all') -> every member whose selected gym matches.
    const { data: members } = await supabase
      .from("user_profiles").select("user_id").eq("selected_gym_id", msg.gym_id);
    recipients = (members ?? []).map((m: { user_id: string }) => m.user_id);
  }

  const makeTitle = (lang: Lang) => `💬 ${gymName || FALLBACK[lang].gym}`;
  for (const r of recipients) {
    await deliver(supabase, r, msg.sender_id, makeTitle, msg.body ?? "", "/messages", results);
  }
}

// conversation message: push to whichever participant did NOT send it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleDirectMessage(supabase: SupabaseClient<any>, rowId: string, results: Results): Promise<void> {
  const { data: msg } = await supabase
    .from("direct_messages")
    .select("id, conversation_id, sender_type, sender_id, body, message_type")
    .eq("id", rowId).single();
  if (!msg) return;

  const { data: conv } = await supabase
    .from("conversations")
    .select("participant_user_id, trainer_id, gym_id")
    .eq("id", msg.conversation_id).single();
  if (!conv) return;

  // Recipient = the other side of the conversation.
  let recipientId: string | null = null;
  if (msg.sender_id !== conv.participant_user_id) {
    // Trainer or gym owner sent it -> notify the member.
    recipientId = conv.participant_user_id;
  } else if (conv.trainer_id) {
    // Member -> trainer. trainer_id references gym_trainers.id; the auth uid is
    // in gym_trainers.user_id (null if the trainer hasn't linked an app account).
    const { data: gt } = await supabase
      .from("gym_trainers").select("user_id").eq("id", conv.trainer_id).single();
    recipientId = gt?.user_id ?? null;
  } else if (conv.gym_id) {
    // Member -> gym owner (web admin). Usually no device token -> no-op now;
    // this is the email-channel case handled by a later feature.
    const { data: g } = await supabase.from("gyms").select("owner_id").eq("id", conv.gym_id).single();
    recipientId = g?.owner_id ?? null;
  }
  if (!recipientId) return;

  // Title = sender's name. Gym owner -> gym name; trainer -> gym_trainers.name
  // (their app account may be unlinked, so resolve via the conversation, not
  // user_profiles); member -> their profile name.
  let makeTitle: (lang: Lang) => string;
  const senderIsMember = msg.sender_id === conv.participant_user_id;
  if (!senderIsMember && msg.sender_type === "gym_owner") {
    const { data: g } = await supabase.from("gyms").select("name").eq("id", conv.gym_id).single();
    const gymName: string | null = g?.name ?? null;
    makeTitle = (lang) => `💬 ${gymName || FALLBACK[lang].gym}`;
  } else if (!senderIsMember && conv.trainer_id) {
    const { data: gt } = await supabase.from("gym_trainers").select("name").eq("id", conv.trainer_id).single();
    const tname: string | null = gt?.name ?? null;
    makeTitle = (lang) => `💬 ${tname || FALLBACK[lang].trainer}`;
  } else {
    const name = await getDisplayName(supabase, msg.sender_id);
    makeTitle = (lang) => `💬 ${name || FALLBACK[lang].trainer}`;
  }

  const isText = !msg.message_type || msg.message_type === "text";
  await deliver(
    supabase, recipientId, msg.sender_id, makeTitle,
    isText ? (msg.body ?? "") : "",
    `/messages/chat/${msg.conversation_id}`,
    results,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Same auth pattern as daily-briefing: only the cron secret may invoke this.
  const cronSecret = Deno.env.get("CRON_SECRET");
  const authHeader = req.headers.get("authorization") ?? "";
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let table: string | null = null;
  let rowId: string | null = null;
  try {
    const body = await req.json();
    table = body.table ?? null;
    rowId = body.row_id ?? body.rowId ?? null;
  } catch {
    // fall through to validation below
  }
  if (!table || !rowId) {
    return new Response(JSON.stringify({ error: "Missing table/row_id" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const results: Results = { sent: 0, skipped: 0, errors: 0 };
  try {
    if (table === "gym_messages") {
      await handleGymMessage(supabase, rowId, results);
    } else if (table === "direct_messages") {
      await handleDirectMessage(supabase, rowId, results);
    } else {
      return new Response(JSON.stringify({ error: `Unknown table: ${table}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("send-message-push error:", e);
  }

  console.log(`send-message-push (${table}/${rowId}):`, results);
  return new Response(JSON.stringify({ success: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
