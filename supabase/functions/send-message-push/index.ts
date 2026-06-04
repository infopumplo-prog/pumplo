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

interface Results { sent: number; skipped: number; errors: number; emailed: number }

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

// ---- Email channel (gym owner is on the web admin, no device token) ----

const RESEND_FROM = "Pumplo <zpravy@pumplo.com>";
// Super-admin (David) — receives a copy of every app feedback submission.
const SUPER_ADMIN_EMAIL = "info.pumplo@gmail.com";

function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Generic Resend send. Returns true on success.
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) { console.error("RESEND_API_KEY not set — skipping email"); return false; }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: RESEND_FROM, to, subject, html }),
  });
  if (!res.ok) {
    console.error("Resend error", res.status, await res.text().catch(() => ""));
    return false;
  }
  return true;
}

// Emails the gym owner that a member sent them a message. Returns true on send.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendGymEmail(
  supabase: SupabaseClient<any>,
  ownerId: string,
  senderName: string,
  messageBody: string,
): Promise<boolean> {
  const { data: userRes } = await supabase.auth.admin.getUserById(ownerId);
  const to = userRes?.user?.email;
  if (!to) { console.error(`No email for gym owner ${ownerId}`); return false; }

  const safeBody = escapeHtml(messageBody).replace(/\n/g, "<br>");
  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
      <p style="font-size:15px">Máte novou zprávu v Pumplo od <strong>${escapeHtml(senderName)}</strong>:</p>
      <blockquote style="margin:12px 0;padding:12px 16px;background:#f5f5f5;border-left:3px solid #ec4899;border-radius:8px;font-size:15px">${safeBody || "(příloha)"}</blockquote>
      <p style="font-size:13px;color:#666">Odpovědět můžete v administraci Pumplo.</p>
    </div>`;

  const ok = await sendEmail(to, `💬 Nová zpráva od ${senderName} – Pumplo`, html);
  if (ok) console.log(`Emailed gym owner ${ownerId} (${to})`);
  return ok;
}

const FEEDBACK_TYPE_CS: Record<string, string> = {
  bug_error: "🐞 Chyba",
  missing_feature: "💡 Chybějící funkce",
  training_exercises: "🏋️ Tréninky / cviky",
  confusion: "❓ Nejasnost / matoucí",
  other: "💬 Jiné",
};

// Emails the super-admin (David) a copy of a new app feedback submission.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleFeedback(supabase: SupabaseClient<any>, rowId: string, results: Results): Promise<void> {
  const { data: fb } = await supabase
    .from("user_feedback")
    .select("feedback_type, message, platform, app_version, current_route, locale, contact_email, can_contact, user_id")
    .eq("id", rowId).single();
  if (!fb) return;

  let who = "Anonymní uživatel";
  if (fb.user_id) {
    const { data: p } = await supabase
      .from("user_profiles").select("first_name, last_name").eq("user_id", fb.user_id).single();
    const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ").trim();
    if (name) who = name;
  }
  const typeLabel = FEEDBACK_TYPE_CS[fb.feedback_type as string] || (fb.feedback_type as string) || "Feedback";
  const contact = fb.can_contact && fb.contact_email ? fb.contact_email : "—";

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
      <p style="font-size:16px;margin:0 0 4px"><strong>${typeLabel}</strong></p>
      <p style="font-size:13px;color:#666;margin:0 0 12px">od ${escapeHtml(who)}</p>
      <blockquote style="margin:0 0 16px;padding:12px 16px;background:#f5f5f5;border-left:3px solid #6366f1;border-radius:8px;font-size:15px">${escapeHtml(fb.message || "(bez textu)").replace(/\n/g, "<br>")}</blockquote>
      <table style="font-size:13px;color:#444;border-collapse:collapse">
        <tr><td style="padding:2px 12px 2px 0;color:#888">Platforma</td><td>${escapeHtml(fb.platform || "?")} · v${escapeHtml(fb.app_version || "?")}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#888">Obrazovka</td><td>${escapeHtml(fb.current_route || "?")}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#888">Jazyk</td><td>${escapeHtml(fb.locale || "?")}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#888">Kontakt</td><td>${escapeHtml(contact)}</td></tr>
      </table>
    </div>`;

  const ok = await sendEmail(SUPER_ADMIN_EMAIL, `${typeLabel} – nový feedback v Pumplo`, html);
  if (ok) { results.emailed++; console.log(`Feedback emailed to super-admin (${rowId})`); }
  else results.errors++;
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
  let recipientIsGymOwner = false;
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
    // Member -> gym owner (web admin, no device token) -> notify by EMAIL.
    const { data: g } = await supabase.from("gyms").select("owner_id").eq("id", conv.gym_id).single();
    recipientId = g?.owner_id ?? null;
    recipientIsGymOwner = true;
  }
  if (!recipientId) return;

  // Email channel: a member messaged the gym -> email the owner (no push).
  if (recipientIsGymOwner) {
    const senderName = (await getDisplayName(supabase, msg.sender_id)) || "Člen";
    const isTextMsg = !msg.message_type || msg.message_type === "text";
    const ok = await sendGymEmail(supabase, recipientId, senderName, isTextMsg ? (msg.body ?? "") : "");
    if (ok) results.emailed++; else results.errors++;
    return;
  }

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
  if (table !== "gym_messages" && table !== "direct_messages" && table !== "user_feedback") {
    return new Response(JSON.stringify({ error: `Unknown table: ${table}` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Do the work in the background so pg_net gets an immediate 200 — email
  // delivery (Resend) can exceed pg_net's 5s timeout.
  const id = rowId;
  const tbl = table;
  const work = (async () => {
    const results: Results = { sent: 0, skipped: 0, errors: 0, emailed: 0 };
    try {
      if (tbl === "gym_messages") await handleGymMessage(supabase, id, results);
      else if (tbl === "direct_messages") await handleDirectMessage(supabase, id, results);
      else if (tbl === "user_feedback") await handleFeedback(supabase, id, results);
    } catch (e) {
      console.error("send-message-push error:", e);
    }
    console.log(`send-message-push (${tbl}/${id}):`, results);
  })();

  // @ts-ignore EdgeRuntime is a Supabase Edge global
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work);
  else await work;

  return new Response(JSON.stringify({ success: true, accepted: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
