import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const ALLOWED_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID")!;
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

async function handleCommand(text: string, chatId: string) {
  const cmd = text.toLowerCase().trim();

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
📩 *zpráva [gym]: text* — hromadná zpráva`);
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

  // === UNKNOWN ===
  return sendTelegram(chatId, `Nerozumím příkazu. Napiš *help* pro seznam příkazů.`);
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("OK", { status: 200 });
  }

  try {
    const update = await req.json();
    const message = update.message;
    if (!message?.text || !message?.chat?.id) {
      return new Response("OK", { status: 200 });
    }

    const chatId = String(message.chat.id);

    // Security: only respond to allowed chat
    if (chatId !== ALLOWED_CHAT_ID) {
      console.log(`Unauthorized chat: ${chatId}`);
      return new Response("OK", { status: 200 });
    }

    await handleCommand(message.text, chatId);
  } catch (err) {
    console.error("Bot error:", err);
  }

  return new Response("OK", { status: 200 });
});
