import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const ALLOWED_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function sendTelegram(chatId: string, text: string, parseMode = "Markdown") {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode }),
  });
}

async function answerCallbackQuery(callbackId: string, text?: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackId, text: text ?? "" }),
  });
}

async function editTelegramMessage(chatId: string, messageId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "Markdown",
    }),
  });
}

async function handleCallbackQuery(callback: any) {
  const chatId = String(callback.message?.chat?.id || "");
  const messageId = callback.message?.message_id as number | undefined;
  const data: string = callback.data || "";
  const callbackId: string = callback.id;

  // Security: only our chat
  if (chatId !== ALLOWED_CHAT_ID) {
    await answerCallbackQuery(callbackId, "Unauthorized");
    return;
  }

  // Parse "allow:<id>" or "deny:<id>"
  const match = data.match(/^(allow|deny):(.+)$/);
  if (!match) {
    await answerCallbackQuery(callbackId, "Neznámá akce");
    return;
  }
  const [, decision, requestId] = match;

  // Update DB row
  const { data: updated, error } = await supabase
    .from("claude_permission_requests")
    .update({
      status: decision,
      resolved_at: new Date().toISOString(),
      resolved_via: "telegram",
    })
    .eq("id", requestId)
    .eq("status", "pending") // only update if still pending (idempotent)
    .select("tool_name")
    .maybeSingle();

  if (error || !updated) {
    await answerCallbackQuery(callbackId, "Už bylo rozhodnuto nebo expirovalo");
    if (messageId) {
      await editTelegramMessage(
        chatId,
        messageId,
        (callback.message?.text || "") + `\n\n⏰ *(expired / already resolved)*`,
      );
    }
    return;
  }

  // Ack + edit message to show decision
  const icon = decision === "allow" ? "✅ POVOLENO" : "❌ ZAMÍTNUTO";
  await answerCallbackQuery(callbackId, icon);
  if (messageId) {
    const original = callback.message?.text || "";
    await editTelegramMessage(chatId, messageId, `${original}\n\n${icon} (${new Date().toLocaleTimeString("cs-CZ")})`);
  }
}

