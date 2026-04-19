import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID")!;
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function sendTelegram(text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: "Markdown" }),
  });
}

serve(async (req) => {
  // Only allow requests with the correct cron secret
  const cronSecret = Deno.env.get("CRON_SECRET");
  const authHeader = req.headers.get("authorization") ?? "";
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 86400000);
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);
    const dateStr = now.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });

    // Fetch all data in parallel
    const [
      totalUsers,
      newUsers,
      sessions24h,
      sessionsWeek,
      activePlans,
      newFeedback,
      allMembers,
      gyms,
      subs,
    ] = await Promise.all([
      supabase.from("user_profiles").select("id", { count: "exact", head: true }),
      supabase.from("user_profiles").select("id, first_name, last_name, selected_gym_id, primary_goal")
        .gte("created_at", yesterday.toISOString()),
      supabase.from("workout_sessions").select("id, duration_seconds", { count: "exact" })
        .gte("started_at", yesterday.toISOString()),
      supabase.from("workout_sessions").select("id", { count: "exact", head: true })
        .gte("started_at", weekAgo.toISOString()),
      supabase.from("user_workout_plans").select("id", { count: "exact", head: true }),
      supabase.from("user_feedback").select("id, type, message")
        .eq("status", "new")
        .gte("created_at", yesterday.toISOString()),
      supabase.from("user_profiles").select("id, selected_gym_id"),
      supabase.from("gyms").select("id, name"),
      supabase.from("gym_subscriptions").select("plan_id, status, is_grandfathered")
        .eq("status", "active"),
    ]);

    // Calculate activity status
    const { data: recentActive } = await supabase
      .from("workout_sessions")
      .select("user_id")
      .gte("started_at", weekAgo.toISOString());

    const { data: slowingActive } = await supabase
      .from("workout_sessions")
      .select("user_id")
      .gte("started_at", twoWeeksAgo.toISOString())
      .lt("started_at", weekAgo.toISOString());

    const activeUserIds = new Set((recentActive || []).map(s => s.user_id));
    const slowingUserIds = new Set((slowingActive || []).map(s => s.user_id).filter(id => !activeUserIds.has(id)));
    const totalCount = totalUsers.count || 0;
    const activeCount = activeUserIds.size;
    const slowingCount = slowingUserIds.size;
    const inactiveCount = Math.max(0, totalCount - activeCount - slowingCount);

    // Avg session duration
    const avgDuration = sessions24h.data?.length
      ? Math.round((sessions24h.data.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / sessions24h.data.length) / 60)
      : 0;

    // New users by gym
    let newUsersText = "";
    if (newUsers.data && newUsers.data.length > 0) {
      const gymMap: Record<string, string> = {};
      for (const g of gyms.data || []) gymMap[g.id] = g.name;

      const byGym: Record<string, number> = {};
      for (const u of newUsers.data) {
        const gymName = u.selected_gym_id ? (gymMap[u.selected_gym_id] || "Bez posilovny") : "Bez posilovny";
        byGym[gymName] = (byGym[gymName] || 0) + 1;
      }

      for (const [gym, count] of Object.entries(byGym)) {
        newUsersText += `  ${gym}: ${count}\n`;
      }
    }

    // Feedback
    const typeIcons: Record<string, string> = { bug: "🐛", feature: "💡", confusion: "😕", training: "🏋️", other: "📝" };
    let feedbackText = "";
    if (newFeedback.data && newFeedback.data.length > 0) {
      for (const f of newFeedback.data) {
        const icon = typeIcons[f.type] || "📝";
        feedbackText += `  ${icon} ${(f.message || "").slice(0, 80)}\n`;
      }
    }

    // MRR
    const { data: plans } = await supabase.from("subscription_plans").select("id, price_monthly");
    const priceMap: Record<string, number> = {};
    for (const p of plans || []) priceMap[p.id] = p.price_monthly;

    let mrr = 0;
    for (const s of subs.data || []) {
      if (!s.is_grandfathered) mrr += priceMap[s.plan_id] || 0;
    }

    // Build message
    const msg = `📊 *PUMPLO DAILY REPORT — ${dateStr}*

👤 *UŽIVATELÉ*
• Celkem: *${totalCount}*
• Noví (24h): *${newUsers.data?.length || 0}*
${newUsersText}• Aktivní (7d): *${activeCount}* (${totalCount ? Math.round(activeCount / totalCount * 100) : 0}%)
• Slowing: *${slowingCount}* (${totalCount ? Math.round(slowingCount / totalCount * 100) : 0}%)
• Inactive: *${inactiveCount}* (${totalCount ? Math.round(inactiveCount / totalCount * 100) : 0}%)

🏃 *AKTIVITA*
• Sessions (24h): *${sessions24h.count || 0}*
• Sessions (7d): *${sessionsWeek.count || 0}*
• Ø délka: *${avgDuration} min*
• Aktivní plány: *${activePlans.count || 0}*

${(newFeedback.data?.length || 0) > 0 ? `💬 *NOVÝ FEEDBACK* (${newFeedback.data!.length})\n${feedbackText}` : "✅ Žádný nový feedback"}

💰 *MRR: ${mrr.toLocaleString("cs-CZ")} CZK*`;

    await sendTelegram(msg);

    return new Response(JSON.stringify({ ok: true, sent: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Daily briefing error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
});
