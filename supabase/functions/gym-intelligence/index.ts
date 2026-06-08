import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

// Gym owner intelligence: weekly retention report + daily "rescue" alerts.
// Modes (body.mode): 'weekly' (Mon 08:00) | 'alerts' (daily). Emails the gym
// owner so they can reach out via Pumplo (gym->member message -> push) before a
// slipping member is lost. Auth: Bearer CRON_SECRET.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_FROM = "Pumplo <zpravy@pumplo.com>";
const PRAGUE = "Europe/Prague";

function escapeHtml(s: string): string {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) { console.error("RESEND_API_KEY not set"); return false; }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: RESEND_FROM, to, subject, html }),
  });
  if (!res.ok) { console.error("Resend error", res.status, await res.text().catch(() => "")); return false; }
  return true;
}

// Prague day number (days since epoch in Prague tz) for whole-day diffs.
function pragueDayNumber(d: Date): number {
  const p = new Date(d.toLocaleString("en-US", { timeZone: PRAGUE }));
  return Math.floor(Date.UTC(p.getFullYear(), p.getMonth(), p.getDate()) / 86400000);
}

interface Member {
  user_id: string; name: string; days: number | null;
  weekly: number; priorWeekly: number; gapBeforeLast: number | null;
  createdDayNum: number; current_streak: number;
}
interface GymStats {
  total: number; active: number;
  atRisk: Member[]; departed: Member[]; newMembers: Member[];
  returns: Member[]; topStreaks: Member[];
  weekTotal: number; priorTotal: number; enriched: Member[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function computeGymStats(supabase: SupabaseClient<any>, gymId: string, nowDayNum: number, ownerId?: string): Promise<GymStats | null> {
  let mq = supabase
    .from("user_profiles")
    .select("user_id, first_name, last_name, created_at, current_streak")
    .eq("selected_gym_id", gymId);
  // The gym owner is often also a member of their own gym — exclude them so
  // they don't appear in their own churn/retention report.
  if (ownerId) mq = mq.neq("user_id", ownerId);
  const { data: members } = await mq;
  if (!members?.length) return null;

  const ids = members.map((m: { user_id: string }) => m.user_id);
  const since = new Date(Date.now() - 60 * 86400000).toISOString();
  const { data: sessions } = await supabase
    .from("workout_sessions")
    .select("user_id, completed_at")
    .in("user_id", ids)
    .not("completed_at", "is", null)
    .gte("completed_at", since)
    .order("completed_at", { ascending: false });

  const byMember: Record<string, number[]> = {};
  for (const s of (sessions ?? []) as { user_id: string; completed_at: string }[]) {
    (byMember[s.user_id] ||= []).push(pragueDayNumber(new Date(s.completed_at)));
  }

  const enriched: Member[] = members.map((m: any) => {
    const list = byMember[m.user_id] || []; // day numbers, desc
    const lastDay = list.length ? list[0] : null;
    const days = lastDay === null ? null : nowDayNum - lastDay;
    const weekly = list.filter((d) => nowDayNum - d < 7).length;
    const priorWeekly = list.filter((d) => nowDayNum - d >= 7 && nowDayNum - d < 14).length;
    const gapBeforeLast = list.length >= 2 ? list[0] - list[1] : null;
    return {
      user_id: m.user_id,
      name: [m.first_name, m.last_name].filter(Boolean).join(" ").trim() || `Člen #${String(m.user_id).slice(0, 4)}`,
      days, weekly, priorWeekly, gapBeforeLast,
      createdDayNum: pragueDayNumber(new Date(m.created_at)),
      current_streak: m.current_streak ?? 0,
    };
  });

  return {
    total: members.length,
    active: enriched.filter((m) => m.days !== null && m.days <= 6).length,
    atRisk: enriched.filter((m) => m.days !== null && m.days >= 7 && m.days <= 13).sort((a, b) => (b.days! - a.days!)),
    departed: enriched.filter((m) => m.days !== null && m.days >= 14).sort((a, b) => (a.days! - b.days!)),
    newMembers: enriched.filter((m) => nowDayNum - m.createdDayNum < 7),
    returns: enriched.filter((m) => m.days !== null && m.days <= 6 && (m.gapBeforeLast ?? 0) >= 14),
    topStreaks: enriched.filter((m) => m.current_streak >= 3).sort((a, b) => b.current_streak - a.current_streak).slice(0, 3),
    weekTotal: enriched.reduce((s, m) => s + m.weekly, 0),
    priorTotal: enriched.reduce((s, m) => s + m.priorWeekly, 0),
    enriched,
  };
}

function trendArrow(now: number, prior: number): string {
  if (prior === 0) return now > 0 ? "▲" : "–";
  const pct = Math.round(((now - prior) / prior) * 100);
  if (pct > 5) return `▲ +${pct}%`;
  if (pct < -5) return `▼ ${pct}%`;
  return `→ ${pct >= 0 ? "+" : ""}${pct}%`;
}

function nameList(members: Member[], withDays = false): string {
  return members.map((m) =>
    `<li style="margin:2px 0">${escapeHtml(m.name)}${withDays && m.days !== null ? ` <span style="color:#888">— ${m.days} dní</span>` : ""}</li>`
  ).join("");
}

function weeklyReportHtml(gymName: string, s: GymStats): string {
  const pct = (n: number) => s.total ? Math.round((n / s.total) * 100) : 0;
  const slowing = s.atRisk.length, departed = s.departed.length;
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
    <h2 style="font-size:20px;margin:0 0 4px">📊 Týdenní přehled</h2>
    <p style="color:#666;margin:0 0 18px">${escapeHtml(gymName)}</p>

    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:18px">
      <tr>
        <td style="padding:8px;background:#ecfdf5;border-radius:8px;text-align:center">💪 Aktivní<br><strong style="font-size:18px">${s.active}</strong> <span style="color:#888">(${pct(s.active)}%)</span></td>
        <td style="width:8px"></td>
        <td style="padding:8px;background:#fffbeb;border-radius:8px;text-align:center">⚠️ Slábnoucí<br><strong style="font-size:18px">${slowing}</strong></td>
        <td style="width:8px"></td>
        <td style="padding:8px;background:#fef2f2;border-radius:8px;text-align:center">😴 Odešli<br><strong style="font-size:18px">${departed}</strong></td>
      </tr>
    </table>
    <p style="font-size:14px;margin:0 0 18px">Tréninků tento týden: <strong>${s.weekTotal}</strong> <span style="color:#888">(${trendArrow(s.weekTotal, s.priorTotal)} vs minulý týden)</span></p>

    ${s.atRisk.length ? `
    <h3 style="font-size:16px;margin:18px 0 6px">⚠️ Na hraně odchodu (7–13 dní)</h3>
    <ul style="margin:0 0 8px;padding-left:18px;font-size:14px">${nameList(s.atRisk, true)}</ul>
    <p style="font-size:13px;color:#b45309;margin:0 0 16px">👉 Napiš jim přímo v Pumplo — přijde jim upozornění a máš šanci je udržet.</p>` : ""}

    ${s.departed.length ? `
    <h3 style="font-size:16px;margin:18px 0 6px">😴 Odešli (14+ dní)</h3>
    <ul style="margin:0 0 16px;padding-left:18px;font-size:14px;color:#555">${nameList(s.departed, true)}</ul>` : ""}

    ${(s.newMembers.length || s.returns.length || s.topStreaks.length) ? `
    <h3 style="font-size:16px;margin:18px 0 6px">🎉 Pozitivní</h3>
    <ul style="margin:0 0 16px;padding-left:18px;font-size:14px">
      ${s.newMembers.length ? `<li>🆕 Noví členové: <strong>${s.newMembers.length}</strong></li>` : ""}
      ${s.returns.length ? `<li>🔄 Vrátili se: ${escapeHtml(s.returns.map((m) => m.name).join(", "))}</li>` : ""}
      ${s.topStreaks.length ? `<li>🔥 Nejlepší série: ${s.topStreaks.map((m) => `${escapeHtml(m.name)} (${m.current_streak})`).join(", ")}</li>` : ""}
    </ul>` : ""}

    ${s.atRisk.length ? `<div style="margin-top:18px;padding:12px 16px;background:#eef2ff;border-radius:8px;font-size:14px"><strong>Akce na tento týden:</strong> ${s.atRisk.length} ${s.atRisk.length === 1 ? "člen je" : "členů je"} na hraně. Ozvi se jim — udržet stávajícího člena je levnější než získat nového.</div>` : ""}

    <p style="font-size:12px;color:#aaa;margin-top:22px">Pumplo · týdenní přehled retence</p>
  </div>`;
}

function alertHtml(gymName: string, crossed: Member[], returnedToday: Member[]): string {
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
    <h2 style="font-size:19px;margin:0 0 4px">⚠️ Členové potřebují pozornost</h2>
    <p style="color:#666;margin:0 0 18px">${escapeHtml(gymName)}</p>
    ${crossed.length ? `
    <p style="font-size:15px;margin:0 0 6px">Tito právě překročili <strong>týden bez tréninku</strong> — teď je ta chvíle je zachytit:</p>
    <ul style="margin:0 0 8px;padding-left:18px;font-size:15px">${nameList(crossed, true)}</ul>
    <p style="font-size:13px;color:#b45309;margin:0 0 18px">👉 Napiš jim přímo v Pumplo. Přijde jim upozornění a velká šance, že se vrátí.</p>` : ""}
    ${returnedToday.length ? `
    <p style="font-size:15px;margin:14px 0 6px">🎉 A dobrá zpráva — vrátili se po delší pauze:</p>
    <ul style="margin:0 0 8px;padding-left:18px;font-size:15px">${returnedToday.map((m) => `<li>${escapeHtml(m.name)}</li>`).join("")}</ul>` : ""}
    <p style="font-size:12px;color:#aaa;margin-top:22px">Pumplo · denní záchranný alert</p>
  </div>`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ownerEmail(supabase: SupabaseClient<any>, ownerId: string): Promise<string | null> {
  const { data } = await supabase.auth.admin.getUserById(ownerId);
  return data?.user?.email ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || (req.headers.get("authorization") ?? "") !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let mode = "weekly";
  let onlyGymId: string | undefined;
  try {
    const body = await req.json();
    if (body.mode === "alerts" || body.mode === "weekly") mode = body.mode;
    if (typeof body.gym_id === "string") onlyGymId = body.gym_id;
  } catch { /* defaults */ }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const work = (async () => {
    const nowDayNum = pragueDayNumber(new Date());
    let q = supabase.from("gyms").select("id, name, owner_id").not("owner_id", "is", null);
    if (onlyGymId) q = q.eq("id", onlyGymId);
    const { data: gyms } = await q;
    let sent = 0;
    for (const gym of (gyms ?? []) as { id: string; name: string; owner_id: string }[]) {
      const to = await ownerEmail(supabase, gym.owner_id);
      if (!to) continue;
      const s = await computeGymStats(supabase, gym.id, nowDayNum, gym.owner_id);
      if (!s) continue;

      if (mode === "weekly") {
        const ok = await sendEmail(to, `📊 Týdenní přehled – ${gym.name}`, weeklyReportHtml(gym.name, s));
        if (ok) sent++;
      } else {
        const crossed = s.enriched.filter((m) => m.days === 7);
        const returnedToday = s.enriched.filter((m) => m.days === 0 && (m.gapBeforeLast ?? 0) >= 14);
        if (crossed.length || returnedToday.length) {
          const n = crossed.length;
          const subject = n ? `⚠️ ${n} ${n === 1 ? "člen potřebuje" : "členů potřebuje"} pozornost – ${gym.name}` : `🎉 Vrátili se členové – ${gym.name}`;
          const ok = await sendEmail(to, subject, alertHtml(gym.name, crossed, returnedToday));
          if (ok) sent++;
        }
      }
    }
    console.log(`gym-intelligence mode=${mode} sent=${sent}`);
  })();

  // @ts-ignore EdgeRuntime is a Supabase Edge global
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work);
  else await work;

  return new Response(JSON.stringify({ success: true, accepted: true, mode }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