async function handleCommand(text: string, chatId: string) {
  const cmd = text.toLowerCase().trim();

  // === LIVE CLAUDE CHAT — prefix `>` routes straight into running tmux Claude session ===
  // Example: `> proč padá build v pumplo-admin?`
  // Requires local claude-remote-bridge daemon to be running on the Mac.
  if (text.trim().startsWith(">")) {
    const payload = text.trim().slice(1).trim();
    if (!payload) {
      return sendTelegram(chatId, "Formát: `> zpráva pro Claude v běžícím tmux session`");
    }

    const { data, error } = await supabase
      .from("claude_remote_messages")
      .insert({ message: payload, source: "telegram", status: "pending" })
      .select("id")
      .single();

    if (error) {
      return sendTelegram(chatId, `❌ Nepodařilo se zařadit zprávu: ${error.message}`);
    }

    return sendTelegram(
      chatId,
      `📨 Odesláno do live Claude session.\n\nID: \`${data.id.slice(0, 8)}\`\n\nPokud claude-remote-bridge běží, zpráva dorazí do tmux pane během 2 s. Pokud dostaneš "skipped" v dalším updatu, daemon neběží.`,
    );
  }

  // === HELP ===
  if (cmd === "/start" || cmd === "/help" || cmd === "help") {
    return sendTelegram(chatId, `🤖 *Pumplo Admin Bot*

Dostupné příkazy:

📊 *status* — celkový přehled
👤 *členové* — přehled členů
👤 *členové [gym]* — členové konkrétní posilovny
🏋️ *posilovny* — seznam posiloven
📝 *feedback* — nový feedback
📦 *feedback balíček* — shrnutí feedbacku
📈 *statistiky* — detailní statistiky
💰 *mrr* — Monthly Recurring Revenue
🔍 *uživatel [jméno]* — hledání uživatele
📩 *zpráva [gym]: text* — hromadná zpráva

🧠 *> text* — živá zpráva do Claude Code v tmux session (potřebuje běžící claude-remote-bridge daemon na Macu)
🔧 *oprav popis* — fix request pro cloud agenta (batch, zpracuje za hodinu)`);
  }

  // === STATUS ===
  if (cmd === "status") {
    const [users, gyms, sessions, plans, feedback] = await Promise.all([
      supabase.from("user_profiles").select("id", { count: "exact", head: true }),
      supabase.from("gyms").select("id, name, is_published"),
      supabase.from("workout_sessions").select("id", { count: "exact", head: true })
        .gte("started_at", new Date(Date.now() - 86400000).toISOString()),
      supabase.from("user_workout_plans").select("id", { count: "exact", head: true }),
      supabase.from("user_feedback").select("id", { count: "exact", head: true })
        .eq("status", "new"),
    ]);

    const publishedGyms = (gyms.data || []).filter(g => g.is_published).length;

    return sendTelegram(chatId, `📊 *PUMPLO STATUS*

👤 Uživatelé: *${users.count || 0}*
🏋️ Posilovny: *${(gyms.data || []).length}* (${publishedGyms} publikovaných)
🏃 Sessions (24h): *${sessions.count || 0}*
📋 Aktivní plány: *${plans.count || 0}*
📝 Nový feedback: *${feedback.count || 0}*`);
  }

  // === ČLENOVÉ ===
  if (cmd === "členové" || cmd === "clenove" || cmd.startsWith("členové ") || cmd.startsWith("clenove ")) {
    const gymFilter = cmd.replace(/^(členové|clenove)\s*/, "").trim();

    let gymQuery = supabase.from("gyms").select("id, name");
    if (gymFilter) {
      gymQuery = gymQuery.ilike("name", `%${gymFilter}%`);
    }
    const { data: gymList } = await gymQuery;

    if (!gymList || gymList.length === 0) {
      return sendTelegram(chatId, gymFilter ? `Posilovna "${gymFilter}" nenalezena.` : "Žádné posilovny.");
    }

    let response = "";
    for (const gym of gymList) {
      const { data: members } = await supabase
        .from("user_profiles")
        .select("id, first_name, last_name, primary_goal, current_streak")
        .eq("selected_gym_id", gym.id);

      const count = members?.length || 0;

      // Calculate active/inactive
      const { count: activeSessions } = await supabase
        .from("workout_sessions")
        .select("user_id", { count: "exact", head: true })
        .eq("gym_id", gym.id)
        .gte("started_at", new Date(Date.now() - 7 * 86400000).toISOString());

      response += `\n🏋️ *${gym.name}*: ${count} členů\n`;
      response += `  ✅ Aktivní (7d): ~${activeSessions || 0} sessions\n`;

      if (members && members.length > 0 && gymFilter) {
        const top5 = members.slice(0, 5);
        for (const m of top5) {
          const name = `${m.first_name || ""} ${m.last_name || ""}`.trim() || "—";
          response += `  • ${name} (streak: ${m.current_streak || 0})\n`;
        }
        if (members.length > 5) response += `  ... a ${members.length - 5} dalších\n`;
      }
    }

    return sendTelegram(chatId, `👤 *ČLENOVÉ*${response}`);
  }

  // === POSILOVNY ===
  if (cmd === "posilovny" || cmd === "gyms") {
    const { data: gymList } = await supabase
      .from("gyms")
      .select("id, name, is_published, address");

    const { data: subs } = await supabase
      .from("gym_subscriptions")
      .select("gym_id, plan_id, status, is_grandfathered");

    let response = "";
    for (const gym of gymList || []) {
      const sub = (subs || []).find(s => s.gym_id === gym.id);
      const planLabel = sub ? `${sub.plan_id.toUpperCase()}${sub.is_grandfathered ? " (grandfathered)" : ""}` : "—";
      const statusIcon = gym.is_published ? "🟢" : "⚪";
      response += `\n${statusIcon} *${gym.name}*\n  📍 ${gym.address || "—"}\n  💳 ${planLabel}\n`;
    }

    return sendTelegram(chatId, `🏋️ *POSILOVNY*${response}`);
  }

  // === FEEDBACK ===
  if (cmd === "feedback") {
    const { data: fb } = await supabase
      .from("user_feedback")
      .select("id, type, status, message, created_at")
      .eq("status", "new")
      .order("created_at", { ascending: false })
      .limit(5);

    if (!fb || fb.length === 0) {
      return sendTelegram(chatId, "✅ Žádný nový feedback!");
    }

    const typeIcons: Record<string, string> = {
      bug: "🐛", feature: "💡", confusion: "😕", training: "🏋️", other: "📝"
    };

    let response = "";
    for (const f of fb) {
      const icon = typeIcons[f.type] || "📝";
      const date = new Date(f.created_at).toLocaleDateString("cs-CZ");
      response += `\n${icon} *${f.type}* (${date})\n  ${(f.message || "").slice(0, 100)}\n`;
    }

    return sendTelegram(chatId, `📝 *NOVÝ FEEDBACK* (${fb.length})${response}`);
  }

  if (cmd === "feedback balíček" || cmd === "feedback balicek") {
    const { data: fb } = await supabase
      .from("user_feedback")
      .select("type, status")
      .in("status", ["new", "in_progress"]);

    const counts: Record<string, number> = {};
    for (const f of fb || []) {
      counts[f.type] = (counts[f.type] || 0) + 1;
    }

    const typeLabels: Record<string, string> = {
      bug: "🐛 Bugy", feature: "💡 Feature requesty", confusion: "😕 UX problémy",
      training: "🏋️ Trénink", other: "📝 Ostatní"
    };

    let response = `\n📦 Celkem: *${(fb || []).length}* položek\n`;
    for (const [type, count] of Object.entries(counts)) {
      response += `  ${typeLabels[type] || type}: ${count}\n`;
    }

    return sendTelegram(chatId, `📦 *FEEDBACK BALÍČEK*${response}`);
  }

  // === STATISTIKY ===
  if (cmd === "statistiky" || cmd === "stats") {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const monthAgo = new Date(now.getTime() - 30 * 86400000);

    const [weekSessions, monthSessions, newUsers] = await Promise.all([
      supabase.from("workout_sessions").select("id, duration_seconds", { count: "exact" })
        .gte("started_at", weekAgo.toISOString()),
      supabase.from("workout_sessions").select("id", { count: "exact", head: true })
        .gte("started_at", monthAgo.toISOString()),
      supabase.from("user_profiles").select("id", { count: "exact", head: true })
        .gte("created_at", weekAgo.toISOString()),
    ]);

    const weekCount = weekSessions.count || 0;
    const avgDuration = weekSessions.data?.length
      ? Math.round((weekSessions.data.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / weekSessions.data.length) / 60)
      : 0;

    return sendTelegram(chatId, `📈 *STATISTIKY*

*Tento týden:*
  🏃 Sessions: *${weekCount}*
  ⏱ Ø délka: *${avgDuration} min*
  👤 Noví uživatelé: *${newUsers.count || 0}*

*Posledních 30 dní:*
  🏃 Sessions: *${monthSessions.count || 0}*`);
  }

  // === MRR ===
  if (cmd === "mrr") {
    const { data: subs } = await supabase
      .from("gym_subscriptions")
      .select("plan_id, billing_period, is_grandfathered")
      .eq("status", "active");

    const { data: plans } = await supabase
      .from("subscription_plans")
      .select("id, price_monthly");

    const priceMap: Record<string, number> = {};
    for (const p of plans || []) priceMap[p.id] = p.price_monthly;

    let mrr = 0;
    let breakdown: Record<string, number> = {};
    for (const s of subs || []) {
      if (s.is_grandfathered) continue;
      const monthly = s.billing_period === "annual"
        ? Math.round(priceMap[s.plan_id] * 0.83)
        : priceMap[s.plan_id];
      mrr += monthly;
      breakdown[s.plan_id] = (breakdown[s.plan_id] || 0) + 1;
    }

    let response = `\n💰 MRR: *${mrr.toLocaleString("cs-CZ")} CZK*\n\n`;
    for (const [plan, count] of Object.entries(breakdown)) {
      response += `  ${plan.charAt(0).toUpperCase() + plan.slice(1)}: ${count}×\n`;
    }

    const grandfathered = (subs || []).filter(s => s.is_grandfathered).length;
    if (grandfathered) response += `\n  Grandfathered: ${grandfathered}×`;

    return sendTelegram(chatId, `💰 *MONTHLY RECURRING REVENUE*${response}`);
  }

  // === UŽIVATEL ===
  if (cmd.startsWith("uživatel ") || cmd.startsWith("uzivatel ")) {
    const name = cmd.replace(/^(uživatel|uzivatel)\s+/, "").trim();
    const { data: users } = await supabase
      .from("user_profiles")
      .select("id, first_name, last_name, primary_goal, user_level, current_streak, max_streak, selected_gym_id")
      .or(`first_name.ilike.%${name}%,last_name.ilike.%${name}%`)
      .limit(5);

    if (!users || users.length === 0) {
      return sendTelegram(chatId, `Uživatel "${name}" nenalezen.`);
    }

    let response = "";
    for (const u of users) {
      const fullName = `${u.first_name || ""} ${u.last_name || ""}`.trim();
      response += `\n👤 *${fullName}*\n`;
      response += `  🎯 Cíl: ${u.primary_goal || "—"}\n`;
      response += `  📊 Level: ${u.user_level || "—"}\n`;
      response += `  🔥 Streak: ${u.current_streak || 0} (max: ${u.max_streak || 0})\n`;
    }

    return sendTelegram(chatId, `🔍 *HLEDÁNÍ UŽIVATELE*${response}`);
  }

  // === ZPRÁVA ===
  if (cmd.startsWith("zpráva ") || cmd.startsWith("zprava ")) {
    const match = text.match(/^(?:zpráva|zprava)\s+(.+?):\s*(.+)$/i);
    if (!match) {
      return sendTelegram(chatId, "Formát: `zpráva [název posilovny]: text zprávy`");
    }

    const gymSearch = match[1].trim();
    const messageText = match[2].trim();

    const { data: gym } = await supabase
      .from("gyms")
      .select("id, name, owner_id")
      .ilike("name", `%${gymSearch}%`)
      .single();

    if (!gym) {
      return sendTelegram(chatId, `Posilovna "${gymSearch}" nenalezena.`);
    }

    const { error } = await supabase.from("gym_messages").insert({
      gym_id: gym.id,
      sender_id: gym.owner_id,
      title: "Zpráva od vedení",
      body: messageText,
      target_type: "all",
    });

    if (error) {
      return sendTelegram(chatId, `❌ Chyba: ${error.message}`);
    }

    return sendTelegram(chatId, `✅ Zpráva odeslána všem členům *${gym.name}*:\n\n"${messageText}"`);
  }

  // === FIX / OPRAV — remote fix request ===
  if (cmd.startsWith("oprav ") || cmd.startsWith("fix ")) {
    const request = text.replace(/^(oprav|fix)\s+/i, "").trim();
    if (!request) {
      return sendTelegram(chatId, "Formát: `oprav popis problému`");
    }

    const { error } = await supabase.from("remote_fix_requests").insert({
      message: request,
      status: "pending",
    });

    if (error) {
      return sendTelegram(chatId, `❌ Chyba: ${error.message}`);
    }

    return sendTelegram(chatId, `🔧 *Fix request vytvořen*\n\n"${request}"\n\nCloud agent ho zpracuje při příštím běhu (každou hodinu).`);
  }

  // === PENDING FIXES ===
  if (cmd === "opravy" || cmd === "fixes") {
    const { data: fixes } = await supabase
      .from("remote_fix_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);

    if (!fixes || fixes.length === 0) {
      return sendTelegram(chatId, "✅ Žádné pending fix requesty.");
    }

    let response = "";
    for (const f of fixes) {
      const icon = f.status === "completed" ? "✅" : f.status === "failed" ? "❌" : f.status === "in_progress" ? "⏳" : "🔧";
      const date = new Date(f.created_at).toLocaleDateString("cs-CZ");
      response += `\n${icon} *${f.status}* (${date})\n  ${f.message.slice(0, 100)}\n`;
      if (f.result) response += `  → ${f.result.slice(0, 100)}\n`;
    }

    return sendTelegram(chatId, `🔧 *FIX REQUESTY*${response}`);
  }

  // === AI CHAT — fallback to Claude ===
  return handleAiChat(text, chatId);
}

async function gatherContext() {
  const [users, gyms, sessions, feedback, subs] = await Promise.all([
    supabase.from("user_profiles").select("id", { count: "exact", head: true }),
    supabase.from("gyms").select("id, name, is_published, address"),
    supabase.from("workout_sessions").select("id", { count: "exact", head: true })
      .gte("started_at", new Date(Date.now() - 86400000).toISOString()),
    supabase.from("user_feedback").select("id, type, message, status")
      .in("status", ["new", "in_progress"]).limit(10),
    supabase.from("gym_subscriptions").select("gym_id, plan_id, status, is_grandfathered"),
  ]);

  const gymNames = (gyms.data || []).map(g => `${g.name} (${g.is_published ? "published" : "draft"})`).join(", ");
  const feedbackList = (feedback.data || []).map(f => `[${f.type}/${f.status}] ${(f.message || "").slice(0, 60)}`).join("\n");

  return `Aktuální stav Pumplo:
- Celkem uživatelů: ${users.count || 0}
- Posilovny: ${gymNames}
- Sessions za posledních 24h: ${sessions.count || 0}
- Aktivní subscriptions: ${(subs.data || []).filter(s => s.status === "active").length}
- Otevřený feedback (${(feedback.data || []).length}):
${feedbackList || "žádný"}`;
}

async function handleAiChat(userMessage: string, chatId: string) {
  try {
    const context = await gatherContext();

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: `Jsi Pumplo Admin Bot — asistent pro správu fitness SaaS platformy Pumplo. Odpovídáš česky, stručně a věcně. Tvůj uživatel je David Novotný, zakladatel a jednatel GynTools CZ s.r.o.

Pumplo je SaaS retention platforma pro nezávislé fitness posilovny. Má mobilní appku pro členy (tréninky, statistiky, gamifikace) a admin dashboard pro majitele posiloven (správa členů, strojů, trenérů, zpráv).

Tři subscription tiers: Start (1990 CZK/měs), Profi (3990 CZK), Premium (6990 CZK).
První zákazník: Eurogym Olomouc (grandfathered Premium).

${context}

Odpovídej stručně (max 500 znaků). Používej emoji. Pokud se ptá na data, použij kontext výše. Pokud potřebuješ detailnější data, řekni mu ať použije konkrétní příkaz (status, členové, feedback, statistiky, mrr).`,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    const data = await response.json();
    const aiResponse = data.content?.[0]?.text || "Omlouvám se, něco se pokazilo.";

    // Telegram has 4096 char limit
    const truncated = aiResponse.length > 4000 ? aiResponse.slice(0, 4000) + "..." : aiResponse;
    return sendTelegram(chatId, truncated, "Markdown");
  } catch (err) {
    console.error("AI chat error:", err);
    return sendTelegram(chatId, "❌ AI chat momentálně nefunguje. Zkus konkrétní příkaz — napiš *help*.");
  }
}

async function handlePhoto(message: any, chatId: string) {
  try {
    // Get largest photo version
    const photo = message.photo[message.photo.length - 1];
    const caption = (message.caption || "").trim();

    // Get file path from Telegram
    const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${photo.file_id}`);
    const fileData = await fileRes.json();
    if (!fileData.ok) throw new Error("Failed to get file from Telegram");

    const filePath = fileData.result.file_path;

    // Download photo from Telegram
    const photoRes = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`);
    const photoBlob = await photoRes.blob();
    const photoBuffer = new Uint8Array(await photoBlob.arrayBuffer());

    // Upload to Supabase Storage
    const fileName = `telegram/${Date.now()}_${photo.file_unique_id}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("gym-assets")
      .upload(fileName, photoBuffer, { contentType: "image/jpeg" });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage.from("gym-assets").getPublicUrl(fileName);
    const imageUrl = urlData.publicUrl;

    // If caption starts with "oprav" or "fix", create fix request with image
    const cmd = caption.toLowerCase();
    if (cmd.startsWith("oprav ") || cmd.startsWith("fix ")) {
      const request = caption.replace(/^(oprav|fix)\s+/i, "").trim();

      await supabase.from("remote_fix_requests").insert({
        message: `${request}\n\nScreenshot: ${imageUrl}`,
        status: "pending",
      });

      return sendTelegram(chatId, `🔧 *Fix request vytvořen* (s fotkou)\n\n"${request}"\n\n📸 ${imageUrl}\n\nCloud agent ho zpracuje při příštím běhu.`);
    }

    // Otherwise, use AI chat with image context
    const userMessage = caption || "Podívej se na tento screenshot a řekni mi co vidíš.";
    return handleAiChat(`${userMessage}\n\n[Uživatel přiložil screenshot: ${imageUrl}]`, chatId);
  } catch (err) {
    console.error("Photo handling error:", err);
    return sendTelegram(chatId, "❌ Nepodařilo se zpracovat fotku. Zkus to znovu.");
  }
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("OK", { status: 200 });
  }

  try {
    const update = await req.json();

    // Handle callback_query (inline button taps) FIRST — before text message check
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
      return new Response("OK", { status: 200 });
    }

    const message = update.message;
    if (!message?.chat?.id) {
      return new Response("OK", { status: 200 });
    }

    const chatId = String(message.chat.id);

    // Security: only respond to allowed chat
    if (chatId !== ALLOWED_CHAT_ID) {
      console.log(`Unauthorized chat: ${chatId}`);
      return new Response("OK", { status: 200 });
    }

    // Handle photo messages
    if (message.photo && message.photo.length > 0) {
      await handlePhoto(message, chatId);
      return new Response("OK", { status: 200 });
    }

    // Handle text messages
    if (message.text) {
      await handleCommand(message.text, chatId);
    }
  } catch (err) {
    console.error("Bot error:", err);
  }

  return new Response("OK", { status: 200 });
});
